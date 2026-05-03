from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user
from ..relationship import (
    ancestors_with_depth,
    find_lca,
    find_in_law,
    get_spouses,
    name_relationship,
    build_relationship_path,
)
from ..scope import get_visible_person

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("", response_model=schemas.RelationshipResult)
def find_relationship(
    a: int, b: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    person_a = get_visible_person(db, user, a)
    person_b = get_visible_person(db, user, b)

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
            path_edges=[],
            via="self",
        )

    a_anc = ancestors_with_depth(db, a)
    b_anc = ancestors_with_depth(db, b)
    lca_info = find_lca(a_anc, b_anc)

    # 1) Direct blood relationship?
    if lca_info is not None:
        lca_id, da, dbg = lca_info
        label = name_relationship(da, dbg, person_b.gender)
        lca_person = db.get(models.Person, lca_id)
        path = build_relationship_path(db, a, b, lca_id)
        edges = ["parent"] * da + ["child"] * dbg
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
            path_edges=edges,
            via="blood",
        )

    # 2) In-law via spouse links?
    in_law = find_in_law(db, a, b, person_b.gender)
    if in_law is not None:
        lca_id = in_law.get("lca_id")
        lca_person = db.get(models.Person, lca_id) if lca_id else None
        return schemas.RelationshipResult(
            person_a_id=a,
            person_b_id=b,
            person_a_name=person_a.name,
            person_b_name=person_b.name,
            relationship=f"{person_b.name} is {person_a.name}'s {in_law['label']}",
            common_ancestor_id=lca_id,
            common_ancestor_name=lca_person.name if lca_person else None,
            distance_a=in_law["distance_a"],
            distance_b=in_law["distance_b"],
            path=in_law["path"],
            path_edges=in_law["path_edges"],
            via=in_law["via"],
        )

    # 3) Spouses themselves
    if b in get_spouses(db, a):
        return schemas.RelationshipResult(
            person_a_id=a,
            person_b_id=b,
            person_a_name=person_a.name,
            person_b_name=person_b.name,
            relationship=f"{person_b.name} is {person_a.name}'s spouse",
            path=[a, b],
            path_edges=["spouse"],
            via="spouse",
        )

    return schemas.RelationshipResult(
        person_a_id=a,
        person_b_id=b,
        person_a_name=person_a.name,
        person_b_name=person_b.name,
        relationship="no known relationship",
        via=None,
    )
