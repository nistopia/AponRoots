"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";

// react-d3-tree is client-only and uses window — load dynamically.
const Tree = dynamic(() => import("react-d3-tree"), { ssr: false });

interface TreeNode {
  name: string;
  attributes?: Record<string, string>;
  children?: TreeNode[];
}

function buildTree(rootId: number, byId: Map<number, Person>): TreeNode {
  const seen = new Set<number>();
  const walk = (id: number): TreeNode => {
    const p = byId.get(id);
    if (!p || seen.has(id)) return { name: p?.name ?? `#${id}` };
    seen.add(id);
    return {
      name: p.name,
      attributes: p.gender ? { gender: p.gender } : undefined,
      children: p.children_ids.map(walk),
    };
  };
  return walk(rootId);
}

export default function TreePage() {
  const { data: people = [], isLoading } = useQuery({
    queryKey: ["persons"],
    queryFn: api.listPersons,
  });

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const roots = useMemo(
    () => people.filter((p) => p.parent_ids.length === 0),
    [people],
  );

  const [rootId, setRootId] = useState<number | "">("");
  const effectiveRoot: number | undefined =
    rootId === "" ? roots[0]?.id : rootId;

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

  const tree =
    effectiveRoot !== undefined ? buildTree(effectiveRoot, byId) : null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Family tree</h1>
        <select
          value={rootId}
          onChange={(e) =>
            setRootId(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="rounded-md border border-stone-300 px-3 py-1.5 text-sm"
        >
          {roots.map((r) => (
            <option key={r.id} value={r.id}>
              Root: {r.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-stone-500">
          {roots.length} root{roots.length === 1 ? "" : "s"} ·{" "}
          {people.length} people
        </span>
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
            separation={{ siblings: 1.2, nonSiblings: 1.5 }}
            nodeSize={{ x: 180, y: 100 }}
            renderCustomNodeElement={({ nodeDatum }) => {
              const gender = nodeDatum.attributes?.gender;
              const fill =
                gender === "F" ? "#db2777" : gender === "M" ? "#1d4ed8" : "#047857";
              return (
                <g>
                  <circle r={20} fill={fill} stroke="#ffffff" strokeWidth={3} />
                  {/* white halo behind the text for readability on any bg */}
                  <text
                    x={28}
                    y={6}
                    fontSize={16}
                    fontWeight={700}
                    stroke="#ffffff"
                    strokeWidth={5}
                    paintOrder="stroke"
                    fill="#0f172a"
                    style={{ fontFamily: "system-ui, sans-serif" }}
                  >
                    {nodeDatum.name}
                  </text>
                </g>
              );
            }}
          />
        )}
      </div>
    </section>
  );
}
