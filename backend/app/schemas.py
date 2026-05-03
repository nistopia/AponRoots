from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------

class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    name: Optional[str] = None
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Persons ----------

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
    owner_id: Optional[int] = None
    can_edit: bool = False

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
