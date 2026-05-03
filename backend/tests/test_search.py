"""Tests for the search endpoint."""


def make(client, headers, name):
    r = client.post("/persons", headers=headers, json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def test_search_substring_case_insensitive(auth_client):
    client, headers, _ = auth_client
    make(client, headers, "Alice Johnson")
    make(client, headers, "Bob Smith")
    make(client, headers, "Alicia Keys")
    r = client.get("/persons/search?q=ali", headers=headers)
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert "Alice Johnson" in names
    assert "Alicia Keys" in names
    assert "Bob Smith" not in names


def test_search_empty_returns_all(auth_client):
    client, headers, _ = auth_client
    make(client, headers, "Alice")
    make(client, headers, "Bob")
    r = client.get("/persons/search?q=", headers=headers)
    assert len(r.json()) == 2


def test_search_no_match_returns_empty(auth_client):
    client, headers, _ = auth_client
    make(client, headers, "Alice")
    r = client.get("/persons/search?q=xyz", headers=headers)
    assert r.json() == []


def test_search_respects_limit(auth_client):
    client, headers, _ = auth_client
    for i in range(5):
        make(client, headers, f"Test {i}")
    r = client.get("/persons/search?q=test&limit=2", headers=headers)
    assert len(r.json()) == 2


def test_search_results_alphabetical(auth_client):
    client, headers, _ = auth_client
    make(client, headers, "Charlie")
    make(client, headers, "Alice")
    make(client, headers, "Bob")
    r = client.get("/persons/search?q=", headers=headers)
    names = [p["name"] for p in r.json()]
    assert names == ["Alice", "Bob", "Charlie"]
