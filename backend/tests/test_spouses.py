"""Tests for spouse/union endpoints."""
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
        "name": name, "gender": gender, "parent_ids": parents or [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_add_and_list_spouse(client):
    a = make(client, "Alice", "F")
    b = make(client, "Bob", "M")
    r = client.post(f"/persons/{a}/spouses", json={"spouse_id": b})
    assert r.status_code == 200, r.text
    assert b in r.json()["spouse_ids"]

    # Symmetric: B should see A as spouse
    r2 = client.get(f"/persons/{b}")
    assert a in r2.json()["spouse_ids"]


def test_cannot_be_own_spouse(client):
    a = make(client, "Alice", "F")
    r = client.post(f"/persons/{a}/spouses", json={"spouse_id": a})
    assert r.status_code == 400


def test_no_duplicate_spouse(client):
    a = make(client, "Alice", "F")
    b = make(client, "Bob", "M")
    client.post(f"/persons/{a}/spouses", json={"spouse_id": b})
    r = client.post(f"/persons/{a}/spouses", json={"spouse_id": b})
    assert r.status_code == 400
    # Also blocked from the other direction
    r2 = client.post(f"/persons/{b}/spouses", json={"spouse_id": a})
    assert r2.status_code == 400


def test_remove_spouse(client):
    a = make(client, "Alice", "F")
    b = make(client, "Bob", "M")
    client.post(f"/persons/{a}/spouses", json={"spouse_id": b})
    r = client.delete(f"/persons/{a}/spouses/{b}")
    assert r.status_code == 204
    r2 = client.get(f"/persons/{a}")
    assert r2.json()["spouse_ids"] == []


def test_multiple_spouses_allowed(client):
    """A person can have several spouses across time (e.g., remarriage)."""
    a = make(client, "Alice", "F")
    b = make(client, "Bob", "M")
    c = make(client, "Carl", "M")
    client.post(f"/persons/{a}/spouses", json={"spouse_id": b})
    r = client.post(f"/persons/{a}/spouses", json={"spouse_id": c})
    assert r.status_code == 200
    spouses = client.get(f"/persons/{a}").json()["spouse_ids"]
    assert sorted(spouses) == sorted([b, c])
