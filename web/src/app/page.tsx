"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";

export default function PeoplePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["persons"],
    queryFn: api.listPersons,
  });

  const del = useMutation({
    mutationFn: (id: number) => api.deletePerson(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["persons"] }),
  });

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (error)
    return (
      <p className="text-red-600">
        Failed to reach API: {(error as Error).message}
        <br />
        <span className="text-sm text-stone-500">
          Make sure the backend is running at{" "}
          <code>http://localhost:8000</code>.
        </span>
      </p>
    );

  const people = data ?? [];
  const byId = new Map(people.map((p) => [p.id, p]));

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">People in your tree</h1>
        <Link
          href="/add"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Add person
        </Link>
      </div>

      {people.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              byId={byId}
              onDelete={() => del.mutate(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonCard({
  person,
  byId,
  onDelete,
}: {
  person: Person;
  byId: Map<number, Person>;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {person.name}{" "}
            <span className="text-sm font-normal text-stone-500">
              {person.gender ? `(${person.gender})` : ""}
            </span>
          </h2>
          {person.birth_date && (
            <p className="text-sm text-stone-500">
              Born {person.birth_date}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete ${person.name}?`)) onDelete();
          }}
          className="text-xs text-stone-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <Detail label="Parents">
        {person.parent_ids.length > 0
          ? person.parent_ids
              .map((id) => byId.get(id)?.name ?? `#${id}`)
              .join(", ")
          : "—"}
      </Detail>
      <Detail label="Children">
        {person.children_ids.length > 0
          ? person.children_ids
              .map((id) => byId.get(id)?.name ?? `#${id}`)
              .join(", ")
          : "—"}
      </Detail>
    </li>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <p className="mt-2 text-sm">
      <span className="font-medium text-stone-600">{label}:</span>{" "}
      <span className="text-stone-800">{children}</span>
    </p>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
      <p className="text-lg text-stone-600">Your family tree is empty.</p>
      <Link
        href="/add"
        className="mt-4 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Add your first person
      </Link>
    </div>
  );
}
