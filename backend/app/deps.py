"""FastAPI dependencies for auth: get_current_user, require_admin, etc."""

from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# The demo account (demo@aponroots.com) owns the curated public-domain
# 'Famous Trees' showcased on /famous-trees. Any logged-in visitor may
# *view* its data, but the account itself must be immutable so that
# random visitors can't damage the demo via the API. Mutations from the
# demo user are blocked at the dependency layer below.
DEMO_USER_EMAIL = "demo@aponroots.com"
_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id = int(payload.get("sub", 0))
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if (
        user.email == DEMO_USER_EMAIL
        and request.method.upper() in _UNSAFE_METHODS
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "The demo account is read-only. "
                "Sign up for a free account to make changes."
            ),
        )
    return user


def require_admin(
    user: models.User = Depends(get_current_user),
) -> models.User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user
