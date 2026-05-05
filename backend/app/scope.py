"""
Authorization helpers.

Visibility model (current):
  - READ: any authenticated user can read any person.
  - WRITE: only the person's owner (or an admin) can modify it.
  (Future: per-entry shared edit grants.)
"""

from typing import Set
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


def get_user_network_ids(db: Session, user: models.User) -> Set[int]:
    """Returns ids of every Person reachable from entries owned by `user` via
    parent/child/spouse links (the user's "family network").

    Even people authored by other users count as long as they're connected to
    something the user owns. Useful for the home page so a user sees their
    in-laws (added by their spouse from another account)."""
    seed_ids = {
        pid
        for (pid,) in db.query(models.Person.id)
        .filter(models.Person.user_id == user.id)
        .all()
    }
    if not seed_ids:
        return set()

    visited: Set[int] = set(seed_ids)
    queue = list(seed_ids)

    while queue:
        cur = queue.pop()

        # parents of cur
        for (pid,) in db.query(models.ParentChild.parent_id).filter(
            models.ParentChild.child_id == cur
        ).all():
            if pid not in visited:
                visited.add(pid)
                queue.append(pid)

        # children of cur
        for (cid,) in db.query(models.ParentChild.child_id).filter(
            models.ParentChild.parent_id == cur
        ).all():
            if cid not in visited:
                visited.add(cid)
                queue.append(cid)

        # spouses (both directions of unordered pair)
        for (sid,) in db.query(models.Union.partner_b_id).filter(
            models.Union.partner_a_id == cur
        ).all():
            if sid not in visited:
                visited.add(sid)
                queue.append(sid)
        for (sid,) in db.query(models.Union.partner_a_id).filter(
            models.Union.partner_b_id == cur
        ).all():
            if sid not in visited:
                visited.add(sid)
                queue.append(sid)

    return visited

