import re
import uuid

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9]+")


def safe_company_folder(company_id, company_name):
    """Build a filesystem-safe, collision-proof folder name for a company.

    The company id is always prefixed so two organizations with the same
    (or similar) name never collide, and every character that isn't
    alphanumeric is stripped — this also rules out path traversal
    sequences like '../', '/', or '\\' regardless of what the company
    name contains.
    """
    slug = _SAFE_CHARS.sub("_", company_name or "").strip("_") or "company"
    return f"{company_id}_{slug}"


def unique_stored_filename():
    """Generate a random, collision-proof filename for a stored PDF."""
    return f"{uuid.uuid4().hex}.pdf"
