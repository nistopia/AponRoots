"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Gender } from "@/lib/api";
import { PersonAutocomplete } from "@/components/PersonAutocomplete";

export default function AddPersonPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [parent1, setParent1] = useState<number | null>(null);
  const [parent2, setParent2] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: api.createPerson,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      router.push("/");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parent_ids = [parent1, parent2].filter(
      (id): id is number => id !== null,
    );
    create.mutate({
      name: name.trim(),
      gender: gender || null,
      birth_date: birthDate || null,
      parent_ids,
    });
  };

  return (
    <section className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Add a person</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Name *">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Alice Johnson"
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

        <Field label="Birth date">
          <div className="flex items-stretch gap-1">
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={`${inputCls} flex-1`}
            />
            {birthDate && (
              <button
                type="button"
                onClick={() => setBirthDate("")}
                title="Clear birth date"
                className="rounded-md border border-stone-300 px-2 text-stone-500 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700"
              >
                ✕
              </button>
            )}
          </div>
        </Field>

        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">
            Parents (optional)
          </h2>
          <PersonAutocomplete
            label="Parent 1"
            value={parent1}
            onChange={setParent1}
            excludeIds={parent2 !== null ? [parent2] : []}
            placeholder="Search by name…"
          />
          <PersonAutocomplete
            label="Parent 2"
            value={parent2}
            onChange={setParent2}
            excludeIds={parent1 !== null ? [parent1] : []}
            placeholder="Search by name…"
          />
        </div>

        {create.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {(create.error as Error).message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={create.isPending || !name.trim()}
            className="rounded-md bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Add person"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md border border-stone-300 px-5 py-2 font-medium text-stone-700 hover:bg-stone-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
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
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus:border-emerald-500 focus:outline-none";
