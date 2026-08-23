import json
import types
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

from models import db, Agent, Conversation, Message
from utils.auth import get_current_company
from services.conversation_service import generate_agent_reply, generate_greeting
from services.summary import generate_summary
from services import session_store

conversations_bp = Blueprint("conversations", __name__, url_prefix="/api/conversations")

FALLBACK_LLM_MESSAGE = "Sorry, I'm having trouble generating a response right now. Please try again."
SESSION_STORE_UNAVAILABLE_MESSAGE = "Session store is currently unavailable. Please try again shortly."
SESSION_NOT_FOUND_MESSAGE = "This conversation is not active. Please start a new chat."


def _history_as_objects(history):
    """Adapts the plain-dict history stored in Redis back into objects with
    .role/.content attributes, matching what generate_agent_reply/format_history
    already expect from SQLAlchemy Message rows — keeps conversation_service.py
    untouched.
    """
    return [types.SimpleNamespace(role=m["role"], content=m["content"]) for m in history]


def _finalize_conversation_from_session(conversation, session):
    """Persist a Redis-held session to Postgres (the permanent store) and
    clear the Redis key. Only reached from /end, and — in principle, though
    it never currently fires — from an end-of-call turn in /message. If the
    Postgres write fails, the Redis session is left intact so the
    conversation isn't lost.
    """
    history = session.get("history", [])
    for m in history:
        db.session.add(Message(conversation_id=conversation.id, role=m["role"], content=m["content"]))

    conversation.status = "completed"
    conversation.ended_at = datetime.now(timezone.utc)
    conversation.stage = session.get("metadata", {}).get("stage", conversation.stage)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to persist conversation %s from Redis session — keeping Redis session intact",
            conversation.id,
        )
        raise

    try:
        summary = generate_summary(
            conversation.agent, conversation.company, _history_as_objects(history), current_app.config
        )
        conversation.summary = json.dumps(summary)
        conversation.sentiment = summary.get("sentiment")
        conversation.lead_status = summary.get("lead_status")
        db.session.commit()
    except Exception:
        current_app.logger.exception("Failed to generate summary for conversation %s", conversation.id)

    session_store.delete_session(conversation.id, current_app.config)


@conversations_bp.route("", methods=["POST"])
def create_conversation():
    """Public — a user does not need an account to start a conversation.

    The client only ever supplies agent_id; the backend resolves the
    owning company itself rather than trusting a client-provided company_id.
    """
    data = request.get_json(silent=True) or {}
    agent_id = data.get("agent_id")
    if not agent_id:
        return jsonify({"error": "agent_id is required"}), 400

    agent = Agent.query.filter_by(id=agent_id, is_active=True).first()
    if not agent:
        return jsonify({"error": "Agent not found"}), 404

    conversation = Conversation(company_id=agent.company_id, agent_id=agent.id, status="active")
    db.session.add(conversation)
    db.session.commit()

    return jsonify(conversation.to_dict()), 201


@conversations_bp.route("/<conversation_id>/start", methods=["POST"])
def start_conversation(conversation_id):
    """Public — generates the agent's opening line and builds the Redis
    session that the rest of the active conversation runs from. Idempotent:
    if a session already exists (e.g. a duplicate call from the frontend),
    its cached greeting is returned instead of building a new one — this
    also avoids a redundant Postgres read on the duplicate call.
    """
    try:
        existing_session = session_store.get_session(conversation_id, current_app.config)
    except session_store.SessionStoreError:
        current_app.logger.exception("Redis unavailable while starting conversation %s", conversation_id)
        return jsonify({"error": SESSION_STORE_UNAVAILABLE_MESSAGE}), 503

    if existing_session:
        first_assistant = next((m for m in existing_session["history"] if m["role"] == "assistant"), None)
        return jsonify({
            "conversation_id": conversation_id,
            "message": first_assistant["content"] if first_assistant else "",
            "is_end_of_call": False,
            "status": "active",
            "stage": existing_session.get("metadata", {}).get("stage", 1),
        }), 200

    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404
    if conversation.status != "active":
        return jsonify({"error": "This conversation has already ended"}), 400

    agent = conversation.agent
    company = conversation.company

    reply_text = generate_greeting(agent, company)

    new_session = session_store.build_session(
        conversation, agent, company, history=[{"role": "assistant", "content": reply_text}]
    )
    try:
        session_store.save_session(conversation_id, new_session, current_app.config)
    except session_store.SessionStoreError:
        current_app.logger.exception("Failed to save Redis session for conversation %s", conversation_id)
        return jsonify({"error": SESSION_STORE_UNAVAILABLE_MESSAGE}), 503

    return jsonify({
        "conversation_id": conversation.id,
        "message": reply_text,
        "is_end_of_call": False,
        "status": conversation.status,
        "stage": conversation.stage,
    }), 200


@conversations_bp.route("/<conversation_id>/message", methods=["POST"])
def send_message(conversation_id):
    """Public text conversation turn. Runs entirely off the Redis session
    built at /start — no Postgres reads or writes on this path. If no
    session exists (never started, ended, or its 24h TTL expired), this
    returns a clean error rather than silently reconstructing state from
    Postgres on every turn.
    """
    data = request.get_json(silent=True) or {}
    user_message = (data.get("message") or "").strip()
    if not user_message:
        return jsonify({"error": "message is required"}), 400

    try:
        session = session_store.get_session(conversation_id, current_app.config)
    except session_store.SessionStoreError:
        current_app.logger.exception("Redis unavailable for conversation %s", conversation_id)
        return jsonify({"error": SESSION_STORE_UNAVAILABLE_MESSAGE}), 503

    if session is None:
        current_app.logger.error("No active Redis session for conversation %s", conversation_id)
        return jsonify({"error": SESSION_NOT_FOUND_MESSAGE}), 404

    agent = types.SimpleNamespace(**session["agent"])
    company = types.SimpleNamespace(**session["company"])
    history_messages = _history_as_objects(session["history"])
    user_message_count = sum(1 for m in session["history"] if m["role"] == "user") + 1

    try:
        reply_text, is_end_of_call, stage = generate_agent_reply(
            agent, company, user_message, history_messages, user_message_count, current_app.config
        )
    except Exception:
        current_app.logger.exception("LLM turn failed for conversation %s", conversation_id)
        reply_text, is_end_of_call, stage = FALLBACK_LLM_MESSAGE, False, session["metadata"].get("stage", 1)

    session["history"].append({"role": "user", "content": user_message})
    session["history"].append({"role": "assistant", "content": reply_text})
    session["metadata"]["stage"] = stage

    if is_end_of_call:
        # Currently unreachable — generate_agent_reply always returns False
        # here — kept so this path degrades correctly if that ever changes.
        conversation = db.session.get(Conversation, conversation_id)
        if conversation:
            try:
                _finalize_conversation_from_session(conversation, session)
            except Exception:
                pass
    else:
        try:
            session_store.save_session(conversation_id, session, current_app.config)
        except session_store.SessionStoreError:
            current_app.logger.exception("Failed to update Redis session for conversation %s", conversation_id)
            return jsonify({"error": SESSION_STORE_UNAVAILABLE_MESSAGE}), 503

    return jsonify({
        "conversation_id": conversation_id,
        "message": reply_text,
        "is_end_of_call": is_end_of_call,
        "status": "completed" if is_end_of_call else "active",
        "stage": stage,
    }), 200


@conversations_bp.route("/<conversation_id>/end", methods=["POST"])
def end_conversation(conversation_id):
    """Public — lets the frontend end a chat the user walked away from.
    Retrieves the Redis session (if any), persists its full history and a
    generated summary to Postgres, then clears the Redis key.
    """
    conversation = db.session.get(Conversation, conversation_id)
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    if conversation.status == "active":
        try:
            session = session_store.get_session(conversation_id, current_app.config)
        except session_store.SessionStoreError:
            current_app.logger.exception(
                "Redis unavailable while ending conversation %s — finalizing without session history",
                conversation_id,
            )
            session = None

        if session:
            try:
                _finalize_conversation_from_session(conversation, session)
            except Exception:
                return jsonify({"error": "Failed to finalize conversation. Please try again."}), 500
        else:
            # No Redis session — never started, or its 24h TTL already
            # expired. Nothing to persist beyond marking it ended.
            conversation.status = "completed"
            conversation.ended_at = datetime.now(timezone.utc)
            db.session.commit()

    return jsonify(conversation.to_dict()), 200


@conversations_bp.route("", methods=["GET"])
@jwt_required()
def list_conversations():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    conversations = (
        Conversation.query.filter_by(company_id=company.id)
        .order_by(Conversation.started_at.desc())
        .all()
    )
    return jsonify({"conversations": [c.to_dict() for c in conversations]}), 200


@conversations_bp.route("/<conversation_id>", methods=["GET"])
@jwt_required()
def get_conversation(conversation_id):
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    conversation = Conversation.query.filter_by(id=conversation_id, company_id=company.id).first()
    if not conversation:
        return jsonify({"error": "Conversation not found"}), 404

    return jsonify(conversation.to_dict(include_messages=True)), 200
