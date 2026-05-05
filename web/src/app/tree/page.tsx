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
    photoUrl?: string;
    personId?: string;
    spouseName?: string;
    spouseGender?: string;
    spousePhotoUrl?: string;
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

    // Case 1: no spouses, no children
    if (marriages.length === 0 && soloKids.length === 0) {
      return basicPersonNode(p);
    }

    // Case 2: no spouses, just solo children
    if (marriages.length === 0) {
      const kids = soloKids
        .map(walk)
        .filter((k): k is TreeNode => k !== null);
      return {
        ...basicPersonNode(p),
        children: kids.length > 0 ? kids : undefined,
      };
    }

    // Case 3: exactly one spouse — render the couple at this level and
    // hang ALL children below them (joint + any with unknown other parent).
    if (marriages.length === 1) {
      const [spouseId, jointKidIds] = marriages[0];
      const spouse = byId.get(spouseId);
      if (spouse) rendered.add(spouseId);

      const allKidIds = [...jointKidIds, ...soloKids];
      const kids = allKidIds
        .map(walk)
        .filter((k): k is TreeNode => k !== null);

      return {
        name: p.name,
        attributes: {
          type: "couple",
          gender: p.gender ?? "",
          photoUrl: p.photo_url ?? "",
          personId: String(p.id),
          spouseName: spouse?.name ?? "",
          spouseGender: spouse?.gender ?? "",
          spousePhotoUrl: spouse?.photo_url ?? "",
          spouseId: spouse ? String(spouse.id) : "",
        },
        children: kids.length > 0 ? kids : undefined,
      };
    }

    // Case 4: multiple marriages (with or without solo kids).
    // Render P alone at the top, then for each marriage create a
    // marriage_branch node so the tree clearly shows which kids came
    // from which marriage.
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
          photoUrl: spouse.photo_url ?? "",
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
        photoUrl: p.photo_url ?? "",
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
      photoUrl: p.photo_url ?? "",
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

const PERSON_GAP = 150;

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
        {!tree && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-stone-500">
            <span className="mb-2 text-4xl" aria-hidden>
              🌳
            </span>
            <p className="text-sm">
              Type a name above to view the family tree rooted at that person.
            </p>
          </div>
        )}
        {tree && (
          <Tree
            data={tree}
            orientation="vertical"
            collapsible={false}
            translate={{ x: containerWidth / 2, y: 60 }}
            // Step-style elbow path, but for child nodes that are couples
            // we shift the target x to the LEFT half so the line clearly
            // lands on the blood-descendant (primary) emoji rather than
            // on the heart between the couple.
            pathFunc={(linkData) => {
              const { source, target } = linkData;
              const targetType = (
                (target.data as { attributes?: { type?: string } } | null)
                  ?.attributes?.type ?? "person"
              ) as string;
              const tx =
                targetType === "couple"
                  ? target.x - PERSON_GAP / 2
                  : target.x;
              const ty = target.y - 26; // stop just above the emoji
              const midY = (source.y + ty) / 2;
              return `M${source.x},${source.y} L${source.x},${midY} L${tx},${midY} L${tx},${ty}`;
            }}
            separation={{ siblings: 1.4, nonSiblings: 1.8 }}
            nodeSize={{ x: 280, y: 150 }}
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
                const spousePhotoUrl = (nodeDatum.attributes?.spousePhotoUrl ??
                  "") as string;
                const spouseIdStr = nodeDatum.attributes?.spouseId as
                  | string
                  | undefined;
                const spouseId = spouseIdStr
                  ? parseInt(spouseIdStr, 10)
                  : null;
                const photoUrl = (nodeDatum.attributes?.photoUrl ?? "") as string;
                const halfGap = PERSON_GAP / 2;
                return (
                  <g>
                    {personGlyph(-halfGap, gender, photoUrl, nodeDatum.name, handleClick(personId))}
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
                      spousePhotoUrl,
                      spouseName,
                      handleClick(spouseId),
                    )}
                  </g>
                );
              }

              if (type === "marriage_branch") {
                const photoUrl = (nodeDatum.attributes?.photoUrl ?? "") as string;
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
                    {personGlyph(0, gender, photoUrl, nodeDatum.name, handleClick(personId))}
                  </g>
                );
              }

              const photoUrl = (nodeDatum.attributes?.photoUrl ?? "") as string;
              return personGlyph(0, gender, photoUrl, nodeDatum.name, handleClick(personId));
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

/** Renders a person as a photo (if available) or emoji + name.
 *  Uses foreignObject + HTML so the browser's full image / emoji rendering
 *  pipeline is used (more reliable than SVG <text> across iOS Chrome / Safari). */
function personGlyph(
  x: number,
  gender: string | undefined | null,
  photoUrl: string | null | undefined,
  name: string,
  onClick: () => void,
) {
  const hasPhoto = !!photoUrl;
  return (
    <g
      transform={`translate(${x}, 0)`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      {/* Visible white background circle that doubles as the hit area */}
      <circle r={26} cx={0} cy={0} fill="#ffffff" stroke="#e7e5e4" strokeWidth={1} />
      <foreignObject x={-22} y={-22} width={44} height={44}>
        <div
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as any)}
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            lineHeight: 1,
            userSelect: "none",
            overflow: "hidden",
            borderRadius: "50%",
            fontFamily:
              '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
          }}
        >
          {hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl as string}
              alt={name}
              width={44}
              height={44}
              style={{
                width: 44,
                height: 44,
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
            />
          ) : (
            emojiFor(gender)
          )}
        </div>
      </foreignObject>
      {/* Name as wrapping HTML so long names break to multiple lines */}
      <foreignObject x={-45} y={28} width={90} height={52}>
        <div
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...({ xmlns: "http://www.w3.org/1999/xhtml" } as any)}
          style={{
            width: 90,
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#0f172a",
            fontFamily: "system-ui, sans-serif",
            userSelect: "none",
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {name}
        </div>
      </foreignObject>
    </g>
  );
}
