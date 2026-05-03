from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..relationship import get_parents, get_children, ancestors_with_depth

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
    )


@router.post("", response_model=schemas.PersonOut, status_code=201)
def create_person(payload: schemas.PersonCreate, db: Session = Depends(get_db)):
    if len(payload.parent_ids) > 2:
        raise HTTPException(400, "A person can have at most 2 parents")

    # Validate parents exist
    for pid in payload.parent_ids:
        if not db.get(models.Person, pid):
            raise HTTPException(404, f"Parent id {pid} not found")

    person = models.Person(
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
def list_persons(db: Session = Depends(get_db)):
    return [_to_out(db, p) for p in db.query(models.Person).order_by(models.Person.id).all()]


@router.get("/{person_id}", response_model=schemas.PersonOut)
def get_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    return _to_out(db, person)


@router.patch("/{person_id}", response_model=schemas.PersonOut)
def update_person(person_id: int, payload: schemas.PersonUpdate, db: Session = Depends(get_db)):
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(person, field, value)
    db.commit()
    db.refresh(person)
    return _to_out(db, person)


@router.delete("/{person_id}", status_code=204)
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(models.Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    db.query(models.ParentChild).filter(
        (models.ParentChild.parent_id == person_id)
        | (models.ParentChild.child_id == person_id)
    ).delete()
    db.delete(person)
    db.commit()


@router.post("/{person_id}/parents", response_model=schemas.PersonOut)
def add_parent(person_id: int, link: schemas.ParentLink, db: Session = Depends(get_db)):
    person = db.get(models.Person, person_id)
    parent = db.get(models.Person, link.parent_id)
    if not person or not parent:
        raise HTTPException(404, "Person or parent not found")
    if person_id == link.parent_id:
        raise HTTPException(400, "A person cannot be their own parent")

    # Cycle check: parent must NOT have person as ancestor
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
def remove_parent(person_id: int, parent_id: int, db: Session = Depends(get_db)):
    row = db.query(models.ParentChild).filter_by(
        parent_id=parent_id, child_id=person_id
    ).first()
    if not row:
        raise HTTPException(404, "Parent link not found")
    db.delete(row)
    db.commit()
