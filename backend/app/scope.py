"""
Authorization helpers.

Visibility model (current):
  - READ: any authenticated user can read any person.
  - WRITE: only the person's owner (or an admin) can modify it.
  (Future: per-entry shared edit grants.)
"""

from sqlalchemy.orm import Query, Session

from . import models


def scope_persons_read(query: Query, user: models.User) -> Query:
    """Read scope: everyone sees everything (no filter)."""
    _ = user  # kept for future per-tenant filtering
    return query


def can_write_person(user: models.User, person: models.Person) -> bool:
    """True if `user` is allowed to modify `person`."""
    return user.is_admin or person.user_id == user.id


def get_visible_person(db: Session, user: models.User, person_id: int) -> models.Person:
    """Read access — any authenticated user can fetch any person."""
    from fastapi import HTTPException

    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    return person


def get_writable_person(db: Session, user: models.User, person_id: int) -> models.Person:
    """Write access — must be owner or admin."""
    from fastapi import HTTPException

    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    if not can_write_person(user, person):
        raise HTTPException(403, "You don't have permission to modify this entry")
    return person
