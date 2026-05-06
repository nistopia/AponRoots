"""Subtree edit grants — share write access on a person and all of their
blood descendants with another user."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(tags=["grants"])


def _to_out(grant: models.SubtreeGrant, db: Session) -> schemas.SubtreeGrantOut:
    grantee = db.get(models.User, grant.grantee_user_id)
    person = db.get(models.Person, grant.root_person_id)
    return schemas.SubtreeGrantOut(
        id=grant.id,
        root_person_id=grant.root_person_id,
        root_person_name=person.name if person else "(deleted)",
        grantee_user_id=grant.grantee_user_id,
        grantee_email=grantee.email if grantee else "",
        grantee_name=grantee.name if grantee else None,
        granted_by_user_id=grant.granted_by_user_id,
        created_at=grant.created_at,
    )


def _require_owner_or_admin(
    db: Session, user: models.User, person_id: int
) -> models.Person:
    """Only the entry's owner or an admin can manage grants on it.
    A grantee CANNOT re-share the subtree they were granted access to."""
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    if not (user.is_admin or person.user_id == user.id):
        raise HTTPException(
            403,
            "Only the owner can manage sharing for this entry",
        )
    return person


@router.get(
    "/persons/{person_id}/grants",
    response_model=List[schemas.SubtreeGrantOut],
)
def list_grants(
    person_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _require_owner_or_admin(db, user, person_id)
    rows = (
        db.query(models.SubtreeGrant)
        .filter(models.SubtreeGrant.root_person_id == person_id)
        .order_by(models.SubtreeGrant.created_at.desc())
        .all()
    )
    return [_to_out(g, db) for g in rows]


@router.post(
    "/persons/{person_id}/grants",
    response_model=schemas.SubtreeGrantOut,
    status_code=201,
)
def create_grant(
    person_id: int,
    payload: schemas.SubtreeGrantCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = _require_owner_or_admin(db, user, person_id)

    grantee = (
        db.query(models.User)
        .filter(models.User.email == payload.grantee_email)
        .first()
    )
    if not grantee:
        raise HTTPException(
            404,
            f"No AponRoots user with email '{payload.grantee_email}'. "
            "They need to sign up first.",
        )
    if grantee.id == user.id:
        raise HTTPException(400, "You can't grant access to yourself")
    if grantee.id == person.user_id:
        raise HTTPException(
            400,
            f"{grantee.email} already owns this entry",
        )

    existing = (
        db.query(models.SubtreeGrant)
        .filter(
            models.SubtreeGrant.root_person_id == person_id,
            models.SubtreeGrant.grantee_user_id == grantee.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            400,
            f"{grantee.email} already has edit access on this subtree",
        )

    grant = models.SubtreeGrant(
        root_person_id=person_id,
        grantee_user_id=grantee.id,
        granted_by_user_id=user.id,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return _to_out(grant, db)


@router.delete(
    "/persons/{person_id}/grants/{grant_id}",
    status_code=204,
)
def revoke_grant(
    person_id: int,
    grant_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _require_owner_or_admin(db, user, person_id)
    grant = (
        db.query(models.SubtreeGrant)
        .filter(
            models.SubtreeGrant.id == grant_id,
            models.SubtreeGrant.root_person_id == person_id,
        )
        .first()
    )
    if not grant:
        raise HTTPException(404, "Grant not found")
    db.delete(grant)
    db.commit()
