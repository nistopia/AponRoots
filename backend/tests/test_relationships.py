"""
End-to-end tests against a real SQLite DB to verify the relationship algorithm.

Tree built:

         Grandpa(M) - Grandma(F)
              |
       +------+------+
       |             |
     Dad(M)        Aunt(F) - Uncle-in-law(M)*  (* not modeled, see note)
       |             |
   +---+---+        Cousin(F)
   |       |
  Me(M)  Sister(F)
   |
  Son(M)

Notes:
- We only model blood lines (parent-child) for now.
- Aunt's child "Cousin" is added with Aunt as the only parent for simplicity.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def make(client, name, gender=None, parents=None):
    r = client.post("/persons", json={
        "name": name,
        "gender": gender,
        "parent_ids": parents or [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def rel(client, a, b):
    r = client.get(f"/relationships?a={a}&b={b}")
    assert r.status_code == 200, r.text
    return r.json()["relationship"]


def test_basic_family_relationships(client):
    grandpa = make(client, "Grandpa", "M")
    grandma = make(client, "Grandma", "F")
    dad = make(client, "Dad", "M", [grandpa, grandma])
    aunt = make(client, "Aunt", "F", [grandpa, grandma])
    me = make(client, "Me", "M", [dad])
    sister = make(client, "Sister", "F", [dad])
    son = make(client, "Son", "M", [me])
    cousin = make(client, "Cousin", "F", [aunt])

    # Direct line
    assert "father" in rel(client, me, dad)
    assert "mother" in rel(client, me, grandma)  # actually grandmother, check below
    assert "grandfather" in rel(client, me, grandpa)
    assert "grandmother" in rel(client, me, grandma)
    assert "son" in rel(client, me, son)
    assert "grandson" in rel(client, dad, son)

    # Siblings
    assert "sister" in rel(client, me, sister)
    assert "brother" in rel(client, sister, me)

    # Aunts / uncles
    assert "aunt" in rel(client, me, aunt)
    assert "nephew" in rel(client, aunt, me)
    assert "niece" in rel(client, aunt, sister)

    # First cousin
    assert "1st cousin" in rel(client, me, cousin)
    assert "1st cousin" in rel(client, cousin, me)

    # First cousin once removed (Son <-> Cousin)
    assert "1st cousin once removed" in rel(client, son, cousin)


def test_self_and_unrelated(client):
    a = make(client, "Alice", "F")
    b = make(client, "Bob", "M")  # no link
    assert rel(client, a, a) == "self"
    assert "no known blood relationship" in rel(client, a, b)


def test_great_grandparent_chain(client):
    gg = make(client, "GG", "F")
    g = make(client, "G", "F", [gg])
    p = make(client, "P", "F", [g])
    me = make(client, "Me", "M", [p])
    assert "great-grandmother" in rel(client, me, gg)
    assert "great-grandson" in rel(client, gg, me)


def test_second_cousin(client):
    # Common great-grandparent
    gg = make(client, "GG", "M")
    g1 = make(client, "G1", "M", [gg])
    g2 = make(client, "G2", "F", [gg])
    p1 = make(client, "P1", "M", [g1])
    p2 = make(client, "P2", "F", [g2])
    a = make(client, "A", "M", [p1])
    b = make(client, "B", "F", [p2])
    assert "2nd cousin" in rel(client, a, b)


def test_cycle_prevention(client):
    a = make(client, "A", "M")
    b = make(client, "B", "M", [a])  # a is parent of b
    # Try to make a a child of b -> cycle
    r = client.post(f"/persons/{a}/parents", json={"parent_id": b})
    assert r.status_code == 400


def test_max_two_parents(client):
    p1 = make(client, "P1", "M")
    p2 = make(client, "P2", "F")
    p3 = make(client, "P3", "F")
    child = make(client, "Child", "M", [p1, p2])
    r = client.post(f"/persons/{child}/parents", json={"parent_id": p3})
    assert r.status_code == 400
