"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

  const [filter, setFilter] = useState("");
  const people = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, filter]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

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

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-stone-900">
          People in your tree
        </h1>
        <Link
          href="/add"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Add person
        </Link>
      </div>

      {people.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <input
            type="search"
            placeholder="Filter by name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
          />
          <span className="text-sm text-stone-500">
            {filtered.length} of {people.length}
          </span>
        </div>
      )}

      {people.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
          No people match &ldquo;{filter}&rdquo;.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
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
  const names = (ids: number[]) =>
    ids.length > 0
      ? ids.map((id) => byId.get(id)?.name ?? `#${id}`).join(", ")
      : "—";

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
            <p className="text-sm text-stone-500">Born {person.birth_date}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {person.can_edit ? (
            <>
              <Link
                href={`/persons/${person.id}/edit`}
                className="text-xs font-medium text-emerald-700 hover:underline"
              >
                Edit
              </Link>
              <button
                onClick={() => {
                  if (confirm(`Delete ${person.name}?`)) onDelete();
                }}
                className="text-xs text-stone-400 hover:text-red-600"
                title="Delete"
              >
                ✕
              </button>
            </>
          ) : (
            <span
              className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-medium text-stone-500"
              title="You can read this entry but only the owner can modify it."
            >
              Read-only
            </span>
          )}
        </div>
      </div>

      <Detail label="Parents">{names(person.parent_ids)}</Detail>
      <Detail label="Children">{names(person.children_ids)}</Detail>
      <Detail label="Spouses">{names(person.spouse_ids)}</Detail>
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
