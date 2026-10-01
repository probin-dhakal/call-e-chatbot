import logging

from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from services.llm import generate_structured_response

logger = logging.getLogger(__name__)


class ConversationSummary(BaseModel):
    topic: str | None = Field(default=None, description="What the user was asking about.")
    key_points: str | None = Field(default=None, description="The main information covered.")
    unresolved_questions: str | None = Field(default=None, description="Questions not answerable from the knowledge base.")
    sentiment: str = Field(description="positive, neutral, or negative")
    resolution_status: str = Field(description="resolved, partially_resolved, unresolved, or not_applicable")
    follow_up: str | None = Field(default=None, description="A supported follow-up action, if any.")


SUMMARY_PROMPT = ChatPromptTemplate.from_template("""You just finished a chat as {agent_name}, an AI knowledge assistant for {company_name}.
Summarize the transcript accurately. Do not invent facts or follow-up actions.\n\nTRANSCRIPT:\n{transcript}""")

FALLBACK_SUMMARY = {
    "topic": None, "key_points": None, "unresolved_questions": None,
    "sentiment": "neutral", "lead_status": "not_applicable", "next_action": None,
}


def _format_transcript(messages, agent_name):
    return "\n".join(
        f"{'User' if message.role == 'user' else agent_name}: {message.content}"
        for message in messages
    ) or "(empty conversation)"


def generate_summary(agent, company, messages, cfg):
    if not messages:
        return dict(FALLBACK_SUMMARY)
    try:
        prompt = SUMMARY_PROMPT.invoke({
            "agent_name": agent.name, "company_name": company.name,
            "transcript": _format_transcript(messages, agent.name),
        })
        parsed = generate_structured_response(
            prompt, ConversationSummary, cfg["GEMINI_API_KEYS"], cfg["GEMINI_MODEL"]
        )
        data = parsed.model_dump() if isinstance(parsed, BaseModel) else dict(parsed)
        return {
            "topic": data.get("topic"),
            "key_points": data.get("key_points"),
            "unresolved_questions": data.get("unresolved_questions"),
            "sentiment": data.get("sentiment", "neutral"),
            "lead_status": data.get("resolution_status", "not_applicable"),
            "next_action": data.get("follow_up"),
        }
    except Exception:
        logger.exception("Failed to generate conversation summary")
        return dict(FALLBACK_SUMMARY)
