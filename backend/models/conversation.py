import json
import uuid
from datetime import datetime, timezone
from . import db


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False, index=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agents.id"), nullable=False, index=True)
    started_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = db.Column(db.DateTime(timezone=True), nullable=True)
    status = db.Column(db.String(50), nullable=False, default="active")  # active | completed

    # Fixed placeholder from a pre-pivot sales-stage design — kept only for
    # API/DB shape compatibility, no longer meaningfully used.
    stage = db.Column(db.Integer, nullable=False, default=1)

    # Populated once the call ends (see services/summary.py)
    summary = db.Column(db.Text, nullable=True)  # JSON-encoded structured summary
    sentiment = db.Column(db.String(50), nullable=True)
    lead_status = db.Column(db.String(50), nullable=True)

    messages = db.relationship(
        "Message",
        backref="conversation",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )

    def to_dict(self, include_messages=False):
        data = {
            "id": self.id,
            "company_id": self.company_id,
            "agent_id": self.agent_id,
            "agent_name": self.agent.name if self.agent else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "status": self.status,
            "stage": self.stage,
            "sentiment": self.sentiment,
            "lead_status": self.lead_status,
            "summary": json.loads(self.summary) if self.summary else None,
        }
        if include_messages:
            data["messages"] = [m.to_dict() for m in self.messages]
        return data


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.String(36), db.ForeignKey("conversations.id"), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # user | assistant | system
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "conversation_id": self.conversation_id,
            "role": self.role,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
