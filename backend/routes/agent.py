from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from models import db, Agent
from utils.auth import get_current_company

agent_bp = Blueprint("agents", __name__, url_prefix="/api/agents")

REQUIRED_FIELDS = ["name", "role", "objective", "organization_values", "conversation_purpose"]


@agent_bp.route("", methods=["POST"])
@jwt_required()
def create_agent():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    data = request.get_json(silent=True) or {}
    missing = [f for f in REQUIRED_FIELDS if not (data.get(f) or "").strip()]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    agent = Agent(
        company_id=company.id,
        name=data["name"].strip(),
        role=data["role"].strip(),
        objective=data["objective"].strip(),
        organization_values=data["organization_values"].strip(),
        conversation_purpose=data["conversation_purpose"].strip(),
    )
    db.session.add(agent)
    db.session.commit()

    return jsonify({"agent": agent.to_dict()}), 201


@agent_bp.route("", methods=["GET"])
@jwt_required()
def list_agents():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    agents = Agent.query.filter_by(company_id=company.id).order_by(Agent.created_at.desc()).all()
    return jsonify({"agents": [a.to_dict() for a in agents]}), 200


@agent_bp.route("/<int:agent_id>", methods=["PATCH"])
@jwt_required()
def update_agent(agent_id):
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    agent = Agent.query.filter_by(id=agent_id, company_id=company.id).first()
    if not agent:
        return jsonify({"error": "Agent not found for this organization"}), 404

    data = request.get_json(silent=True) or {}

    editable_text_fields = ["name", "role", "objective", "organization_values", "conversation_purpose"]
    for field in editable_text_fields:
        if field in data:
            value = (data.get(field) or "").strip()
            if not value:
                return jsonify({"error": f"{field} cannot be empty"}), 400
            setattr(agent, field, value)

    if "is_active" in data:
        agent.is_active = bool(data["is_active"])

    db.session.commit()
    return jsonify({"agent": agent.to_dict()}), 200


@agent_bp.route("/public", methods=["GET"])
def list_public_agents():
    """Public — lets a user browse agents to talk to without an account."""
    agents = Agent.query.filter_by(is_active=True).order_by(Agent.created_at.desc()).all()
    return jsonify({"agents": [a.to_public_dict() for a in agents]}), 200


@agent_bp.route("/public/<int:agent_id>", methods=["GET"])
def get_public_agent(agent_id):
    """Public — single-agent detail for the "Enter as User" flow."""
    agent = Agent.query.filter_by(id=agent_id, is_active=True).first()
    if not agent:
        return jsonify({"error": "Agent not found"}), 404
    return jsonify({"agent": agent.to_public_dict()}), 200
