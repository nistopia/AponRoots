"""Tests for spouse/union endpoints."""


def make(client, headers, name, gender=None, parents=None):
    r = client.post("/persons", headers=headers, json={
        "name": name, "gender": gender, "parent_ids": parents or [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_add_and_list_spouse(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    b = make(client, headers, "Bob", "M")
    r = client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    assert r.status_code == 200
    assert b in r.json()["spouse_ids"]
    r2 = client.get(f"/persons/{b}", headers=headers)
    assert a in r2.json()["spouse_ids"]


def test_cannot_be_own_spouse(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    r = client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": a})
    assert r.status_code == 400


def test_no_duplicate_spouse(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    b = make(client, headers, "Bob", "M")
    client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    r = client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    assert r.status_code == 400
    r2 = client.post(f"/persons/{b}/spouses", headers=headers, json={"spouse_id": a})
    assert r2.status_code == 400


def test_remove_spouse(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    b = make(client, headers, "Bob", "M")
    client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    r = client.delete(f"/persons/{a}/spouses/{b}", headers=headers)
    assert r.status_code == 204
    r2 = client.get(f"/persons/{a}", headers=headers)
    assert r2.json()["spouse_ids"] == []


def test_multiple_spouses_allowed(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    b = make(client, headers, "Bob", "M")
    c = make(client, headers, "Carl", "M")
    client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    r = client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": c})
    assert r.status_code == 200
    spouses = client.get(f"/persons/{a}", headers=headers).json()["spouse_ids"]
    assert sorted(spouses) == sorted([b, c])
