"""Tests for SubtreeGrant — sharing edit access on a person and descendants."""


def _signup(client, email, password="secret123", name=None):
    r = client.post("/auth/signup", json={"email": email, "password": password, "name": name})
    assert r.status_code == 201
    return r.json()["access_token"], r.json()["user"]["id"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _create_person(client, token, name, parent_ids=None):
    payload = {"name": name, "parent_ids": parent_ids or []}
    r = client.post("/persons", json=payload, headers=_auth(token))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_grant_lets_grantee_edit_root_and_descendants(client):
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")

    # Alice's family: grandma → mom → me → kid
    grandma = _create_person(client, alice_token, "Grandma")
    mom = _create_person(client, alice_token, "Mom", parent_ids=[grandma])
    me = _create_person(client, alice_token, "Me", parent_ids=[mom])
    kid = _create_person(client, alice_token, "Kid", parent_ids=[me])
    # An unrelated branch Alice owns but doesn't share
    uncle = _create_person(client, alice_token, "Uncle", parent_ids=[grandma])
    cousin = _create_person(client, alice_token, "Cousin", parent_ids=[uncle])

    # Bob can read but cannot edit anyone yet
    r = client.patch(f"/persons/{me}", json={"notes": "hi"}, headers=_auth(bob_token))
    assert r.status_code == 403

    # Alice grants Bob edit on Mom's subtree
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 201
    grant_id = r.json()["id"]
    assert r.json()["grantee_email"] == "bob@example.com"
    assert r.json()["root_person_name"] == "Mom"

    # Bob can now edit Mom, Me, Kid (all descendants of Mom)
    for pid in (mom, me, kid):
        r = client.patch(f"/persons/{pid}", json={"notes": "edited"}, headers=_auth(bob_token))
        assert r.status_code == 200, f"expected 200 for {pid}, got {r.status_code}"

    # Bob still cannot edit Grandma (ancestor of Mom — not in Mom's subtree)
    r = client.patch(f"/persons/{grandma}", json={"notes": "x"}, headers=_auth(bob_token))
    assert r.status_code == 403
    # Bob still cannot edit Uncle / Cousin (different branch)
    for pid in (uncle, cousin):
        r = client.patch(f"/persons/{pid}", json={"notes": "x"}, headers=_auth(bob_token))
        assert r.status_code == 403

    # can_edit field on PersonOut reflects this
    r = client.get(f"/persons/{me}", headers=_auth(bob_token))
    assert r.json()["can_edit"] is True
    r = client.get(f"/persons/{grandma}", headers=_auth(bob_token))
    assert r.json()["can_edit"] is False

    # Revocation
    r = client.delete(f"/persons/{mom}/grants/{grant_id}", headers=_auth(alice_token))
    assert r.status_code == 204
    r = client.patch(f"/persons/{me}", json={"notes": "x"}, headers=_auth(bob_token))
    assert r.status_code == 403


def test_grants_are_dynamic_new_descendants_inherit_access(client):
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, bob_id = _signup(client, "bob@example.com")

    mom = _create_person(client, alice_token, "Mom")
    client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )

    # Alice adds a NEW descendant after the grant — Bob should auto-inherit access
    new_kid = _create_person(client, alice_token, "NewKid", parent_ids=[mom])
    r = client.patch(f"/persons/{new_kid}", json={"notes": "edit"}, headers=_auth(bob_token))
    assert r.status_code == 200


def test_only_owner_or_admin_can_create_grant(client):
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")
    carol_token, _ = _signup(client, "carol@example.com")

    mom = _create_person(client, alice_token, "Mom")

    # Bob can't grant — he doesn't own the entry
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "carol@example.com"},
        headers=_auth(bob_token),
    )
    assert r.status_code == 403

    # Even after Alice grants Bob edit, Bob still can't re-share
    client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "carol@example.com"},
        headers=_auth(bob_token),
    )
    assert r.status_code == 403


def test_grant_to_unknown_email_404(client):
    alice_token, _ = _signup(client, "alice@example.com")
    mom = _create_person(client, alice_token, "Mom")
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "ghost@example.com"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 404


def test_grant_to_self_or_existing_owner_rejected(client):
    alice_token, _ = _signup(client, "alice@example.com")
    mom = _create_person(client, alice_token, "Mom")
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "alice@example.com"},
        headers=_auth(alice_token),
    )
    # Alice IS the owner — granting to herself is a no-op rejection
    assert r.status_code == 400


def test_duplicate_grant_rejected(client):
    alice_token, _ = _signup(client, "alice@example.com")
    _signup(client, "bob@example.com")
    mom = _create_person(client, alice_token, "Mom")
    payload = {"grantee_email": "bob@example.com"}
    r = client.post(f"/persons/{mom}/grants", json=payload, headers=_auth(alice_token))
    assert r.status_code == 201
    r = client.post(f"/persons/{mom}/grants", json=payload, headers=_auth(alice_token))
    assert r.status_code == 400


def test_list_grants_owner_only(client):
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")
    mom = _create_person(client, alice_token, "Mom")
    client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )
    # Owner sees it
    r = client.get(f"/persons/{mom}/grants", headers=_auth(alice_token))
    assert r.status_code == 200
    assert len(r.json()) == 1
    # Grantee cannot list grants on someone else's entry
    r = client.get(f"/persons/{mom}/grants", headers=_auth(bob_token))
    assert r.status_code == 403


def test_admin_can_grant_on_anyones_entry(client):
    # The first signup becomes admin only via DB flip; emulate by querying the
    # admin via dependency. Instead, signup two users and mark one admin via DB.
    from app import models
    from app.database import get_db
    from app.main import app

    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")
    carol_token, _ = _signup(client, "carol@example.com")

    override = app.dependency_overrides[get_db]
    db = next(override())
    try:
        bob = db.query(models.User).filter(models.User.email == "bob@example.com").one()
        bob.is_admin = True
        db.commit()
    finally:
        db.close()

    # Re-login as bob to refresh JWT with admin claim
    r = client.post("/auth/login", json={"email": "bob@example.com", "password": "secret123"})
    bob_token = r.json()["access_token"]

    mom = _create_person(client, alice_token, "Mom")
    # Bob (admin) grants Carol access to Alice's subtree
    r = client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "carol@example.com"},
        headers=_auth(bob_token),
    )
    assert r.status_code == 201
    r = client.patch(f"/persons/{mom}", json={"notes": "ok"}, headers=_auth(carol_token))
    assert r.status_code == 200


def test_revoke_unknown_grant_404(client):
    alice_token, _ = _signup(client, "alice@example.com")
    mom = _create_person(client, alice_token, "Mom")
    r = client.delete(f"/persons/{mom}/grants/9999", headers=_auth(alice_token))
    assert r.status_code == 404


def test_grantee_can_add_child_to_subtree_member(client):
    """A grantee should be able to add a new child under any descendant of
    the grant root — verifies create_person allows them and the new child
    becomes editable for them too (dynamic grant)."""
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")

    mom = _create_person(client, alice_token, "Mom")
    me = _create_person(client, alice_token, "Me", parent_ids=[mom])

    client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )

    # Bob creates a child of Me. The new person is owned by Bob, so he edits it.
    r = client.post(
        "/persons",
        json={"name": "BobsKid", "parent_ids": [me]},
        headers=_auth(bob_token),
    )
    assert r.status_code == 201
    bobs_kid = r.json()["id"]

    r = client.patch(f"/persons/{bobs_kid}", json={"notes": "hi"}, headers=_auth(bob_token))
    assert r.status_code == 200


def test_grantee_sees_subtree_in_mine_listing(client):
    """A grantee with no owned entries should see the granted subtree
    (and its connected network) when listing /persons?mine=true."""
    alice_token, _ = _signup(client, "alice@example.com")
    bob_token, _ = _signup(client, "bob@example.com")

    grandma = _create_person(client, alice_token, "Grandma")
    mom = _create_person(client, alice_token, "Mom", parent_ids=[grandma])
    me = _create_person(client, alice_token, "Me", parent_ids=[mom])
    kid = _create_person(client, alice_token, "Kid", parent_ids=[me])
    uncle = _create_person(client, alice_token, "Uncle", parent_ids=[grandma])

    # Bob's home page is empty before any grant
    r = client.get("/persons?mine=true", headers=_auth(bob_token))
    assert r.status_code == 200
    assert r.json() == []

    # Alice grants Bob access to Mom's subtree
    client.post(
        f"/persons/{mom}/grants",
        json={"grantee_email": "bob@example.com"},
        headers=_auth(alice_token),
    )

    # Bob's home page now includes Mom + descendants. The BFS through
    # parent/spouse edges expands the network further: Grandma (Mom's
    # parent) is reachable via Mom -> parent edge, and Uncle is reachable
    # via Grandma -> child edge. This matches existing owner-network
    # behavior — once you're "in" someone's branch, you see the people
    # connected to them.
    r = client.get("/persons?mine=true", headers=_auth(bob_token))
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert mom in ids
    assert me in ids
    assert kid in ids
    # Connected network expansion
    assert grandma in ids
    assert uncle in ids

    # can_edit on listing reflects grant scope: only mom, me, kid editable
    by_id = {p["id"]: p for p in r.json()}
    assert by_id[mom]["can_edit"] is True
    assert by_id[me]["can_edit"] is True
    assert by_id[kid]["can_edit"] is True
    assert by_id[grandma]["can_edit"] is False
    assert by_id[uncle]["can_edit"] is False
