from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..relationship import (
    ancestors_with_depth,
    find_lca,
    name_relationship,
    build_relationship_path,
)

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("", response_model=schemas.RelationshipResult)
def find_relationship(a: int, b: int, db: Session = Depends(get_db)):
    person_a = db.get(models.Person, a)
    person_b = db.get(models.Person, b)
    if not person_a or not person_b:
        raise HTTPException(404, "One or both persons not found")

    if a == b:
        return schemas.RelationshipResult(
            person_a_id=a,
            person_b_id=b,
            person_a_name=person_a.name,
            person_b_name=person_b.name,
            relationship="self",
            common_ancestor_id=a,
            common_ancestor_name=person_a.name,
            distance_a=0,
            distance_b=0,
            path=[a],
        )

    a_anc = ancestors_with_depth(db, a)
    b_anc = ancestors_with_depth(db, b)
    lca_info = find_lca(a_anc, b_anc)

    if lca_info is None:
        return schemas.RelationshipResult(
            person_a_id=a,
            person_b_id=b,
            person_a_name=person_a.name,
            person_b_name=person_b.name,
            relationship="no known blood relationship",
        )

    lca_id, da, dbg = lca_info
    label = name_relationship(da, dbg, person_b.gender)
    lca_person = db.get(models.Person, lca_id)
    path = build_relationship_path(db, a, b, lca_id)

    return schemas.RelationshipResult(
        person_a_id=a,
        person_b_id=b,
        person_a_name=person_a.name,
        person_b_name=person_b.name,
        relationship=f"{person_b.name} is {person_a.name}'s {label}",
        common_ancestor_id=lca_id,
        common_ancestor_name=lca_person.name if lca_person else None,
        distance_a=da,
        distance_b=dbg,
        path=path,
    )
