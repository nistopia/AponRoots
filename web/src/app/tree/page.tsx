"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";
import { PersonAutocomplete } from "@/components/PersonAutocomplete";

// react-d3-tree is client-only and uses window — load dynamically.
const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface SpouseInfo {
  n: string; // name
  g: string; // gender ('M' | 'F' | 'X' | '')
}

interface TreeNode {
  name: string;
  attributes?: {
    gender?: string;
    spouses?: string; // JSON-encoded SpouseInfo[]
  };
  children?: TreeNode[];
}

/**
 * Build a tree where each rendered node is a "couple" (person + their spouses).
 * Children = union of children_ids across the couple, deduplicated.
 * Spouses are marked rendered so they don't appear as separate subtrees.
 */
function buildTree(rootId: number, byId: Map<number, Person>): TreeNode {
  const rendered = new Set<number>();

  const walk = (id: number): TreeNode | null => {
    const p = byId.get(id);
    if (!p || rendered.has(id)) return null;
    rendered.add(id);

    const spouses: Person[] = p.spouse_ids
      .map((sid) => byId.get(sid))
      .filter((s): s is Person => !!s);
    spouses.forEach((s) => rendered.add(s.id));

    // Children of either side of the union
    const childIds = Array.from(
      new Set<number>([
        ...p.children_ids,
        ...spouses.flatMap((s) => s.children_ids),
      ]),
    );

    const children = childIds
      .map(walk)
      .filter((c): c is TreeNode => c !== null);

    const spouseInfo: SpouseInfo[] = spouses.map((s) => ({
      n: s.name,
      g: s.gender ?? "",
    }));

    return {
      name: p.name,
      attributes: {
        gender: p.gender ?? "",
        spouses: JSON.stringify(spouseInfo),
      },
      children: children.length > 0 ? children : undefined,
    };
  };

  return walk(rootId)!;
}

function colorFor(gender: string | undefined): string {
  if (gender === "F") return "#db2777";
  if (gender === "M") return "#1d4ed8";
  return "#047857";
}

const PERSON_GAP = 110; // horizontal distance between members of a couple

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
              const gender = nodeDatum.attributes?.gender as
                | string
                | undefined;
              const spousesRaw = (nodeDatum.attributes?.spouses ??
                "[]") as string;
              let spouses: SpouseInfo[] = [];
              try {
                spouses = JSON.parse(spousesRaw);
              } catch {
                spouses = [];
              }

              const personFill = colorFor(gender);

              return (
                <g>
                  {/* Primary person */}
                  <circle
                    r={20}
                    cx={0}
                    cy={0}
                    fill={personFill}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
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
                    {nodeDatum.name}
                  </text>

                  {/* Spouses to the right, with heart link */}
                  {spouses.map((s, i) => {
                    const xOff = PERSON_GAP * (i + 1);
                    const sFill = colorFor(s.g);
                    return (
                      <g
                        key={`${s.n}-${i}`}
                        transform={`translate(${xOff}, 0)`}
                      >
                        <line
                          x1={-PERSON_GAP + 22}
                          y1={0}
                          x2={-22}
                          y2={0}
                          stroke="#9ca3af"
                          strokeWidth={2}
                          strokeDasharray="4,3"
                        />
                        <text
                          x={-PERSON_GAP / 2}
                          y={-6}
                          textAnchor="middle"
                          fontSize={16}
                          fill="#dc2626"
                        >
                          ♥
                        </text>
                        <circle
                          r={20}
                          cx={0}
                          cy={0}
                          fill={sFill}
                          stroke="#ffffff"
                          strokeWidth={3}
                        />
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
                          {s.n}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            }}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-stone-500">
        👨 Male · 👩 Female · 🟢 Other / unset · ♥ link = spouse
      </p>
    </section>
  );
}
