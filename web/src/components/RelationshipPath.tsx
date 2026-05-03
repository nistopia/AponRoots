"use client";

import type { Person, RelationshipResult } from "@/lib/api";

type Edge = "parent" | "child" | "spouse";

interface Step {
  id: number;
  name: string;
  gender: string | null;
  birthDate: string | null;
  /** edge from PREVIOUS node in the path to this one */
  edgeFromPrev: Edge | null;
  isLCA: boolean;
}

function colorFor(gender: string | null): string {
  if (gender === "F") return "#db2777";
  if (gender === "M") return "#1d4ed8";
  return "#047857";
}

/**
 * Renders both a textual narration and a vertical ladder of the path
 * between two people, with arrows annotating each step:
 *   ↑ parent  – next person is the parent of the previous
 *   ↓ child   – next person is the child of the previous
 *   ♥ spouse  – next person is the spouse of the previous
 *
 * Works for direct blood, in-laws (path includes a spouse hop),
 * and direct spouses (path = [A, B], one ♥ edge).
 */
export function RelationshipPath({
  result,
  byId,
}: {
  result: RelationshipResult;
  byId: Map<number, Person>;
}) {
  const { path, path_edges } = result;
  if (!path || path.length < 2) return null;

  // Determine which step (if any) is the LCA. Only meaningful for blood
  // and in-law paths (those have distance_a defined).
  const lcaIndex =
    result.common_ancestor_id !== null && result.distance_a !== null
      ? findLcaIndex(result, path)
      : -1;

  const steps: Step[] = path.map((id, i) => {
    const p = byId.get(id);
    const edge = i === 0 ? null : (path_edges[i - 1] as Edge | undefined) ?? null;
    return {
      id,
      name: p?.name ?? `#${id}`,
      gender: p?.gender ?? null,
      birthDate: p?.birth_date ?? null,
      edgeFromPrev: edge,
      isLCA: i === lcaIndex,
    };
  });

  const narration = buildNarration(result);

  return (
    <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-stone-900">Path</h3>
      <p className="mb-6 text-stone-700">{narration}</p>

      <ol className="flex flex-col items-center gap-1">
        {steps.map((step, i) => (
          <li key={`${step.id}-${i}`} className="flex flex-col items-center">
            {step.edgeFromPrev && <ArrowSegment edge={step.edgeFromPrev} />}
            <PersonChip step={step} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function findLcaIndex(result: RelationshipResult, path: number[]): number {
  // path_edges has structure: [maybe spouse?] + [N parent] + [M child] + [maybe spouse?]
  // The LCA sits right after the parent edges and right before the child edges.
  // Scan to find the first "child" edge; the LCA is at that step's predecessor (i.e. the source of the first child edge).
  const edges = result.path_edges ?? [];
  const firstChildIdx = edges.indexOf("child");
  if (firstChildIdx === -1) {
    // No child edges → no LCA we should highlight (e.g. spouse only)
    return -1;
  }
  return firstChildIdx; // node index where child edge starts = LCA position in path
}

function buildNarration(result: RelationshipResult): string {
  const {
    person_a_name: a,
    person_b_name: b,
    common_ancestor_name: lca,
    distance_a,
    distance_b,
    via,
    path_edges,
  } = result;

  const has = (k: string) => path_edges.includes(k as Edge);
  const fmtGen = (n: number) =>
    `${n} generation${n === 1 ? "" : "s"}`;

  if (via === "blood" && distance_a !== null && distance_b !== null) {
    if (distance_a === 0)
      return `${b} descends from ${a} through ${fmtGen(distance_b)}.`;
    if (distance_b === 0)
      return `${a} descends from ${b} through ${fmtGen(distance_a)}.`;
    return `From ${a}, go up ${fmtGen(distance_a)} to ${lca} (common ancestor), then down ${fmtGen(distance_b)} to ${b}.`;
  }

  if (via === "your-spouse" && distance_a !== null && distance_b !== null) {
    return `Through ${a}'s spouse, then up ${fmtGen(distance_a)} to ${lca} (common ancestor) and down ${fmtGen(distance_b)} to ${b}.`;
  }

  if (via === "their-spouse" && distance_a !== null && distance_b !== null) {
    return `From ${a}, up ${fmtGen(distance_a)} to ${lca} (common ancestor), down ${fmtGen(distance_b)} to ${b}'s spouse, then to ${b}.`;
  }

  if (via === "co-in-law" && distance_a !== null && distance_b !== null) {
    return `${a}'s descendant married ${b}'s descendant — they are connected through that marriage.`;
  }

  if (via === "spouse" || (path_edges.length === 1 && has("spouse"))) {
    return `${a} and ${b} are married.`;
  }

  return `${a} and ${b} are connected.`;
}

function ArrowSegment({ edge }: { edge: Edge }) {
  const config = {
    parent: { glyph: "↑", label: "parent", color: "text-stone-500" },
    child: { glyph: "↓", label: "child", color: "text-stone-500" },
    spouse: { glyph: "♥", label: "spouse", color: "text-rose-600" },
  }[edge];

  return (
    <div className="my-1 flex flex-col items-center">
      <span className={`text-base font-medium ${config.color}`} aria-hidden>
        {config.glyph}
      </span>
      <span
        className={`rounded px-2 py-0.5 text-xs ${
          edge === "spouse"
            ? "bg-rose-50 text-rose-700"
            : "bg-stone-100 text-stone-600"
        }`}
      >
        {config.label}
      </span>
    </div>
  );
}

function PersonChip({ step }: { step: Step }) {
  const fill = colorFor(step.gender);
  const isFemale = step.gender === "F";
  const isMale = step.gender === "M";
  const personEmoji = isFemale ? "👩" : isMale ? "👨" : "🧑";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2 shadow-sm ${
        step.isLCA
          ? "border-amber-400 bg-amber-50"
          : "border-stone-200 bg-white"
      }`}
    >
      <span
        className="inline-block h-3 w-3 rounded-full"
        style={{ backgroundColor: fill }}
        aria-hidden
      />
      <span className="text-lg" aria-hidden>
        {personEmoji}
      </span>
      <div>
        <div className="font-semibold text-stone-900">{step.name}</div>
        {step.birthDate && (
          <div className="text-xs text-stone-500">
            b. {step.birthDate.slice(0, 4)}
          </div>
        )}
      </div>
      {step.isLCA && (
        <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
          Common ancestor
        </span>
      )}
    </div>
  );
}
