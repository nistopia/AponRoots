"""Tests for the family network model: home page should show in-laws."""


def _signup(client, email):
    r = client.post("/auth/signup", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make(client, headers, name, gender=None, parents=None):
    r = client.post("/persons", headers=headers, json={
        "name": name, "gender": gender, "parent_ids": parents or [],
    })
    assert r.status_code == 201
    return r.json()["id"]


def test_mine_includes_spouse_added_by_other_user(client):
    """Husband owns his self-entry; wife adds herself and links her entry as
    his spouse. Husband's home (mine=true) should now include the wife."""
    h_husband = _signup(client, "husband@example.com")
    h_wife = _signup(client, "wife@example.com")

    husband = make(client, h_husband, "Husband", "M")
    wife = make(client, h_wife, "Wife", "F")
    # Wife links the marriage from her side
    r = client.post(f"/persons/{wife}/spouses", headers=h_wife, json={"spouse_id": husband})
    assert r.status_code == 200

    # Husband's home (mine=true) should now include both
    husband_view = client.get("/persons?mine=true", headers=h_husband).json()
    names = sorted(p["name"] for p in husband_view)
    assert names == ["Husband", "Wife"]


def test_mine_includes_in_laws_via_spouse(client):
    """Once linked as spouses, husband should see wife's parents in his network."""
    h_husband = _signup(client, "husband@example.com")
    h_wife = _signup(client, "wife@example.com")

    husband = make(client, h_husband, "Husband", "M")
    wife = make(client, h_wife, "Wife", "F")
    mil = make(client, h_wife, "Mother-in-law", "F")
    # Wife's mom is set on her record
    client.post(f"/persons/{wife}/parents", headers=h_wife, json={"parent_id": mil})
    client.post(f"/persons/{wife}/spouses", headers=h_wife, json={"spouse_id": husband})

    husband_view = client.get("/persons?mine=true", headers=h_husband).json()
    names = sorted(p["name"] for p in husband_view)
    assert names == ["Husband", "Mother-in-law", "Wife"]


def test_mine_includes_children_added_by_other_user(client):
    """Wife adds the kid with both parents; husband should see the kid in his network."""
    h_husband = _signup(client, "husband@example.com")
    h_wife = _signup(client, "wife@example.com")

    husband = make(client, h_husband, "Husband", "M")
    wife = make(client, h_wife, "Wife", "F")
    client.post(f"/persons/{wife}/spouses", headers=h_wife, json={"spouse_id": husband})

    # Wife creates the child with both parents
    child = client.post("/persons", headers=h_wife, json={
        "name": "Child", "parent_ids": [husband, wife],
    }).json()["id"]
    assert child

    husband_view = client.get("/persons?mine=true", headers=h_husband).json()
    names = sorted(p["name"] for p in husband_view)
    assert "Child" in names


def test_mine_excludes_unrelated_people(client):
    """Other users' unconnected people should NOT appear in your mine=true list."""
    h_alice = _signup(client, "alice@example.com")
    h_bob = _signup(client, "bob@example.com")

    make(client, h_alice, "Alice's Mom")
    make(client, h_bob, "Bob's Dad")

    alice_view = client.get("/persons?mine=true", headers=h_alice).json()
    names = [p["name"] for p in alice_view]
    assert names == ["Alice's Mom"]
    assert "Bob's Dad" not in names
