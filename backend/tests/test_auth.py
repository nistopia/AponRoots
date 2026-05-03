"""Auth-specific tests: signup, login, isolation between users, admin powers."""


def test_signup_login_me(client):
    # Signup
    r = client.post("/auth/signup", json={
        "email": "alice@example.com", "password": "secret123", "name": "Alice",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["is_admin"] is False
    token = body["access_token"]

    # /auth/me with the token
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "alice@example.com"

    # Login again with same credentials
    r = client.post("/auth/login", json={
        "email": "alice@example.com", "password": "secret123",
    })
    assert r.status_code == 200


def test_duplicate_email_blocked(client):
    client.post("/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    r = client.post("/auth/signup", json={"email": "a@b.com", "password": "another1"})
    assert r.status_code == 400


def test_wrong_password_rejected(client):
    client.post("/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    r = client.post("/auth/login", json={"email": "a@b.com", "password": "wrong!!"})
    assert r.status_code == 401


def test_endpoints_require_auth(client):
    assert client.get("/persons").status_code == 401
    assert client.post("/persons", json={"name": "X"}).status_code == 401
    assert client.get("/relationships?a=1&b=2").status_code == 401


def _signup(client, email):
    r = client.post("/auth/signup", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_user_isolation(client):
    """Two users see only their own people."""
    h_alice = _signup(client, "alice@example.com")
    h_bob = _signup(client, "bob@example.com")

    client.post("/persons", headers=h_alice, json={"name": "Alice's Mom"})
    client.post("/persons", headers=h_bob, json={"name": "Bob's Dad"})

    alice_list = client.get("/persons", headers=h_alice).json()
    bob_list = client.get("/persons", headers=h_bob).json()

    assert [p["name"] for p in alice_list] == ["Alice's Mom"]
    assert [p["name"] for p in bob_list] == ["Bob's Dad"]


def test_cannot_access_other_users_person(client):
    h_alice = _signup(client, "alice@example.com")
    h_bob = _signup(client, "bob@example.com")

    pid = client.post("/persons", headers=h_alice, json={"name": "Secret"}).json()["id"]
    r = client.get(f"/persons/{pid}", headers=h_bob)
    assert r.status_code == 404  # 404 not 403 to avoid leaking existence


def test_admin_sees_everyones_data(client):
    """Admin user should see all persons across all users."""
    from app.database import SessionLocal
    from app import models
    from app.security import hash_password, create_access_token

    h_alice = _signup(client, "alice@example.com")
    client.post("/persons", headers=h_alice, json={"name": "Alice's Person"})

    # Manually create an admin user (signup endpoint doesn't allow self-admin)
    # We need to use the same overridden DB session as the test client.
    from app.main import app
    from app.database import get_db
    db_dep = app.dependency_overrides[get_db]
    db = next(db_dep())
    try:
        admin = models.User(
            email="admin@example.com",
            password_hash=hash_password("adminpass"),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.id
    finally:
        db.close()

    token = create_access_token(admin_id, is_admin=True)
    h_admin = {"Authorization": f"Bearer {token}"}

    admin_list = client.get("/persons", headers=h_admin).json()
    names = [p["name"] for p in admin_list]
    assert "Alice's Person" in names
