"""Tests for password change / forgot / reset flows."""

import re
from datetime import datetime, timedelta


def _signup(client, email="alice@example.com", password="secret123"):
    r = client.post("/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 201
    return r.json()["access_token"]


def _last_reset_link_from_caplog(caplog):
    """Pull the issued reset link out of the auth router's log message."""
    for rec in caplog.records:
        m = re.search(r"link=(\S+)", rec.getMessage())
        if m:
            return m.group(1)
    return None


def test_change_password_happy_path(client):
    token = _signup(client, password="oldpass1")
    r = client.put(
        "/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "oldpass1", "new_password": "newpass2"},
    )
    assert r.status_code == 200

    # Old password no longer works
    r = client.post("/auth/login", json={"email": "alice@example.com", "password": "oldpass1"})
    assert r.status_code == 401
    # New password works
    r = client.post("/auth/login", json={"email": "alice@example.com", "password": "newpass2"})
    assert r.status_code == 200


def test_change_password_wrong_old(client):
    token = _signup(client, password="oldpass1")
    r = client.put(
        "/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "WRONG", "new_password": "newpass2"},
    )
    assert r.status_code == 401


def test_change_password_same_as_old(client):
    token = _signup(client, password="oldpass1")
    r = client.put(
        "/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "oldpass1", "new_password": "oldpass1"},
    )
    assert r.status_code == 400


def test_change_password_requires_auth(client):
    r = client.put(
        "/auth/me/password",
        json={"old_password": "x", "new_password": "y"},
    )
    assert r.status_code == 401


def test_forgot_password_unknown_email_returns_generic(client):
    r = client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert r.status_code == 200
    assert "registered" in r.json()["detail"]


def test_forgot_then_reset_full_flow(client, caplog):
    _signup(client, email="bob@example.com", password="oldpass1")

    with caplog.at_level("INFO", logger="app.routers.auth"):
        r = client.post("/auth/forgot-password", json={"email": "bob@example.com"})
        assert r.status_code == 200
        link = _last_reset_link_from_caplog(caplog)
    assert link, "Expected reset link in logs"
    raw_token = link.split("token=")[-1]

    # Reset the password
    r = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "brandnew1"},
    )
    assert r.status_code == 200
    assert "access_token" in r.json()  # logged-in token

    # Old password no longer works; new one does
    r = client.post("/auth/login", json={"email": "bob@example.com", "password": "oldpass1"})
    assert r.status_code == 401
    r = client.post("/auth/login", json={"email": "bob@example.com", "password": "brandnew1"})
    assert r.status_code == 200


def test_reset_token_single_use(client, caplog):
    _signup(client, email="bob@example.com", password="oldpass1")
    with caplog.at_level("INFO", logger="app.routers.auth"):
        client.post("/auth/forgot-password", json={"email": "bob@example.com"})
        link = _last_reset_link_from_caplog(caplog)
    raw_token = link.split("token=")[-1]

    r = client.post("/auth/reset-password", json={"token": raw_token, "new_password": "first11"})
    assert r.status_code == 200
    # Reuse must fail
    r = client.post("/auth/reset-password", json={"token": raw_token, "new_password": "second22"})
    assert r.status_code == 400


def test_reset_invalid_token(client):
    r = client.post("/auth/reset-password", json={"token": "not-a-real-token", "new_password": "whatever1"})
    assert r.status_code == 400


def test_reset_expired_token(client, caplog):
    """Manually expire a token in the DB and confirm it's rejected."""
    from app.database import get_db
    from app import models
    from app.main import app

    _signup(client, email="bob@example.com", password="oldpass1")
    with caplog.at_level("INFO", logger="app.routers.auth"):
        client.post("/auth/forgot-password", json={"email": "bob@example.com"})
        link = _last_reset_link_from_caplog(caplog)
    raw_token = link.split("token=")[-1]

    # Backdate the token
    override = app.dependency_overrides[get_db]
    db = next(override())
    try:
        row = db.query(models.PasswordResetToken).first()
        row.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()
    finally:
        db.close()

    r = client.post("/auth/reset-password", json={"token": raw_token, "new_password": "whatever1"})
    assert r.status_code == 400


def test_change_password_invalidates_outstanding_reset_tokens(client, caplog):
    token = _signup(client, password="oldpass1")
    with caplog.at_level("INFO", logger="app.routers.auth"):
        client.post("/auth/forgot-password", json={"email": "alice@example.com"})
        link = _last_reset_link_from_caplog(caplog)
    raw_token = link.split("token=")[-1]

    # Change password normally
    r = client.put(
        "/auth/me/password",
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "oldpass1", "new_password": "newpass2"},
    )
    assert r.status_code == 200

    # The previously-issued reset link must no longer work
    r = client.post(
        "/auth/reset-password",
        json={"token": raw_token, "new_password": "tryreset1"},
    )
    assert r.status_code == 400
