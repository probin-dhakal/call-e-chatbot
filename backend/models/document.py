from datetime import datetime, timezone
from . import db


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False, index=True)
    agent_id = db.Column(db.Integer, db.ForeignKey("agents.id"), nullable=False, index=True)
    original_filename = db.Column(db.String(500), nullable=False)
    stored_filename = db.Column(db.String(500), nullable=False)
    file_path = db.Column(db.String(1000), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_type = db.Column(db.String(50), nullable=False, default="pdf")
    file_hash = db.Column(db.String(64), nullable=True, index=True)  # SHA-256, for duplicate detection

    # uploaded -> processing -> completed | failed
    status = db.Column(db.String(50), nullable=False, default="uploaded")
    error_message = db.Column(db.Text, nullable=True)

    # Populated once the document has been embedded into the agent's FAISS index
    # Populated once the document has been embedded into pgvector.
    embedding_model = db.Column(
        db.String(255),
        nullable=True,
    )

    chunk_count = db.Column(
        db.Integer,
        nullable=True,
    )

    uploaded_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "company_id": self.company_id,
            "agent_id": self.agent_id,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "status": self.status,
            "error_message": self.error_message,
            "embedding_model": self.embedding_model,
            "chunk_count": self.chunk_count,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
        }
