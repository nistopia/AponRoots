from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)  # NULL for OAuth-only users
    name = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False, nullable=False)
    google_sub = Column(String, unique=True, nullable=True, index=True)  # Google user id
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PasswordResetToken(Base):
    """One-time password reset tokens. Stores a sha256 hash, never the raw token."""

    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SubtreeGrant(Base):
    """Grants `grantee_user_id` edit access to `root_person_id` and all of
    its blood descendants (dynamic — computed via parent_child edges at
    request time, so new descendants added later are auto-included)."""

    __tablename__ = "subtree_grants"
    __table_args__ = (
        UniqueConstraint("root_person_id", "grantee_user_id", name="uq_grant_root_grantee"),
    )

    id = Column(Integer, primary_key=True, index=True)
    root_person_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True)
    grantee_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    gender = Column(String(1), nullable=True)  # 'M', 'F', 'X', or NULL
    birth_date = Column(Date, nullable=True)
    death_date = Column(Date, nullable=True)
    notes = Column(String, nullable=True)
    # Profile fields (added in v0.3)
    photo_url = Column(String, nullable=True)
    birthplace = Column(String, nullable=True)
    current_location = Column(String, nullable=True)
    occupation = Column(String, nullable=True)


class ParentChild(Base):
    """Edge: parent_id is the parent of child_id."""

    __tablename__ = "parent_child"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    child_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String, default="biological")  # biological | adoptive | step

    __table_args__ = (
        UniqueConstraint("parent_id", "child_id", name="uq_parent_child"),
    )

    parent = relationship("Person", foreign_keys=[parent_id])
    child = relationship("Person", foreign_keys=[child_id])


class Union(Base):
    """Spouse / partner link. Stored as an unordered pair (always partner_a_id < partner_b_id)."""

    __tablename__ = "unions"

    id = Column(Integer, primary_key=True, index=True)
    partner_a_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    partner_b_id = Column(Integer, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    union_type = Column(String, default="marriage")  # marriage | partnership | divorced

    __table_args__ = (
        UniqueConstraint("partner_a_id", "partner_b_id", name="uq_union_pair"),
        CheckConstraint("partner_a_id < partner_b_id", name="ck_union_ordered"),
    )
