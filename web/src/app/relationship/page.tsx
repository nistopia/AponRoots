"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function RelationshipPage() {
  const { data: people = [] } = useQuery({
    queryKey: ["persons"],
    queryFn: api.listPersons,
  });

  const [aId, setAId] = useState<number | "">("");
  const [bId, setBId] = useState<number | "">("");

  const enabled = aId !== "" && bId !== "";
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["relationship", aId, bId],
    queryFn: () => api.findRelationship(Number(aId), Number(bId)),
    enabled,
  });

  return (
    <section className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Find a relationship</h1>
      <p className="mb-6 text-stone-600">
        Pick two people in your tree — AponRoots will compute exactly how
        they&apos;re related.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <PersonPicker
          label="Person A"
          value={aId}
          onChange={setAId}
          options={people}
        />
        <PersonPicker
          label="Person B"
          value={bId}
          onChange={setBId}
          options={people}
        />
      </div>

      <button
        onClick={() => refetch()}
        disabled={!enabled}
        className="mt-6 rounded-md bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {isFetching ? "Finding…" : "Find relationship"}
      </button>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error).message}
        </p>
      )}

      {data && enabled && (
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-2xl font-semibold text-emerald-900">
            {data.relationship}
          </p>
          {data.common_ancestor_name && (
            <p className="mt-2 text-sm text-emerald-800">
              Common ancestor:{" "}
              <span className="font-medium">{data.common_ancestor_name}</span>
              {data.distance_a !== null && data.distance_b !== null && (
                <>
                  {" "}
                  · {data.person_a_name} is {data.distance_a} generation(s)
                  away · {data.person_b_name} is {data.distance_b}
                </>
              )}
            </p>
          )}
          {data.path.length > 0 && (
            <p className="mt-3 text-sm text-emerald-800">
              Path:{" "}
              {data.path
                .map((id) => people.find((p) => p.id === id)?.name ?? `#${id}`)
                .join(" → ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function PersonPicker({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  options: { id: number; name: string; gender: string | null }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
      >
        <option value="">Select a person…</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.gender ? `(${p.gender})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
