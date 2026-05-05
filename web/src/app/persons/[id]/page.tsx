"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";
import { PersonAvatar } from "@/components/PersonAvatar";

export default function PersonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const personId = Number(id);

  const { data: person, isLoading, error } = useQuery({
    queryKey: ["person", personId],
    queryFn: () => api.getPerson(personId),
  });
  const { data: people = [] } = useQuery({
    queryKey: ["persons", "all"],
    queryFn: () => api.listPersons(false),
  });

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  if (isLoading) return <p className="text-stone-500">Loading…</p>;
  if (error || !person)
    return (
      <p className="text-red-600">
        Couldn&apos;t load this person.
        <br />
        <Link href="/" className="text-emerald-700 underline">
          ← Back home
        </Link>
      </p>
    );

  const lifespan = formatLifespan(person);

  return (
    <article className="mx-auto max-w-3xl">
      <header className="flex flex-col items-center gap-4 border-b border-stone-200 pb-6 text-center">
        <PersonAvatar
          photoUrl={person.photo_url}
          gender={person.gender}
          name={person.name}
          size={140}
        />
        <div>
          <h1 className="text-3xl font-bold text-stone-900">{person.name}</h1>
          {lifespan && (
            <p className="mt-1 text-stone-600">{lifespan}</p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
            {person.occupation && <Pill>{person.occupation}</Pill>}
            {person.birthplace && <Pill>📍 Born in {person.birthplace}</Pill>}
            {person.current_location && (
              <Pill>🏠 Lives in {person.current_location}</Pill>
            )}
          </div>
          {person.can_edit && (
            <Link
              href={`/persons/${person.id}/edit`}
              className="mt-4 inline-block rounded-md border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              ✏️ Edit profile
            </Link>
          )}
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Group title="Parents" people={person.parent_ids} byId={byId} />
        <Group title="Spouses" people={person.spouse_ids} byId={byId} />
        <Group title="Children" people={person.children_ids} byId={byId} />
      </section>

      {person.notes && (
        <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-stone-900">Notes</h2>
          <p className="whitespace-pre-line text-stone-700">{person.notes}</p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/relationship?b=${person.id}`}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          🔍 Find relationship to {person.name.split(" ")[0]}
        </Link>
        <Link
          href={`/tree?root=${person.id}`}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          🌳 View family tree from here
        </Link>
      </div>
    </article>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">
      {children}
    </span>
  );
}

function Group({
  title,
  people,
  byId,
}: {
  title: string;
  people: number[];
  byId: Map<number, Person>;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h3>
      {people.length === 0 ? (
        <p className="text-sm text-stone-400">—</p>
      ) : (
        <ul className="space-y-2">
          {people.map((pid) => {
            const p = byId.get(pid);
            if (!p) return null;
            return (
              <li key={pid}>
                <Link
                  href={`/persons/${pid}`}
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-stone-50"
                >
                  <PersonAvatar
                    photoUrl={p.photo_url}
                    gender={p.gender}
                    name={p.name}
                    size={32}
                  />
                  <span className="text-sm font-medium text-stone-800">
                    {p.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatLifespan(p: Person): string | null {
  if (!p.birth_date && !p.death_date) return null;
  const by = p.birth_date?.slice(0, 4) ?? "?";
  const dy = p.death_date?.slice(0, 4) ?? null;
  if (dy) return `${by} – ${dy}`;
  return `b. ${by}`;
}
