from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

from .company import Company
from .agent import Agent
from .document import Document
from .document_chunk import DocumentChunk
from .conversation import Conversation, Message

__all__ = [
    "db",
    "Company",
    "Agent",
    "Document",
    "DocumentChunk",
    "Conversation",
    "Message",
]