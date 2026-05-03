from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class Person(Base):
    __tablename__ = "persons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    gender = Column(String(1), nullable=True)  # 'M', 'F', 'X', or NULL
    birth_date = Column(Date, nullable=True)
    death_date = Column(Date, nullable=True)
    notes = Column(String, nullable=True)


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
