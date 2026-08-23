from flask_jwt_extended import get_jwt_identity
from models import Company


def get_current_company():
    """Resolve the authenticated Company from the JWT identity.

    Routes must never trust a client-supplied company_id — this is the
    only source of truth for "who is making this request".
    """
    identity = get_jwt_identity()
    if identity is None:
        return None
    return Company.query.get(int(identity))
