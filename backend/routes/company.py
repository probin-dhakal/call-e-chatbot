from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import Agent, Document, Conversation
from utils.auth import get_current_company

company_bp = Blueprint("company", __name__, url_prefix="/api/company")


@company_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    company = get_current_company()
    if not company:
        return jsonify({"error": "Company not found"}), 404

    agents = Agent.query.filter_by(company_id=company.id).order_by(Agent.created_at.desc()).all()
    documents = Document.query.filter_by(company_id=company.id).order_by(Document.uploaded_at.desc()).all()
    conversation_count = Conversation.query.filter_by(company_id=company.id).count()
    recent_conversations = (
        Conversation.query.filter_by(company_id=company.id)
        .order_by(Conversation.started_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "company": company.to_dict(),
        "agents": [a.to_dict() for a in agents],
        "documents": [d.to_dict() for d in documents],
        "conversation_count": conversation_count,
        "recent_conversations": [c.to_dict() for c in recent_conversations],
    }), 200
