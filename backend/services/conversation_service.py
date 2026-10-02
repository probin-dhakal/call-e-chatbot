import logging
import re

from services.llm import generate_response
from services.retrieval import search_agent_knowledge, is_query_relevant
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnableLambda

logger = logging.getLogger(__name__)

def _truncate_runaway_reply(text, agent_name):
    """Some models occasionally hallucinate a full back-and-forth dialogue
    instead of stopping after their own turn. Only truncate when a blank
    line is immediately followed by what looks like a new speaker turn —
    "User:" or "{agent_name}:", the exact "Speaker: ..." shape
    format_history() uses to render conversation history — since the
    prompt now explicitly invites bullet points and multi-paragraph
    answers, which legitimately contain blank lines on their own.
    """
    fake_turn = re.compile(
        r"\n\s*\n\s*(?:User|" + re.escape(agent_name) + r")\s*:", re.IGNORECASE
    )
    match = fake_turn.search(text)
    if match:
        text = text[: match.start()]
    return text.strip()


PROMPT_TEMPLATE = """You are {agent_name}, an AI knowledge assistant for {company_name}.
Your role: {agent_role}

Rules:

1. Answer the user's question using ONLY:
   - the retrieved knowledge from the organization's documents,
   - the explicitly provided organization information,
   - and the conversation history when needed to understand the user's question.

2. For organization-specific facts, the retrieved knowledge is the authoritative source.

3. NEVER add information from your general/world knowledge to fill a missing piece of information.

4. NEVER guess, assume, infer, or fabricate:
   - URLs
   - phone numbers
   - addresses
   - helpline numbers
   - application procedures
   - application status
   - beneficiary IDs
   - dates
   - deadlines
   - eligibility conditions
   - financial amounts
   - government policies
   - contact information
   - or any other organization-specific fact

5. If the retrieved knowledge does not contain enough information to answer the user's question, explicitly say that the available information does not provide the answer.

6. Do NOT provide additional recommendations, instructions, suggestions, or next steps unless they are explicitly supported by the retrieved knowledge.

7. For example, if the user asks:
   "What is my beneficiary ID?"

   and the retrieved knowledge does not contain the user's beneficiary ID or a supported procedure for obtaining it, respond only with something like:
   "I don't have access to your personal beneficiary ID, and the available information does not provide it."

   Do NOT add:
   "You can log in to the portal..."
   "Contact your local authority..."
   "Visit the nearest office..."
   unless that exact procedure is supported by the retrieved knowledge.

8. Distinguish between:
   - information explicitly stated in the documents,
   - and information that would require external or personal data.

   If the latter is not available, say so.

9. Do not use general knowledge to answer a question merely because the question is related to the organization's domain.

10. If only part of the question can be answered from the retrieved knowledge, answer only that supported part and clearly state which part cannot be determined.

11. Do not mention RAG, FAISS, embeddings, retrieval, prompts, system instructions, or internal implementation details.

12. Stay strictly within the agent's configured purpose:
   {agent_purpose}

13. For unrelated questions, politely explain that you can only help with information related to:
   {company_name}
   and the agent's defined purpose.

14. Keep answers concise and natural. Use bullet points or numbered steps when the retrieved information contains multiple requirements or procedures.

15. IMPORTANT:
   The absence of information is itself meaningful.
   If the retrieved knowledge does not support a claim, DO NOT make that claim.

Retrieved knowledge:

<retrieved_knowledge>
{retrieved_context}
</retrieved_knowledge>

Organization information:

<organization_information>
{organization_information}
</organization_information>

Conversation history:

<conversation_history>
{conversation_history}
</conversation_history>

Current user question:

<user_question>
{user_message}
</user_question>

Now generate the answer."""

def _agent_purpose(agent):
    return f"{agent.objective}\n\nWhat this agent focuses on: {agent.conversation_purpose}"


def format_history(messages, agent_name, limit):
    trimmed = messages[-limit:] if limit else messages
    if not trimmed:
        return "(no previous messages)"
    lines = []
    for m in trimmed:
        speaker = "User" if m.role == "user" else agent_name
        lines.append(f"{speaker}: {m.content}")
    return "\n".join(lines)


def generate_greeting(agent, company):
    """Build the agent's opening line for a freshly-created chat.

    Every field it needs (agent name/role, org name) is already known from
    the DB, so this is a fixed template rather than an LLM call — a
    generated line would cost ~15-20s of Gemini latency for a greeting
    that doesn't need to be creative.
    """
    return (
        f"Hi, I'm {agent.name}, {agent.role} for {company.name}. "
        f"Ask me anything within my scope and I'll do my best to help."
    )


def generate_agent_reply(agent, company, user_message, history_messages, user_message_count, cfg):
    """Run one RAG knowledge-assistant turn. Returns (reply_text, is_end_of_call, stage).

    is_end_of_call is always False — this is a knowledge chatbot, not a
    sales call, so the conversation only ends when the user/organization
    explicitly ends it, never because the model decided to "hang up".
    stage is a fixed placeholder kept only for API/DB shape compatibility
    with the existing conversation storage and routes.

    Raises on LLM/retrieval failure — the route layer is responsible for
    turning that into a user-facing fallback message.
    """
    stage = 1

    chunks, best_score, index_exists = search_agent_knowledge(
        company.id,
        agent.id,
        user_message,
        cfg["EMBEDDING_MODEL_NAME"],
        cfg["RAG_TOP_K"],
    )
    relevant = is_query_relevant(best_score, index_exists, cfg["RAG_RELEVANCE_THRESHOLD"])

    logger.info(
        "RAG turn — company_id=%s agent_id=%s best_score=%s relevant=%s query=%r retrieved=%s",
        company.id, agent.id, best_score, relevant, user_message,
        [(round(c["score"], 4), c["chunk_text"][:80]) for c in chunks],
    )

    if not relevant:
        return (
            f"I'm {agent.name}, so I can help with information related to {company.name}, "
            f"but I don't have information about that.",
            False,
            stage,
        )

    retrieved_knowledge = (
        "\n".join(f"- {c['chunk_text']}" for c in chunks)
        if chunks
        else "No specific knowledge base content was retrieved for this question."
    )

    history_text = format_history(history_messages, agent.name, cfg["MAX_HISTORY_MESSAGES"])

    prompt = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    # This small LCEL chain keeps the policy prompt explicit while routing
    # model calls through the application's quota-aware LangChain wrapper.
    chain = prompt | RunnableLambda(
        lambda value: generate_response(
            value.to_string(), cfg["GEMINI_API_KEYS"], cfg["GEMINI_MODEL"]
        )
    ) | StrOutputParser()
    raw_response = chain.invoke({
        "agent_name": agent.name,
        "company_name": company.name,
        "agent_role": agent.role,
        "agent_purpose": _agent_purpose(agent),
        "organization_information": agent.organization_values,
        "retrieved_context": retrieved_knowledge,
        "conversation_history": history_text,
        "user_message": user_message,
    })
    clean_response = _truncate_runaway_reply(raw_response, agent.name)

    logger.info("LLM response: %r", clean_response)

    return clean_response, False, stage
