"""Common test fixtures: client, auth helpers."""
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


@pytest.fixture()
def auth_client(client):
    """A client already signed up + logged in as a regular user.
    Returns (client, headers, user_dict)."""
    r = client.post("/auth/signup", json={
        "email": "alice@example.com",
        "password": "secret123",
        "name": "Alice",
    })
    assert r.status_code == 201
    body = r.json()
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    return client, headers, body["user"]
