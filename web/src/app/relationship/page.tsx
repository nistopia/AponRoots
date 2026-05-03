"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PersonAutocomplete } from "@/components/PersonAutocomplete";
import { RelationshipPath } from "@/components/RelationshipPath";

export default function RelationshipPage() {
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);

  const enabled = aId !== null && bId !== null;
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["relationship", aId, bId],
    queryFn: () => api.findRelationship(aId!, bId!),
    enabled,
  });

  const { data: allPeople = [] } = useQuery({
    queryKey: ["persons", "all"],
    queryFn: () => api.listPersons(false),
  });
  const byId = useMemo(
    () => new Map(allPeople.map((p) => [p.id, p])),
    [allPeople],
  );

  return (
    <section className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Find a relationship</h1>
      <p className="mb-6 text-stone-600">
        Type a name in each box — AponRoots will compute exactly how
        they&apos;re related and show the path between them.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <PersonAutocomplete
          label="Person A"
          value={aId}
          onChange={setAId}
          excludeIds={bId !== null ? [bId] : []}
        />
        <PersonAutocomplete
          label="Person B"
          value={bId}
          onChange={setBId}
          excludeIds={aId !== null ? [aId] : []}
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
        <>
          <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <p className="text-2xl font-semibold text-emerald-900">
              {data.relationship}
            </p>
            {data.common_ancestor_name && (
              <p className="mt-2 text-sm text-emerald-800">
                Common ancestor:{" "}
                <span className="font-medium">
                  {data.common_ancestor_name}
                </span>
              </p>
            )}
          </div>

          {data.path && data.path.length >= 2 && (
            <RelationshipPath result={data} byId={byId} />
          )}
        </>
      )}
    </section>
  );
}