"""Tests for Google OAuth endpoint (with mocked Google token verification)."""

from unittest.mock import patch
import pytest


@pytest.fixture(autouse=True)
def google_client_id_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client-id")
    # Re-import to pick up env var
    import importlib
    from app.routers import auth
    importlib.reload(auth)


def _mock_id_info(email="alice@gmail.com", sub="google-uid-1", name="Alice"):
    return {
        "sub": sub,
        "email": email,
        "email_verified": True,
        "name": name,
    }


def test_google_signin_creates_new_user(client):
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=_mock_id_info()):
        r = client.post("/auth/google", json={"credential": "fake-token"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["email"] == "alice@gmail.com"
    assert body["user"]["name"] == "Alice"
    assert body["access_token"]


def test_google_signin_links_existing_email_password_account(client):
    # User signs up with email/password first
    client.post("/auth/signup", json={
        "email": "alice@gmail.com", "password": "secret123", "name": "Alice",
    })

    # Then signs in with Google using the same email -> should LINK, not duplicate
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=_mock_id_info()):
        r = client.post("/auth/google", json={"credential": "fake-token"})
    assert r.status_code == 200
    user_id_first = r.json()["user"]["id"]

    # Second Google sign-in -> finds via google_sub and returns same user
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=_mock_id_info()):
        r2 = client.post("/auth/google", json={"credential": "fake-token"})
    assert r2.json()["user"]["id"] == user_id_first


def test_google_signin_rejects_unverified_email(client):
    bad = _mock_id_info()
    bad["email_verified"] = False
    with patch("google.oauth2.id_token.verify_oauth2_token", return_value=bad):
        r = client.post("/auth/google", json={"credential": "fake-token"})
    assert r.status_code == 401


def test_google_signin_rejects_invalid_token(client):
    with patch(
        "google.oauth2.id_token.verify_oauth2_token",
        side_effect=ValueError("Invalid token signature"),
    ):
        r = client.post("/auth/google", json={"credential": "fake-token"})
    assert r.status_code == 401
