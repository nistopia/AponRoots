"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Gender, type Person } from "@/lib/api";

export default function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const personId = Number(id);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: person, isLoading } = useQuery({
    queryKey: ["person", personId],
    queryFn: () => api.getPerson(personId),
  });
  const { data: people = [] } = useQuery({
    queryKey: ["persons"],
    queryFn: api.listPersons,
  });

  // Form state
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!person) return;
    setName(person.name);
    setGender((person.gender as Gender) ?? "");
    setBirthDate(person.birth_date ?? "");
    setDeathDate(person.death_date ?? "");
    setNotes(person.notes ?? "");
  }, [person]);

  const update = useMutation({
    mutationFn: () =>
      api.updatePerson(personId, {
        name: name.trim(),
        gender: gender || null,
        birth_date: birthDate || null,
        death_date: deathDate || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["person", personId] });
    },
  });

  const addParent = useMutation({
    mutationFn: (parentId: number) => api.addParent(personId, parentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person", personId] }),
  });
  const removeParent = useMutation({
    mutationFn: (parentId: number) => api.removeParent(personId, parentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person", personId] }),
  });
  const addSpouse = useMutation({
    mutationFn: (spouseId: number) => api.addSpouse(personId, spouseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person", personId] }),
  });
  const removeSpouse = useMutation({
    mutationFn: (spouseId: number) => api.removeSpouse(personId, spouseId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["person", personId] }),
  });

  if (isLoading || !person)
    return <p className="text-stone-500">Loading…</p>;

  const others = people.filter((p) => p.id !== personId);
  const availableParents = others.filter(
    (p) => !person.parent_ids.includes(p.id),
  );
  const availableSpouses = others.filter(
    (p) => !person.spouse_ids.includes(p.id),
  );

  return (
    <section className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Edit {person.name}</h1>
      <p className="mb-6 text-sm text-stone-500">ID #{person.id}</p>

      {/* Basic info */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
        className="space-y-4 rounded-lg border border-stone-200 bg-white p-5"
      >
        <h2 className="font-semibold">Personal info</h2>
        <Field label="Name *">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className={inputCls}
          >
            <option value="">Prefer not to say</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Other / Non-binary</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Birth date">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Death date">
            <input
              type="date"
              value={deathDate}
              onChange={(e) => setDeathDate(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
        {update.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {(update.error as Error).message}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className={primaryBtn}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className={secondaryBtn}
          >
            Done
          </button>
        </div>
      </form>

      {/* Parents */}
      <RelationshipSection
        title="Parents"
        items={person.parent_ids}
        people={people}
        available={availableParents}
        max={2}
        onAdd={(id) => addParent.mutate(id)}
        onRemove={(id) => removeParent.mutate(id)}
        addError={addParent.error as Error | null}
      />

      {/* Spouses */}
      <RelationshipSection
        title="Spouses / partners"
        items={person.spouse_ids}
        people={people}
        available={availableSpouses}
        onAdd={(id) => addSpouse.mutate(id)}
        onRemove={(id) => removeSpouse.mutate(id)}
        addError={addSpouse.error as Error | null}
      />
    </section>
  );
}

function RelationshipSection({
  title,
  items,
  people,
  available,
  max,
  onAdd,
  onRemove,
  addError,
}: {
  title: string;
  items: number[];
  people: Person[];
  available: Person[];
  max?: number;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  addError: Error | null;
}) {
  const [pick, setPick] = useState<number | "">("");
  const atLimit = max !== undefined && items.length >= max;

  return (
    <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="mb-3 font-semibold">
        {title}{" "}
        {max && (
          <span className="text-sm font-normal text-stone-500">
            ({items.length}/{max})
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">None.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((id) => {
            const p = people.find((x) => x.id === id);
            return (
              <li
                key={id}
                className="flex items-center justify-between rounded-md bg-stone-50 px-3 py-2"
              >
                <span>{p?.name ?? `#${id}`}</span>
                <button
                  onClick={() => onRemove(id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!atLimit && available.length > 0 && (
        <div className="mt-4 flex gap-2">
          <select
            value={pick}
            onChange={(e) =>
              setPick(e.target.value === "" ? "" : Number(e.target.value))
            }
            className={`${inputCls} flex-1`}
          >
            <option value="">Add someone…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.gender ? `(${p.gender})` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (pick !== "") {
                onAdd(pick);
                setPick("");
              }
            }}
            disabled={pick === ""}
            className={primaryBtn}
          >
            Add
          </button>
        </div>
      )}
      {addError && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {addError.message}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none";
const primaryBtn =
  "rounded-md bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50";
const secondaryBtn =
  "rounded-md border border-stone-300 px-5 py-2 font-medium text-stone-700 hover:bg-stone-100";
