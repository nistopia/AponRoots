from datetime import date
from typing import Optional, List
from pydantic import BaseModel, Field


class PersonBase(BaseModel):
    name: str
    gender: Optional[str] = Field(default=None, pattern="^[MFX]$")
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    notes: Optional[str] = None


class PersonCreate(PersonBase):
    parent_ids: List[int] = Field(default_factory=list, max_length=2)


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = Field(default=None, pattern="^[MFX]$")
    birth_date: Optional[date] = None
    death_date: Optional[date] = None
    notes: Optional[str] = None


class PersonOut(PersonBase):
    id: int
    parent_ids: List[int] = []
    children_ids: List[int] = []
    spouse_ids: List[int] = []

    class Config:
        from_attributes = True


class ParentLink(BaseModel):
    parent_id: int


class SpouseLink(BaseModel):
    spouse_id: int


class RelationshipResult(BaseModel):
    person_a_id: int
    person_b_id: int
    person_a_name: str
    person_b_name: str
    relationship: str
    common_ancestor_id: Optional[int] = None
    common_ancestor_name: Optional[str] = None
    distance_a: Optional[int] = None
    distance_b: Optional[int] = None
    path: List[int] = []  # for highlighting in UI
