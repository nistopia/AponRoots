"""Tests for in-law relationship detection via spouse links."""


def make(client, headers, name, gender=None, parents=None):
    r = client.post("/persons", headers=headers, json={
        "name": name, "gender": gender, "parent_ids": parents or [],
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


def link_spouse(client, headers, a, b):
    r = client.post(f"/persons/{a}/spouses", headers=headers, json={"spouse_id": b})
    assert r.status_code == 200, r.text


def rel(client, headers, a, b):
    r = client.get(f"/relationships?a={a}&b={b}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["relationship"]


def test_father_in_law(auth_client):
    """Spouse's father -> father-in-law."""
    client, headers, _ = auth_client
    me = make(client, headers, "Me", "M")
    spouse = make(client, headers, "Spouse", "F")
    fil = make(client, headers, "FIL", "M")
    # Spouse's father is FIL
    client.post(f"/persons/{spouse}/parents", headers=headers, json={"parent_id": fil})
    link_spouse(client, headers, me, spouse)

    r = client.get(f"/relationships?a={me}&b={fil}", headers=headers)
    body = r.json()
    assert "father-in-law" in body["relationship"]
    # Path should be [me, spouse, fil] with edges [spouse, parent]
    assert body["path"] == [me, spouse, fil]
    assert body["path_edges"] == ["spouse", "parent"]
    assert body["via"] == "your-spouse"


def test_son_in_law_path(auth_client):
    """My daughter's husband -> son-in-law. Path [me, daughter, husband], edges [child, spouse]."""
    client, headers, _ = auth_client
    me = make(client, headers, "Me", "M")
    daughter = make(client, headers, "Daughter", "F", [me])
    husband = make(client, headers, "Husband", "M")
    link_spouse(client, headers, daughter, husband)

    r = client.get(f"/relationships?a={me}&b={husband}", headers=headers).json()
    assert "son-in-law" in r["relationship"]
    assert r["path"] == [me, daughter, husband]
    assert r["path_edges"] == ["child", "spouse"]
    assert r["via"] == "their-spouse"


def test_mother_in_law(auth_client):
    client, headers, _ = auth_client
    me = make(client, headers, "Me", "M")
    spouse = make(client, headers, "Spouse", "F")
    mil = make(client, headers, "MIL", "F")
    client.post(f"/persons/{spouse}/parents", headers=headers, json={"parent_id": mil})
    link_spouse(client, headers, me, spouse)

    assert "mother-in-law" in rel(client, headers, me, mil)


def test_brother_in_law_via_spouse(auth_client):
    """Spouse's brother -> brother-in-law."""
    client, headers, _ = auth_client
    parent = make(client, headers, "Parent", "F")
    me = make(client, headers, "Me", "M")
    spouse = make(client, headers, "Spouse", "F", [parent])
    bil = make(client, headers, "BIL", "M", [parent])
    link_spouse(client, headers, me, spouse)

    assert "brother-in-law" in rel(client, headers, me, bil)


def test_sister_in_law_via_my_brother(auth_client):
    """My brother's wife -> sister-in-law."""
    client, headers, _ = auth_client
    parent = make(client, headers, "Parent", "F")
    me = make(client, headers, "Me", "M", [parent])
    bro = make(client, headers, "Bro", "M", [parent])
    sil = make(client, headers, "SIL", "F")
    link_spouse(client, headers, bro, sil)

    assert "sister-in-law" in rel(client, headers, me, sil)


def test_son_in_law(auth_client):
    """My daughter's husband -> son-in-law."""
    client, headers, _ = auth_client
    me = make(client, headers, "Me", "M")
    daughter = make(client, headers, "Daughter", "F", [me])
    son_in_law = make(client, headers, "SonInLaw", "M")
    link_spouse(client, headers, daughter, son_in_law)

    assert "son-in-law" in rel(client, headers, me, son_in_law)


def test_daughter_in_law(auth_client):
    """My son's wife -> daughter-in-law."""
    client, headers, _ = auth_client
    me = make(client, headers, "Me", "M")
    son = make(client, headers, "Son", "M", [me])
    dil = make(client, headers, "DIL", "F")
    link_spouse(client, headers, son, dil)

    assert "daughter-in-law" in rel(client, headers, me, dil)


def test_spouse_label(auth_client):
    """A and B married, no other relation -> 'spouse'."""
    client, headers, _ = auth_client
    a = make(client, headers, "A", "M")
    b = make(client, headers, "B", "F")
    link_spouse(client, headers, a, b)

    label = rel(client, headers, a, b)
    assert "spouse" in label.lower()


def test_no_relationship_when_unrelated(auth_client):
    client, headers, _ = auth_client
    a = make(client, headers, "A", "M")
    b = make(client, headers, "B", "F")
    assert "no known" in rel(client, headers, a, b)


def test_blood_relationship_takes_priority_over_in_law(auth_client):
    """If A and B share blood, we return that, not an in-law term."""
    client, headers, _ = auth_client
    parent = make(client, headers, "Parent", "F")
    me = make(client, headers, "Me", "M", [parent])
    sister = make(client, headers, "Sister", "F", [parent])
    # Hypothetically link spouse to muddy the waters; sister is still by blood.
    spouse = make(client, headers, "Spouse", "F")
    link_spouse(client, headers, me, spouse)

    assert "sister" in rel(client, headers, me, sister)
    assert "in-law" not in rel(client, headers, me, sister)
