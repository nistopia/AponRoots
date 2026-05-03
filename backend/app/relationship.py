"""
Core relationship algorithm.

Storage = parent -> child edges only.
Every other relationship is derived via:
  1. BFS upward to compute each person's ancestors with depth
  2. Lowest Common Ancestor (LCA) = ancestor minimizing (depth_a + depth_b)
  3. Map (depth_a, depth_b, gender) to a human-readable label
"""

from collections import deque
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from . import models


# ---------- Graph traversal helpers ----------

def get_parents(db: Session, person_id: int) -> List[int]:
    rows = db.query(models.ParentChild.parent_id).filter(
        models.ParentChild.child_id == person_id
    ).all()
    return [r[0] for r in rows]


def get_children(db: Session, person_id: int) -> List[int]:
    rows = db.query(models.ParentChild.child_id).filter(
        models.ParentChild.parent_id == person_id
    ).all()
    return [r[0] for r in rows]


def get_spouses(db: Session, person_id: int) -> List[int]:
    """Returns all current spouse/partner IDs for a person (bidirectional lookup)."""
    a_rows = db.query(models.Union.partner_b_id).filter(
        models.Union.partner_a_id == person_id
    ).all()
    b_rows = db.query(models.Union.partner_a_id).filter(
        models.Union.partner_b_id == person_id
    ).all()
    return [r[0] for r in a_rows] + [r[0] for r in b_rows]


def ancestors_with_depth(db: Session, person_id: int, max_depth: int = 20) -> Dict[int, int]:
    """BFS upward: returns {ancestor_id: depth}. Includes the person themself at depth 0."""
    visited: Dict[int, int] = {person_id: 0}
    queue = deque([(person_id, 0)])
    while queue:
        current, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for parent in get_parents(db, current):
            if parent not in visited:
                visited[parent] = depth + 1
                queue.append((parent, depth + 1))
    return visited


def descendants(db: Session, person_id: int, max_depth: int = 20) -> Dict[int, int]:
    """BFS downward: returns {descendant_id: depth}."""
    visited: Dict[int, int] = {person_id: 0}
    queue = deque([(person_id, 0)])
    while queue:
        current, depth = queue.popleft()
        if depth >= max_depth:
            continue
        for child in get_children(db, current):
            if child not in visited:
                visited[child] = depth + 1
                queue.append((child, depth + 1))
    return visited


# ---------- LCA + relationship naming ----------

def find_lca(
    a_anc: Dict[int, int], b_anc: Dict[int, int]
) -> Optional[Tuple[int, int, int]]:
    """Returns (lca_id, depth_from_a, depth_from_b) or None if unrelated."""
    common = set(a_anc) & set(b_anc)
    if not common:
        return None
    lca = min(common, key=lambda x: a_anc[x] + b_anc[x])
    return lca, a_anc[lca], b_anc[lca]


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _greats(n: int, base: str) -> str:
    """0 -> base, 1 -> 'great-base', 2 -> 'great-great-base', ..."""
    if n <= 0:
        return base
    if n == 1:
        return f"great-{base}"
    return f"{'great-' * n}{base}"


def name_relationship(d_a: int, d_b: int, gender_b: Optional[str]) -> str:
    """
    d_a = generations from person A up to LCA
    d_b = generations from person B up to LCA
    gender_b is used to pick the right gendered label for B (relative to A).
    """
    g = (gender_b or "X").upper()

    # Same person
    if d_a == 0 and d_b == 0:
        return "self"

    # B is ancestor of A
    if d_b == 0:
        if d_a == 1:
            return {"M": "father", "F": "mother"}.get(g, "parent")
        if d_a == 2:
            return {"M": "grandfather", "F": "grandmother"}.get(g, "grandparent")
        # 3 -> great-grandparent, 4 -> great-great-grandparent
        base = {"M": "grandfather", "F": "grandmother"}.get(g, "grandparent")
        return _greats(d_a - 2, base)

    # B is descendant of A
    if d_a == 0:
        if d_b == 1:
            return {"M": "son", "F": "daughter"}.get(g, "child")
        if d_b == 2:
            return {"M": "grandson", "F": "granddaughter"}.get(g, "grandchild")
        base = {"M": "grandson", "F": "granddaughter"}.get(g, "grandchild")
        return _greats(d_b - 2, base)

    # Siblings (both 1 step from LCA)
    if d_a == 1 and d_b == 1:
        return {"M": "brother", "F": "sister"}.get(g, "sibling")

    # B is sibling of A's ancestor (aunt/uncle land)
    if d_b == 1 and d_a > 1:
        if d_a == 2:
            base = {"M": "uncle", "F": "aunt"}.get(g, "aunt/uncle")
            return base
        # great-aunt/uncle and beyond
        base = {"M": "uncle", "F": "aunt"}.get(g, "aunt/uncle")
        return _greats(d_a - 2, base)

    # A is sibling of B's ancestor (niece/nephew land)
    if d_a == 1 and d_b > 1:
        if d_b == 2:
            return {"M": "nephew", "F": "niece"}.get(g, "niece/nephew")
        base = {"M": "nephew", "F": "niece"}.get(g, "niece/nephew")
        return _greats(d_b - 2, base)

    # Cousins
    cousin_degree = min(d_a, d_b) - 1  # 1 -> first cousin, 2 -> second cousin
    removed = abs(d_a - d_b)
    label = f"{_ordinal(cousin_degree)} cousin"
    if removed == 1:
        label += " once removed"
    elif removed == 2:
        label += " twice removed"
    elif removed > 2:
        label += f" {removed} times removed"
    return label


# ---------- Path building (for UI highlighting) ----------

def path_to_ancestor(db: Session, start: int, ancestor: int) -> List[int]:
    """Returns the chain start -> ... -> ancestor (parent links). [] if not found."""
    if start == ancestor:
        return [start]
    # BFS storing parent in trail
    trail: Dict[int, Optional[int]] = {start: None}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        if cur == ancestor:
            # rebuild
            path = []
            node: Optional[int] = ancestor
            while node is not None:
                path.append(node)
                node = trail[node]
            return list(reversed(path))
        for p in get_parents(db, cur):
            if p not in trail:
                trail[p] = cur
                queue.append(p)
    return []


def build_relationship_path(db: Session, a: int, b: int, lca: int) -> List[int]:
    """A -> ... -> LCA -> ... -> B (LCA appears once)."""
    up = path_to_ancestor(db, a, lca)
    down = path_to_ancestor(db, b, lca)
    if not up or not down:
        return []
    return up + list(reversed(down))[1:]  # skip duplicated LCA


# ---------- In-law detection ----------

def find_in_law(
    db: Session, a_id: int, b_id: int, gender_b: Optional[str]
):
    """
    Detects in-law relationships when A and B share no direct blood ancestor.

    Two paths are tried:
      Path 1: A's spouse S has a blood relation to B.
              -> B is "A's <spouse's-relation-to-B>-in-law"
      Path 2: A has a blood relation to B's spouse S'.
              -> B married into A's family via S'.

    Returns dict {label, lca_id, distance_a, distance_b, via, path, path_edges}
    or None.

    `path` is the full sequence of person ids from A to B.
    `path_edges` is a list of "parent"/"child"/"spouse" labels with
    len(path) - 1 entries that describe how each consecutive pair is linked.
    """
    best: Optional[Tuple[int, dict]] = None

    def _consider(payload: dict, total_dist: int):
        nonlocal best
        if best is None or total_dist < best[0]:
            best = (total_dist, payload)

    # Path 1: A's spouse S, blood S -> B
    for s_id in get_spouses(db, a_id):
        s_anc = ancestors_with_depth(db, s_id)
        b_anc = ancestors_with_depth(db, b_id)
        lca = find_lca(s_anc, b_anc)
        if not lca:
            continue
        lca_id, ds, dbg = lca
        blood = name_relationship(ds, dbg, gender_b)
        if blood == "self":
            continue
        # Path: a_id -> s_id -> ... up ... -> lca -> ... down ... -> b_id
        s_to_lca = path_to_ancestor(db, s_id, lca_id)        # length ds+1
        b_to_lca = path_to_ancestor(db, b_id, lca_id)        # length dbg+1
        if not s_to_lca or not b_to_lca:
            continue
        full_path = [a_id] + s_to_lca + list(reversed(b_to_lca))[1:]
        edges = (
            ["spouse"]
            + ["parent"] * ds
            + ["child"] * dbg
        )
        _consider(
            {
                "label": f"{blood}-in-law",
                "lca_id": lca_id,
                "distance_a": ds,
                "distance_b": dbg,
                "via": "your-spouse",
                "via_id": s_id,
                "path": full_path,
                "path_edges": edges,
            },
            ds + dbg + 1,
        )

    # Path 2: B's spouse S', blood A -> S'
    for sp_id in get_spouses(db, b_id):
        a_anc = ancestors_with_depth(db, a_id)
        sp_anc = ancestors_with_depth(db, sp_id)
        lca = find_lca(a_anc, sp_anc)
        if not lca:
            continue
        lca_id, da, dsp = lca
        # Use B's gender for the "fictive" role label
        blood = name_relationship(da, dsp, gender_b)
        if blood == "self":
            continue
        a_to_lca = path_to_ancestor(db, a_id, lca_id)
        sp_to_lca = path_to_ancestor(db, sp_id, lca_id)
        if not a_to_lca or not sp_to_lca:
            continue
        full_path = a_to_lca + list(reversed(sp_to_lca))[1:] + [b_id]
        edges = (
            ["parent"] * da
            + ["child"] * dsp
            + ["spouse"]
        )
        _consider(
            {
                "label": f"{blood}-in-law",
                "lca_id": lca_id,
                "distance_a": da,
                "distance_b": dsp,
                "via": "their-spouse",
                "via_id": sp_id,
                "path": full_path,
                "path_edges": edges,
            },
            da + dsp + 1,
        )

    return best[1] if best else None
