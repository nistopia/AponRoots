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


# ---------- In-law detection (unified BFS over blood relatives) ----------

def _flip_edge(e: str) -> str:
    if e == "parent":
        return "child"
    if e == "child":
        return "parent"
    return e


def _bfs_blood(db: Session, start: int, max_depth: int = 12):
    """BFS through parent + child links. Returns {pid: (path_from_start, edges)}."""
    visited: Dict[int, Tuple[List[int], List[str]]] = {start: ([start], [])}
    queue = deque([start])
    while queue:
        cur = queue.popleft()
        cur_path, cur_edges = visited[cur]
        if len(cur_edges) >= max_depth:
            continue
        for p in get_parents(db, cur):
            if p not in visited:
                visited[p] = (cur_path + [p], cur_edges + ["parent"])
                queue.append(p)
        for c in get_children(db, cur):
            if c not in visited:
                visited[c] = (cur_path + [c], cur_edges + ["child"])
                queue.append(c)
    return visited


def _label_for_blood_edges(edges: List[str], gender_b: Optional[str]) -> str:
    """Re-use name_relationship by extracting up_count then down_count.
    BFS-blood paths are always monotone (all parents then all children)."""
    up = 0
    while up < len(edges) and edges[up] == "parent":
        up += 1
    down = len(edges) - up
    return name_relationship(up, down, gender_b)


def _find_lca_in_blood(path: List[int], edges: List[str]) -> Optional[int]:
    """The LCA in a monotone blood path is the node at the peak (right after
    the last 'parent' edge, before the first 'child' edge)."""
    up = 0
    while up < len(edges) and edges[up] == "parent":
        up += 1
    if 0 <= up < len(path):
        return path[up]
    return None


def _co_in_law_label(
    a_to_x_edges: List[str], y_to_b_edges: List[str], gender_b: Optional[str]
) -> str:
    """Label for the 'co-in-law' case where neither X==A nor Y==B.
    Most common in real life: each of A and B is an ancestor of the
    married couple (parent, grandparent, ...). Special cultures have a
    single word for this; English uses 'co-father-in-law' etc."""
    a_all_down = all(e == "child" for e in a_to_x_edges) and len(a_to_x_edges) > 0
    b_all_up = all(e == "parent" for e in y_to_b_edges) and len(y_to_b_edges) > 0

    if a_all_down and b_all_up:
        d_a = len(a_to_x_edges)
        d_b = len(y_to_b_edges)
        if d_a == 1 and d_b == 1:
            if gender_b == "M":
                return "co-father-in-law"
            if gender_b == "F":
                return "co-mother-in-law"
            return "co-parent-in-law"
        if d_a == d_b == 2:
            return "co-grandparent-in-law"
        if d_a == d_b:
            return f"co-{'great-' * (d_a - 2)}grandparent-in-law"
    return "in-law (via marriage)"


def find_in_law(
    db: Session, a_id: int, b_id: int, gender_b: Optional[str]
):
    """Unified in-law / co-in-law search.

    Strategy: BFS the blood relatives of A and B; for every spouse-edge
    that connects an A-relative X to a B-relative Y, build a candidate
    path A -> ... -> X -[spouse]- Y -> ... -> B. Pick the shortest.

    Cases produced (with 'via' label):
      your-spouse      X = A, Y is in B's blood graph
                       (e.g. spouse's father -> father-in-law)
      their-spouse     Y = B, X is in A's blood graph
                       (e.g. brother's wife -> sister-in-law)
      co-in-law        Both X != A and Y != B
                       (e.g. children-of-A married children-of-B
                        -> co-father-in-law / 'samdhi')

    Returns dict {label, lca_id, distance_a, distance_b, via, path,
    path_edges} or None.
    """
    a_rel = _bfs_blood(db, a_id)
    b_rel = _bfs_blood(db, b_id)

    best: Optional[Tuple[int, dict]] = None

    for x_id, (a_to_x_path, a_to_x_edges) in a_rel.items():
        for y_id in get_spouses(db, x_id):
            if y_id not in b_rel:
                continue
            # Direct-spouse case is handled by the calling endpoint
            if x_id == a_id and y_id == b_id:
                continue

            b_to_y_path, b_to_y_edges = b_rel[y_id]
            y_to_b_path = list(reversed(b_to_y_path))
            y_to_b_edges = [_flip_edge(e) for e in reversed(b_to_y_edges)]

            full_path = a_to_x_path + [y_id] + y_to_b_path[1:]
            full_edges = list(a_to_x_edges) + ["spouse"] + list(y_to_b_edges)
            total = len(full_edges)

            if best is not None and total >= best[0]:
                continue

            # Compute label & LCA depending on which case we hit
            if x_id == a_id:
                # Simple "your-spouse": X is trivially A; Y is A's spouse
                base = _label_for_blood_edges(y_to_b_edges, gender_b)
                if base in ("self", ""):
                    continue
                label = f"{base}-in-law"
                lca_id = _find_lca_in_blood(y_to_b_path, y_to_b_edges)
                via = "your-spouse"
            elif y_id == b_id:
                # Simple "their-spouse": Y trivially B; X is A's blood relative
                # who happens to be married to B. Label uses the would-be
                # role of B from A's perspective (gender_b).
                base = _label_for_blood_edges(a_to_x_edges, gender_b)
                if base in ("self", ""):
                    continue
                label = f"{base}-in-law"
                lca_id = _find_lca_in_blood(a_to_x_path, a_to_x_edges)
                via = "their-spouse"
            else:
                # Co-in-law: both A and B are upstream of a marriage
                label = _co_in_law_label(a_to_x_edges, y_to_b_edges, gender_b)
                lca_id = None
                via = "co-in-law"

            best = (
                total,
                {
                    "label": label,
                    "lca_id": lca_id,
                    "distance_a": len(a_to_x_edges),
                    "distance_b": len(y_to_b_edges),
                    "via": via,
                    "path": full_path,
                    "path_edges": full_edges,
                },
            )

    return best[1] if best else None
