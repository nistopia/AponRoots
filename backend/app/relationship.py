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
