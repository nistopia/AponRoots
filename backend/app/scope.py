"""
Authorization helpers.

Visibility model:
  - READ: any authenticated user can read any person.
  - WRITE: a person is writable by:
      * the person's owner, OR
      * an admin, OR
      * any user who has been granted edit access on an ancestor of this
        person (or this person itself) via a SubtreeGrant. Grants are
        DYNAMIC — new descendants of a granted root are auto-shared.
"""

from typing import Optional, Set
from sqlalchemy.orm import Query, Session

from . import models


def scope_persons_read(query: Query, user: models.User) -> Query:
    """Read scope: everyone sees everything (no filter)."""
    _ = user  # kept for future per-tenant filtering
    return query


def get_grant_writable_ids(db: Session, user: models.User) -> Set[int]:
    """Return ids of every Person `user` can edit via SubtreeGrants — i.e.
    every grant root the user is grantee on, plus all of their blood
    descendants reached by walking parent_child edges downward.
    """
    roots = {
        rid
        for (rid,) in db.query(models.SubtreeGrant.root_person_id)
        .filter(models.SubtreeGrant.grantee_user_id == user.id)
        .all()
    }
    if not roots:
        return set()

    visited: Set[int] = set(roots)
    queue = list(roots)
    while queue:
        cur = queue.pop()
        for (cid,) in db.query(models.ParentChild.child_id).filter(
            models.ParentChild.parent_id == cur
        ).all():
            if cid not in visited:
                visited.add(cid)
                queue.append(cid)
    return visited


def can_write_person(
    user: models.User,
    person: models.Person,
    grant_writable_ids: Optional[Set[int]] = None,
) -> bool:
    """True if `user` is allowed to modify `person`.

    Pass `grant_writable_ids` if you've already computed it for this
    request (saves a DB walk per call). When omitted the check ignores
    grants — only suitable when the caller knows there are no grants
    OR will follow up with a DB-aware check.
    """
    if user.is_admin or person.user_id == user.id:
        return True
    if grant_writable_ids is not None and person.id in grant_writable_ids:
        return True
    return False


def get_visible_person(db: Session, user: models.User, person_id: int) -> models.Person:
    """Read access — any authenticated user can fetch any person."""
    from fastapi import HTTPException

    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    return person


def get_writable_person(db: Session, user: models.User, person_id: int) -> models.Person:
    """Write access — owner, admin, or grantee on an ancestor subtree."""
    from fastapi import HTTPException

    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    if user.is_admin or person.user_id == user.id:
        return person
    # Lazy: only run the grant query if the cheaper checks didn't pass.
    grant_ids = get_grant_writable_ids(db, user)
    if person.id in grant_ids:
        return person
    raise HTTPException(403, "You don't have permission to modify this entry")


def get_user_network_ids(db: Session, user: models.User) -> Set[int]:
    """Returns ids of every Person reachable from the user's "starting points"
    via parent/child/spouse links — their family network for the home page.

    Starting points include:
      - persons owned by the user, AND
      - persons the user has edit access to via SubtreeGrants (the grant
        roots and all of their blood descendants).

    Without including grants, a user who hasn't created any entries but
    was invited to edit someone else's branch would see an empty home
    page and have no way to find the people they can actually edit.
    """
    owned_ids = {
        pid
        for (pid,) in db.query(models.Person.id)
        .filter(models.Person.user_id == user.id)
        .all()
    }
    grant_ids = get_grant_writable_ids(db, user)
    seed_ids = owned_ids | grant_ids
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

