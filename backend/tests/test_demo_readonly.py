"""Demo user is read-only: any POST/PATCH/PUT/DELETE returns 403."""


def _signup(client, email, password="secret123", name="Demo User"):
    r = client.post(
        "/auth/signup",
        json={"email": email, "password": password, "name": name},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user"]


def test_demo_user_can_login_and_read(client):
    headers, _ = _signup(client, "demo@aponroots.com")
    # GET /auth/me must succeed
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "demo@aponroots.com"
    # GET /persons must succeed (empty list)
    r = client.get("/persons", headers=headers)
    assert r.status_code == 200


def test_demo_user_cannot_create_persons(client):
    headers, _ = _signup(client, "demo@aponroots.com")
    r = client.post(
        "/persons",
        headers=headers,
        json={"name": "Trying to vandalize", "parent_ids": []},
    )
    assert r.status_code == 403
    assert "demo account is read-only" in r.json()["detail"].lower()


def test_demo_user_cannot_delete_persons(client):
    # Have a regular user create a person, then have demo try to delete it.
    alice_headers, _ = _signup(client, "alice@example.com")
    r = client.post(
        "/persons",
        headers=alice_headers,
        json={"name": "Alice's mom", "parent_ids": []},
    )
    pid = r.json()["id"]

    demo_headers, _ = _signup(client, "demo@aponroots.com")
    r = client.delete(f"/persons/{pid}", headers=demo_headers)
    assert r.status_code == 403


def test_demo_user_cannot_change_password(client):
    headers, _ = _signup(client, "demo@aponroots.com")
    r = client.put(
        "/auth/me/password",
        headers=headers,
        json={"old_password": "secret123", "new_password": "hijacked!"},
    )
    assert r.status_code == 403


def test_regular_user_can_still_mutate(client, auth_client):
    """Sanity: the guard only fires for demo@aponroots.com."""
    _, headers, _ = auth_client
    r = client.post(
        "/persons",
        headers=headers,
        json={"name": "Regular Person", "parent_ids": []},
    )
    assert r.status_code == 201
