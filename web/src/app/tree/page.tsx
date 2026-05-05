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
    personId?: string;
    spouseName?: string;
    spouseGender?: string;
    spouseId?: string;
  };
  children?: TreeNode[];
}

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
    for (const sid of p.spouse_ids) {
      if (!byOtherParent.has(sid)) byOtherParent.set(sid, []);
    }

    const marriages = [...byOtherParent.entries()].filter(
      ([k]) => k !== null,
    ) as [number, number[]][];
    const soloKids = byOtherParent.get(null) ?? [];

    if (marriages.length === 0 && soloKids.length === 0) {
      return basicPersonNode(p);
    }

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
          personId: String(p.id),
          spouseName: spouse?.name ?? "",
          spouseGender: spouse?.gender ?? "",
          spouseId: spouse ? String(spouse.id) : "",
        },
        children: kids.length > 0 ? kids : undefined,
      };
    }

    if (marriages.length === 0) {
      const kids = soloKids
        .map(walk)
        .filter((k): k is TreeNode => k !== null);
      return {
        ...basicPersonNode(p),
        children: kids.length > 0 ? kids : undefined,
      };
    }

    // Multiple marriages (or marriage + solo kids)
    const branches: TreeNode[] = [];

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
          personId: String(spouse.id),
        },
        children: kids.length > 0 ? kids : undefined,
      });
    }

    return {
      name: p.name,
      attributes: {
        type: "person",
        gender: p.gender ?? "",
        personId: String(p.id),
      },
      children: branches,
    };
  };

  return walk(rootId);
}

function basicPersonNode(p: Person): TreeNode {
  return {
    name: p.name,
    attributes: {
      type: "person",
      gender: p.gender ?? "",
      personId: String(p.id),
    },
  };
}

function emojiFor(gender: string | undefined | null): string {
  if (gender === "F") return "👩";
  if (gender === "M") return "👨";
  // 🧑 (person) renders inconsistently across platforms — sometimes a
  // featureless ring on iOS Safari. Use a clearly visible bust silhouette.
  return "👤";
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
  const rootPerson = rootId !== null ? byId.get(rootId) : null;
  const parents =
    rootPerson?.parent_ids
      .map((pid) => byId.get(pid))
      .filter((p): p is Person => !!p) ?? [];

  // Compute translate based on container width so the tree centers on mobile/desktop.
  const [containerWidth, setContainerWidth] = useState<number>(800);
  useEffect(() => {
    const update = () => {
      const el = document.getElementById("tree-container");
      if (el) setContainerWidth(el.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [tree]);

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

      {parents.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-600">↑ Show parents of {rootPerson?.name}:</span>
          {parents.map((p) => (
            <button
              key={p.id}
              onClick={() => setRootId(p.id)}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm text-stone-800 shadow-sm hover:border-emerald-500 hover:bg-emerald-50"
            >
              <span aria-hidden>
                {p.gender === "F" ? "👩" : p.gender === "M" ? "👨" : "👤"}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <p className="mb-2 text-xs text-stone-500">
        💡 Click any person in the tree to make them the new root.
      </p>

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
            translate={{ x: containerWidth / 2, y: 60 }}
            pathFunc="step"
            separation={{ siblings: 1.6, nonSiblings: 2 }}
            nodeSize={{ x: 260, y: 130 }}
            renderCustomNodeElement={({ nodeDatum }) => {
              const type = (nodeDatum.attributes?.type ?? "person") as NodeType;
              const gender = nodeDatum.attributes?.gender as string | undefined;
              const personIdStr = nodeDatum.attributes?.personId as
                | string
                | undefined;
              const personId = personIdStr ? parseInt(personIdStr, 10) : null;

              const handleClick = (id: number | null) => () => {
                if (id !== null) setRootId(id);
              };

              if (type === "couple") {
                const spouseName = (nodeDatum.attributes?.spouseName ??
                  "") as string;
                const spouseGender = nodeDatum.attributes?.spouseGender as
                  | string
                  | undefined;
                const spouseIdStr = nodeDatum.attributes?.spouseId as
                  | string
                  | undefined;
                const spouseId = spouseIdStr
                  ? parseInt(spouseIdStr, 10)
                  : null;
                // Center the couple around x=0 so the link from above
                // (parent->this couple) lands between them, and so the
                // link below (this couple->child) emanates from between
                // the two parents.
                const halfGap = PERSON_GAP / 2;
                return (
                  <g>
                    {personGlyph(-halfGap, gender, nodeDatum.name, handleClick(personId))}
                    <line
                      x1={-halfGap + 22}
                      y1={0}
                      x2={halfGap - 22}
                      y2={0}
                      stroke="#9ca3af"
                      strokeWidth={2}
                      strokeDasharray="4,3"
                    />
                    <text
                      x={0}
                      y={-6}
                      textAnchor="middle"
                      fontSize={16}
                      fill="#dc2626"
                    >
                      ♥
                    </text>
                    {personGlyph(
                      halfGap,
                      spouseGender,
                      spouseName,
                      handleClick(spouseId),
                    )}
                  </g>
                );
              }

              if (type === "marriage_branch") {
                return (
                  <g>
                    <text
                      x={0}
                      y={-26}
                      textAnchor="middle"
                      fontSize={18}
                      fill="#dc2626"
                    >
                      ♥
                    </text>
                    {personGlyph(0, gender, nodeDatum.name, handleClick(personId))}
                  </g>
                );
              }

              return personGlyph(0, gender, nodeDatum.name, handleClick(personId));
            }}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-stone-500">
        👨 Male · 👩 Female · 👤 Other / unset · ♥ link = spouse
      </p>
    </section>
  );
}

/** Renders a person as an emoji + name. Returns a clickable SVG group. */
function personGlyph(
  x: number,
  gender: string | undefined | null,
  name: string,
  onClick: () => void,
) {
  return (
    <g
      transform={`translate(${x}, 0)`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible larger hit area so text is easy to click */}
      <circle r={28} cx={0} cy={0} fill="transparent" />
      <text
        x={0}
        y={10}
        textAnchor="middle"
        fontSize={36}
        style={{
          fontFamily:
            '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
          userSelect: "none",
        }}
      >
        {emojiFor(gender)}
      </text>
      <text
        x={0}
        y={48}
        textAnchor="middle"
        fontSize={14}
        fontWeight={700}
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
        fill="#0f172a"
        style={{
          fontFamily: "system-ui, sans-serif",
          userSelect: "none",
        }}
      >
        {name}
      </text>
    </g>
  );
}
