from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..relationship import (
    get_parents, get_children, get_spouses, ancestors_with_depth,
)
from ..scope import assert_owns_person, scope_persons, user_owns_persons

router = APIRouter(prefix="/persons", tags=["persons"])


def _to_out(db: Session, person: models.Person) -> schemas.PersonOut:
    return schemas.PersonOut(
        id=person.id,
        name=person.name,
        gender=person.gender,
        birth_date=person.birth_date,
        death_date=person.death_date,
        notes=person.notes,
        parent_ids=get_parents(db, person.id),
        children_ids=get_children(db, person.id),
        spouse_ids=get_spouses(db, person.id),
    )


@router.get("/search", response_model=List[schemas.PersonOut])
def search_persons(
    q: str = "", limit: int = 50,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = scope_persons(db.query(models.Person), user)
    if q.strip():
        query = query.filter(models.Person.name.ilike(f"%{q.strip()}%"))
    rows = query.order_by(models.Person.name).limit(limit).all()
    return [_to_out(db, p) for p in rows]


@router.post("", response_model=schemas.PersonOut, status_code=201)
def create_person(
    payload: schemas.PersonCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if len(payload.parent_ids) > 2:
        raise HTTPException(400, "A person can have at most 2 parents")

    # Validate parents exist AND belong to this user (or admin)
    for pid in payload.parent_ids:
        assert_owns_person(db, user, pid)

    person = models.Person(
        user_id=user.id,
        name=payload.name,
        gender=payload.gender,
        birth_date=payload.birth_date,
        death_date=payload.death_date,
        notes=payload.notes,
    )
    db.add(person)
    db.commit()
    db.refresh(person)

    for pid in payload.parent_ids:
        db.add(models.ParentChild(parent_id=pid, child_id=person.id))
    db.commit()
    return _to_out(db, person)


@router.get("", response_model=List[schemas.PersonOut])
def list_persons(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = (
        scope_persons(db.query(models.Person), user)
        .order_by(models.Person.id)
        .all()
    )
    return [_to_out(db, p) for p in rows]


@router.get("/{person_id}", response_model=schemas.PersonOut)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = assert_owns_person(db, user, person_id)
    return _to_out(db, person)


@router.patch("/{person_id}", response_model=schemas.PersonOut)
def update_person(
    person_id: int, payload: schemas.PersonUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = assert_owns_person(db, user, person_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return _to_out(db, person)


@router.delete("/{person_id}", status_code=204)
def delete_person(
    person_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = assert_owns_person(db, user, person_id)
    db.query(models.ParentChild).filter(
        (models.ParentChild.parent_id == person_id)
        | (models.ParentChild.child_id == person_id)
    ).delete()
    db.query(models.Union).filter(
        (models.Union.partner_a_id == person_id)
        | (models.Union.partner_b_id == person_id)
    ).delete()
    db.delete(person)
    db.commit()


@router.post("/{person_id}/parents", response_model=schemas.PersonOut)
def add_parent(
    person_id: int, link: schemas.ParentLink,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = assert_owns_person(db, user, person_id)
    parent = assert_owns_person(db, user, link.parent_id)
    if person_id == link.parent_id:
        raise HTTPException(400, "A person cannot be their own parent")

    parent_ancestors = ancestors_with_depth(db, link.parent_id)
    if person_id in parent_ancestors:
        raise HTTPException(400, "Cycle detected: this would make a person their own ancestor")

    existing_parents = get_parents(db, person_id)
    if link.parent_id in existing_parents:
        raise HTTPException(400, "This parent is already linked")
    if len(existing_parents) >= 2:
        raise HTTPException(400, "A person can have at most 2 parents")

    db.add(models.ParentChild(parent_id=link.parent_id, child_id=person_id))
    db.commit()
    return _to_out(db, person)


@router.delete("/{person_id}/parents/{parent_id}", status_code=204)
def remove_parent(
    person_id: int, parent_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    assert_owns_person(db, user, person_id)
    row = db.query(models.ParentChild).filter_by(
        parent_id=parent_id, child_id=person_id
    ).first()
    if not row:
        raise HTTPException(404, "Parent link not found")
    db.delete(row)
    db.commit()


@router.post("/{person_id}/spouses", response_model=schemas.PersonOut)
def add_spouse(
    person_id: int, link: schemas.SpouseLink,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person = assert_owns_person(db, user, person_id)
    assert_owns_person(db, user, link.spouse_id)
    if person_id == link.spouse_id:
        raise HTTPException(400, "A person cannot be their own spouse")

    a, b = sorted([person_id, link.spouse_id])
    existing = db.query(models.Union).filter_by(partner_a_id=a, partner_b_id=b).first()
    if existing:
        raise HTTPException(400, "These people are already linked as spouses")

    db.add(models.Union(partner_a_id=a, partner_b_id=b))
    db.commit()
    return _to_out(db, person)


@router.delete("/{person_id}/spouses/{spouse_id}", status_code=204)
def remove_spouse(
    person_id: int, spouse_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    assert_owns_person(db, user, person_id)
    a, b = sorted([person_id, spouse_id])
    row = db.query(models.Union).filter_by(partner_a_id=a, partner_b_id=b).first()
    if not row:
        raise HTTPException(404, "Spouse link not found")
    db.delete(row)
    db.commit()
