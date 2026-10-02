from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector

from . import db


class DocumentChunk(db.Model):
    __tablename__ = "document_chunks"

    id = db.Column(db.BigInteger, primary_key=True)

    company_id = db.Column(
        db.Integer,
        db.ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    agent_id = db.Column(
        db.Integer,
        db.ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    document_id = db.Column(
        db.Integer,
        db.ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    chunk_index = db.Column(
        db.Integer,
        nullable=False,
    )

    chunk_text = db.Column(
        db.Text,
        nullable=False,
    )

    embedding = db.Column(
        Vector(768),
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self):
        return {
            "id": self.id,
            "company_id": self.company_id,
            "agent_id": self.agent_id,
            "document_id": self.document_id,
            "chunk_index": self.chunk_index,
            "chunk_text": self.chunk_text,
            "created_at": (
                self.created_at.isoformat()
                if self.created_at
                else None
            ),
        }