from datetime import datetime, timezone
from . import db


class Agent(db.Model):
    __tablename__ = "agents"

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(255), nullable=False)
    objective = db.Column(db.Text, nullable=False)
    organization_values = db.Column(db.Text, nullable=False)
    conversation_purpose = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    documents = db.relationship("Document", backref="agent", lazy=True)
    conversations = db.relationship("Conversation", backref="agent", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "company_id": self.company_id,
            "name": self.name,
            "role": self.role,
            "objective": self.objective,
            "organization_values": self.organization_values,
            "conversation_purpose": self.conversation_purpose,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_public_dict(self):
        """Safe-to-browse shape for the public "Enter as User" agent list."""
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "objective": self.objective,
            "company_name": self.company.name if self.company else None,
        }
