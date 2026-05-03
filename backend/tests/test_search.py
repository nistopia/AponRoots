"""Tests for the search endpoint."""
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


def make(client, name):
    r = client.post("/persons", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def test_search_substring_case_insensitive(client):
    make(client, "Alice Johnson")
    make(client, "Bob Smith")
    make(client, "Alicia Keys")

    r = client.get("/persons/search?q=ali")
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert "Alice Johnson" in names
    assert "Alicia Keys" in names
    assert "Bob Smith" not in names


def test_search_empty_returns_all(client):
    make(client, "Alice")
    make(client, "Bob")
    r = client.get("/persons/search?q=")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_search_no_match_returns_empty(client):
    make(client, "Alice")
    r = client.get("/persons/search?q=xyz")
    assert r.json() == []


def test_search_respects_limit(client):
    for i in range(5):
        make(client, f"Test {i}")
    r = client.get("/persons/search?q=test&limit=2")
    assert len(r.json()) == 2


def test_search_results_alphabetical(client):
    make(client, "Charlie")
    make(client, "Alice")
    make(client, "Bob")
    r = client.get("/persons/search?q=")
    names = [p["name"] for p in r.json()]
    assert names == ["Alice", "Bob", "Charlie"]
