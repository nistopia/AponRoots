"""Authentication endpoints: signup, login, me, google OAuth."""

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


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

