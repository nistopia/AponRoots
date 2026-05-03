"use client";

import type { Person, RelationshipResult } from "@/lib/api";

interface Step {
  id: number;
  name: string;
  gender: string | null;
  birthDate: string | null;
  /** "up" = parent of previous; "down" = child of previous; "lca" = common ancestor; "start" = first node */
  arrowFromPrev: "up" | "down" | null;
  isLCA: boolean;
}

function colorFor(gender: string | null): string {
  if (gender === "F") return "#db2777";
  if (gender === "M") return "#1d4ed8";
  return "#047857";
}

/**
 * Renders both a textual narration and a vertical ladder of the path
 * between two people, with up/down arrows annotating each step.
 *
 * Path semantics (from the backend):
 *   First (distance_a) edges go UP from A to the LCA
 *     → each next node is the parent of the previous
 *   Then (distance_b) edges go DOWN from the LCA to B
 *     → each next node is the child of the previous
 */
export function RelationshipPath({
  result,
  byId,
}: {
  result: RelationshipResult;
  byId: Map<number, Person>;
}) {
  const { path, distance_a, distance_b } = result;
  if (!path || path.length < 2 || distance_a === null || distance_b === null)
    return null;

  const steps: Step[] = path.map((id, i) => {
    const p = byId.get(id);
    let arrow: Step["arrowFromPrev"] = null;
    if (i > 0) {
      arrow = i <= distance_a ? "up" : "down";
    }
    return {
      id,
      name: p?.name ?? `#${id}`,
      gender: p?.gender ?? null,
      birthDate: p?.birth_date ?? null,
      arrowFromPrev: arrow,
      isLCA: i === distance_a, // by construction
    };
  });

  // Build the prose narration
  const aName = result.person_a_name;
  const bName = result.person_b_name;
  const lcaName = result.common_ancestor_name ?? "common ancestor";
  let narration: string;
  if (distance_a === 0 && distance_b > 0) {
    narration = `${bName} descends from ${aName} through ${distance_b} generation${
      distance_b === 1 ? "" : "s"
    }.`;
  } else if (distance_b === 0 && distance_a > 0) {
    narration = `${aName} descends from ${bName} through ${distance_a} generation${
      distance_a === 1 ? "" : "s"
    }.`;
  } else {
    narration = `From ${aName}, go up ${distance_a} generation${
      distance_a === 1 ? "" : "s"
    } to ${lcaName}${
      distance_a === distance_b ? "" : ""
    } (common ancestor), then down ${distance_b} generation${
      distance_b === 1 ? "" : "s"
    } to ${bName}.`;
  }

  return (
    <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
      <h3 className="mb-4 text-lg font-semibold text-stone-900">Path</h3>
      <p className="mb-6 text-stone-700">{narration}</p>

      <ol className="flex flex-col items-center gap-1">
        {steps.map((step, i) => (
          <li key={`${step.id}-${i}`} className="flex flex-col items-center">
            {step.arrowFromPrev && (
              <ArrowSegment
                direction={step.arrowFromPrev}
                label={
                  step.arrowFromPrev === "up"
                    ? "parent"
                    : "child"
                }
              />
            )}
            <PersonChip step={step} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function ArrowSegment({
  direction,
  label,
}: {
  direction: "up" | "down";
  label: string;
}) {
  return (
    <div className="my-1 flex flex-col items-center">
      <span
        className="text-sm font-medium text-stone-500"
        aria-hidden
      >
        {direction === "up" ? "↑" : "↓"}
      </span>
      <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
        {label}
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
          <div className="text-xs text-stone-500">b. {step.birthDate.slice(0, 4)}</div>
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
