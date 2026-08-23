import json
import logging

from services.llm import generate_response

logger = logging.getLogger(__name__)

SUMMARY_TEMPLATE = """You just finished a chat as {agent_name}, an AI knowledge assistant for {company_name}.

Read the transcript below and produce a short structured summary as strict JSON with exactly these keys:
- "topic": what the user was asking about, one sentence.
- "key_points": the main information covered, one sentence (or "None").
- "unresolved_questions": questions the assistant could not answer from its knowledge base, one sentence (or "None").
- "sentiment": one of "positive", "neutral", "negative".
- "resolution_status": one of "resolved", "partially_resolved", "unresolved", "not_applicable".
- "follow_up": a short recommended follow-up action, if any, one sentence (or "None").

Respond with ONLY the JSON object, no other text.

TRANSCRIPT:
{transcript}
"""

# lead_status/next_action are the existing DB column and JSON key names —
# reused here to store resolution_status/follow_up instead of sales
# qualification, avoiding a schema migration for a naming-only change.
FALLBACK_SUMMARY = {
    "topic": None,
    "key_points": None,
    "unresolved_questions": None,
    "sentiment": "neutral",
    "lead_status": "not_applicable",
    "next_action": None,
}


def _format_transcript(messages, agent_name):
    lines = []
    for m in messages:
        speaker = "User" if m.role == "user" else agent_name
        lines.append(f"{speaker}: {m.content}")
    return "\n".join(lines) if lines else "(empty conversation)"


def generate_summary(agent, company, messages, cfg):
    """One-shot LLM call at end-of-chat only — never on the live turn path."""
    if not messages:
        return dict(FALLBACK_SUMMARY)

    transcript = _format_transcript(messages, agent.name)

    try:
        prompt = SUMMARY_TEMPLATE.format(
            agent_name=agent.name,
            company_name=company.name,
            transcript=transcript,
        )
        raw = generate_response(prompt, cfg["GEMINI_API_KEYS"], cfg["GEMINI_MODEL"], temperature=0.2)

        start = raw.find("{")
        end = raw.rfind("}")
        parsed = json.loads(raw[start:end + 1])

        summary = dict(FALLBACK_SUMMARY)
        summary["topic"] = parsed.get("topic")
        summary["key_points"] = parsed.get("key_points")
        summary["unresolved_questions"] = parsed.get("unresolved_questions")
        summary["sentiment"] = parsed.get("sentiment", summary["sentiment"])
        summary["lead_status"] = parsed.get("resolution_status", summary["lead_status"])
        summary["next_action"] = parsed.get("follow_up")
        return summary
    except Exception:
        logger.exception("Failed to generate conversation summary")
        return dict(FALLBACK_SUMMARY)
