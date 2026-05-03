"""
Helper to scope DB queries to the current user.

For admin users this returns the unfiltered query (admin sees everything).
For regular users it adds `Person.user_id == user.id` (and joins for ParentChild
and Union via the person ids the user owns).
"""

from sqlalchemy.orm import Query, Session

from . import models


def scope_persons(query: Query, user: models.User) -> Query:
    if user.is_admin:
        return query
    return query.filter(models.Person.user_id == user.id)


def assert_owns_person(db: Session, user: models.User, person_id: int) -> models.Person:
    """Fetch a person ensuring the current user owns it (or is admin)."""
    from fastapi import HTTPException

    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    if not user.is_admin and person.user_id != user.id:
        raise HTTPException(404, "Person not found")  # 404 not 403 to avoid leaking existence
    return person


def user_owns_persons(db: Session, user: models.User, *person_ids: int) -> bool:
    """Returns True iff the user (or admin) owns ALL given person_ids."""
    if user.is_admin:
        return True
    rows = (
        db.query(models.Person.id)
        .filter(models.Person.id.in_(person_ids), models.Person.user_id == user.id)
        .all()
    )
    return len(rows) == len(set(person_ids))
