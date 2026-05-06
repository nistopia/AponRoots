"""Authentication endpoints: signup, login, me, google OAuth, password mgmt."""

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import email_sender, models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
RESET_TOKEN_TTL = timedelta(hours=1)


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class GoogleAuthRequest(BaseModel):
    """The credential string returned by Google Identity Services on the frontend."""

    credential: str


@router.post("/signup", response_model=schemas.TokenResponse, status_code=201)
def signup(payload: schemas.UserSignup, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    user = models.User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.is_admin)
    return schemas.TokenResponse(access_token=token, user=user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(user.id, user.is_admin)
    return schemas.TokenResponse(access_token=token, user=user)


@router.post("/google", response_model=schemas.TokenResponse)
def google_signin(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Verify a Google ID token, find-or-create user, return our JWT.

    The frontend obtains the ID token from Google Identity Services
    (the new "Sign In With Google" button) and POSTs it here.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            500,
            "Google OAuth is not configured on the server (missing GOOGLE_CLIENT_ID env var).",
        )

    # Lazy import so the lib is only required when this endpoint is hit
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token

    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        raise HTTPException(401, f"Invalid Google token: {e}")

    google_sub: str = idinfo["sub"]  # stable Google user id
    email: str = idinfo.get("email", "")
    email_verified: bool = idinfo.get("email_verified", False)
    name: Optional[str] = idinfo.get("name")

    if not email or not email_verified:
        raise HTTPException(401, "Google account must have a verified email")

    # Match by google_sub first, then fall back to matching email so a user
    # who first signed up with email/password can later "link" Google.
    user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            # Existing email/password user: link Google identity
            user.google_sub = google_sub
            if not user.name and name:
                user.name = name
            db.commit()
            db.refresh(user)
        else:
            # Brand-new user
            user = models.User(
                email=email,
                password_hash=None,  # no local password; OAuth-only
                name=name,
                google_sub=google_sub,
                is_admin=False,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    token = create_access_token(user.id, user.is_admin)
    return schemas.TokenResponse(access_token=token, user=user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


# ---------- Password management ----------


@router.put("/me/password", response_model=schemas.MessageResponse)
def change_password(
    payload: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Change the password of the authenticated user. Requires the old password."""
    if not user.password_hash:
        # OAuth-only users don't have a local password to change.
        raise HTTPException(
            400,
            "This account signs in with Google. Set a password by using "
            "Forgot Password to create one.",
        )
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(401, "Old password is incorrect")
    if payload.old_password == payload.new_password:
        raise HTTPException(400, "New password must differ from old password")

    user.password_hash = hash_password(payload.new_password)

    # Invalidate any outstanding reset tokens for this user.
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})

    db.commit()
    return schemas.MessageResponse(detail="Password updated")


@router.post("/forgot-password", response_model=schemas.MessageResponse)
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Request a password reset link.

    Always returns the same generic message so attackers can't enumerate
    which emails are registered.
    """
    generic = schemas.MessageResponse(
        detail="If that email is registered, a reset link has been sent."
    )

    user = (
        db.query(models.User).filter(models.User.email == payload.email).first()
    )
    if not user:
        return generic

    # Issue a token even if the user is OAuth-only — this lets them set a
    # local password for the first time. The reset endpoint will create the
    # password_hash if it was NULL.
    raw = secrets.token_urlsafe(32)
    token_row = models.PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw),
        expires_at=datetime.utcnow() + RESET_TOKEN_TTL,
    )
    db.add(token_row)
    db.commit()

    frontend_url = os.environ.get("FRONTEND_URL", "https://aponroots.com")
    link = f"{frontend_url.rstrip('/')}/reset-password?token={raw}"

    body = (
        f"Hi {user.name or 'there'},\n\n"
        f"Someone (hopefully you) requested a password reset for your "
        f"AponRoots account.\n\n"
        f"Click this link to set a new password (expires in 1 hour):\n"
        f"{link}\n\n"
        f"If you didn't request this, you can ignore this email — your "
        f"current password will keep working.\n\n"
        f"— AponRoots"
    )
    email_sender.send_email(user.email, "Reset your AponRoots password", body)
    # Also log the link so an admin running the server can grab it if SMTP
    # isn't configured. Only the hash is stored in the DB.
    logger.info("Issued password reset for user_id=%s link=%s", user.id, link)

    return generic


@router.post("/reset-password", response_model=schemas.TokenResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """Consume a one-time reset token and set a new password.

    Returns a fresh JWT so the user is logged in immediately.
    """
    token_hash = _hash_reset_token(payload.token)
    row = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_hash)
        .first()
    )
    if not row or row.used_at is not None or row.expires_at < datetime.utcnow():
        raise HTTPException(400, "This reset link is invalid or expired")

    user = db.query(models.User).filter(models.User.id == row.user_id).first()
    if not user:
        raise HTTPException(400, "This reset link is invalid or expired")

    user.password_hash = hash_password(payload.new_password)
    row.used_at = datetime.utcnow()

    # Invalidate every other outstanding reset token for this user.
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
        models.PasswordResetToken.id != row.id,
    ).update({"used_at": datetime.utcnow()})

    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.is_admin)
    return schemas.TokenResponse(access_token=token, user=user)

