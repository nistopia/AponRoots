"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";
import { PersonAutocomplete } from "@/components/PersonAutocomplete";

// react-d3-tree is client-only and uses window — load dynamically.
const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

type NodeType = "person" | "couple" | "marriage_branch";

interface TreeNode {
  name: string;
  attributes?: {
    type?: NodeType;
    gender?: string;
    spouseName?: string;
    spouseGender?: string;
  };
  children?: TreeNode[];
}

/**
 * Tree builder that correctly handles multiple spouses.
 *
 *   - "person":          a single person (no spouse, no merging)
 *   - "couple":          P + one spouse drawn side-by-side; their joint
 *                        children hang directly below
 *   - "marriage_branch": when P has 2+ spouses, the second / third / ...
 *                        marriages are represented as branches under P.
 *                        The branch shows the OTHER spouse with a heart,
 *                        and the children of that specific marriage below.
 *
 * Children are grouped by their other biological parent. So a child only
 * ever appears once, attached to the marriage that produced them.
 */
function buildTree(rootId: number, byId: Map<number, Person>): TreeNode | null {
  const rendered = new Set<number>();

  const walk = (id: number): TreeNode | null => {
    if (rendered.has(id)) return null;
    const p = byId.get(id);
    if (!p) return null;
    rendered.add(id);

    // Group children by their other parent (must be a spouse of p)
    const byOtherParent = new Map<number | null, number[]>();
    for (const cid of p.children_ids) {
      const c = byId.get(cid);
      if (!c) continue;
      const others = c.parent_ids.filter((x) => x !== p.id);
      const otherSpouse =
        others.find((x) => p.spouse_ids.includes(x)) ?? null;
      const arr = byOtherParent.get(otherSpouse) ?? [];
      arr.push(cid);
      byOtherParent.set(otherSpouse, arr);
    }
    // Make sure every spouse has an entry, even childless marriages
    for (const sid of p.spouse_ids) {
      if (!byOtherParent.has(sid)) byOtherParent.set(sid, []);
    }

    const marriages = [...byOtherParent.entries()].filter(
      ([k]) => k !== null,
    ) as [number, number[]][];
    const soloKids = byOtherParent.get(null) ?? [];

    // No spouses, no children
    if (marriages.length === 0 && soloKids.length === 0) {
      return basicPersonNode(p);
    }

    // Single marriage and no children outside it → classic combined couple
    if (marriages.length === 1 && soloKids.length === 0) {
      const [spouseId, kidIds] = marriages[0];
      const spouse = byId.get(spouseId);
      if (spouse) rendered.add(spouseId);
      const kids = kidIds
        .map(walk)
        .filter((k): k is TreeNode => k !== null);
      return {
        name: p.name,
        attributes: {
          type: "couple",
          gender: p.gender ?? "",
          spouseName: spouse?.name ?? "",
          spouseGender: spouse?.gender ?? "",
        },
        children: kids.length > 0 ? kids : undefined,
      };
    }

    // No marriages, just solo children
    if (marriages.length === 0) {
      const kids = soloKids
        .map(walk)
        .filter((k): k is TreeNode => k !== null);
      return {
        ...basicPersonNode(p),
        children: kids.length > 0 ? kids : undefined,
      };
    }

    // Multiple marriages (or marriage + solo kids).
    // Render P alone, then for each marriage create a marriage_branch node.
    const branches: TreeNode[] = [];

    // Solo kids first
    for (const cid of soloKids) {
      const n = walk(cid);
      if (n) branches.push(n);
    }

    for (const [spouseId, kidIds] of marriages) {
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      rendered.add(spouseId);
      const kids = kidIds
        .map(walk)
        .filter((k): k is TreeNode => k !== null);
      branches.push({
        name: spouse.name,
        attributes: {
          type: "marriage_branch",
          gender: spouse.gender ?? "",
        },
        children: kids.length > 0 ? kids : undefined,
      });
    }

    return {
      name: p.name,
      attributes: { type: "person", gender: p.gender ?? "" },
      children: branches,
    };
  };

  return walk(rootId);
}

function basicPersonNode(p: Person): TreeNode {
  return {
    name: p.name,
    attributes: { type: "person", gender: p.gender ?? "" },
  };
}

function colorFor(gender: string | undefined): string {
  if (gender === "F") return "#db2777";
  if (gender === "M") return "#1d4ed8";
  return "#047857";
}

const PERSON_GAP = 110;

export default function TreePage() {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ["persons", "all"],
    queryFn: () => api.listPersons(false),
  });

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const roots = useMemo(
    () => people.filter((p) => p.parent_ids.length === 0),
    [people],
  );

  const [rootId, setRootId] = useState<number | null>(null);

  useEffect(() => {
    if (rootId === null && roots.length > 0) {
      setRootId(roots[0].id);
    }
  }, [rootId, roots]);

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (people.length === 0)
    return (
      <p className="text-stone-600">
        No people yet. Add some on the{" "}
        <a className="text-emerald-700 underline" href="/add">
          Add Person
        </a>{" "}
        page.
      </p>
    );

  const tree = rootId !== null ? buildTree(rootId, byId) : null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h1 className="text-2xl font-semibold">Family tree</h1>
        <span className="text-sm text-stone-500">
          {roots.length} root{roots.length === 1 ? "" : "s"} ·{" "}
          {people.length} people
        </span>
      </div>

      <div className="mb-4 max-w-sm">
        <PersonAutocomplete
          label="Show tree rooted at…"
          value={rootId}
          onChange={setRootId}
          placeholder="Pick anyone — see them and their descendants"
        />
      </div>

      <div
        id="tree-container"
        className="rounded-lg border border-stone-200 bg-white"
        style={{ height: "70vh" }}
      >
        {tree && (
          <Tree
            data={tree}
            orientation="vertical"
            collapsible={false}
            translate={{ x: 400, y: 60 }}
            pathFunc="step"
            separation={{ siblings: 1.6, nonSiblings: 2 }}
            nodeSize={{ x: 260, y: 130 }}
            renderCustomNodeElement={({ nodeDatum }) => {
              const type = (nodeDatum.attributes?.type ?? "person") as NodeType;
              const gender = nodeDatum.attributes?.gender as
                | string
                | undefined;
              const fill = colorFor(gender);

              // Couple: primary + one spouse, side by side with heart link
              if (type === "couple") {
                const spouseName = (nodeDatum.attributes?.spouseName ??
                  "") as string;
                const spouseGender = nodeDatum.attributes?.spouseGender as
                  | string
                  | undefined;
                const sFill = colorFor(spouseGender);
                return (
                  <g>
                    {personGlyph(0, fill, nodeDatum.name)}
                    <line
                      x1={22}
                      y1={0}
                      x2={PERSON_GAP - 22}
                      y2={0}
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeDasharray="4,3"
                    />
                    <text
                      x={PERSON_GAP / 2}
                      y={-6}
                      textAnchor="middle"
                      fontSize={16}
                      fill="#dc2626"
                    >
                      ♥
                    </text>
                    {personGlyph(PERSON_GAP, sFill, spouseName)}
                  </g>
                );
              }

              // Marriage branch: spouse-only node, the heart link to P is
              // implied by the tree edge above. We keep a small ♥ above
              // the circle to signal it's a marriage, not a child.
              if (type === "marriage_branch") {
                return (
                  <g>
                    <text
                      x={0}
                      y={-30}
                      textAnchor="middle"
                      fontSize={16}
                      fill="#dc2626"
                    >
                      ♥
                    </text>
                    <text
                      x={0}
                      y={-16}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#9ca3af"
                    >
                      also married
                    </text>
                    {personGlyph(0, fill, nodeDatum.name)}
                  </g>
                );
              }

              // Plain person
              return personGlyph(0, fill, nodeDatum.name);
            }}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-stone-500">
        👨 Male · 👩 Female · 🟢 Other / unset · ♥ link = spouse · &ldquo;also
        married&rdquo; = additional marriage of the parent above
      </p>
    </section>
  );
}

/** Renders a circle + name. Returns an SVG group fragment. */
function personGlyph(x: number, fill: string, name: string) {
  return (
    <g transform={`translate(${x}, 0)`}>
      <circle r={20} cx={0} cy={0} fill={fill} stroke="#ffffff" strokeWidth={3} />
      <text
        x={0}
        y={42}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
        fill="#0f172a"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        {name}
      </text>
    </g>
  );
}
