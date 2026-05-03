"""End-to-end tests against a real SQLite DB to verify the relationship algorithm."""


def make(client, headers, name, gender=None, parents=None):
    r = client.post("/persons", headers=headers, json={
        "name": name,
        "gender": gender,
        "parent_ids": parents or [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def rel(client, headers, a, b):
    r = client.get(f"/relationships?a={a}&b={b}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["relationship"]


def test_basic_family_relationships(auth_client):
    client, headers, _ = auth_client
    grandpa = make(client, headers, "Grandpa", "M")
    grandma = make(client, headers, "Grandma", "F")
    dad = make(client, headers, "Dad", "M", [grandpa, grandma])
    aunt = make(client, headers, "Aunt", "F", [grandpa, grandma])
    me = make(client, headers, "Me", "M", [dad])
    sister = make(client, headers, "Sister", "F", [dad])
    son = make(client, headers, "Son", "M", [me])
    cousin = make(client, headers, "Cousin", "F", [aunt])

    assert "father" in rel(client, headers, me, dad)
    assert "grandfather" in rel(client, headers, me, grandpa)
    assert "grandmother" in rel(client, headers, me, grandma)
    assert "son" in rel(client, headers, me, son)
    assert "grandson" in rel(client, headers, dad, son)
    assert "sister" in rel(client, headers, me, sister)
    assert "brother" in rel(client, headers, sister, me)
    assert "aunt" in rel(client, headers, me, aunt)
    assert "nephew" in rel(client, headers, aunt, me)
    assert "niece" in rel(client, headers, aunt, sister)
    assert "1st cousin" in rel(client, headers, me, cousin)
    assert "1st cousin" in rel(client, headers, cousin, me)
    assert "1st cousin once removed" in rel(client, headers, son, cousin)


def test_self_and_unrelated(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "Alice", "F")
    b = make(client, headers, "Bob", "M")
    assert rel(client, headers, a, a) == "self"
    assert "no known" in rel(client, headers, a, b)


def test_great_grandparent_chain(auth_client):
    client, headers, _ = auth_client
    gg = make(client, headers, "GG", "F")
    g = make(client, headers, "G", "F", [gg])
    p = make(client, headers, "P", "F", [g])
    me = make(client, headers, "Me", "M", [p])
    assert "great-grandmother" in rel(client, headers, me, gg)
    assert "great-grandson" in rel(client, headers, gg, me)


def test_second_cousin(auth_client):
    client, headers, _ = auth_client
    gg = make(client, headers, "GG", "M")
    g1 = make(client, headers, "G1", "M", [gg])
    g2 = make(client, headers, "G2", "F", [gg])
    p1 = make(client, headers, "P1", "M", [g1])
    p2 = make(client, headers, "P2", "F", [g2])
    a = make(client, headers, "A", "M", [p1])
    b = make(client, headers, "B", "F", [p2])
    assert "2nd cousin" in rel(client, headers, a, b)


def test_cycle_prevention(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "A", "M")
    b = make(client, headers, "B", "M", [a])
    r = client.post(f"/persons/{a}/parents", headers=headers, json={"parent_id": b})
    assert r.status_code == 400


def test_max_two_parents(auth_client):
    client, headers, _ = auth_client
    p1 = make(client, headers, "P1", "M")
    p2 = make(client, headers, "P2", "F")
    p3 = make(client, headers, "P3", "F")
    child = make(client, headers, "Child", "M", [p1, p2])
    r = client.post(f"/persons/{child}/parents", headers=headers, json={"parent_id": p3})
    assert r.status_code == 400
