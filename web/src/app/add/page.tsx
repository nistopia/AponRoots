"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Gender } from "@/lib/api";

export default function AddPersonPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({
    queryKey: ["persons"],
    queryFn: api.listPersons,
  });

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [parentIds, setParentIds] = useState<number[]>([]);

  const create = useMutation({
    mutationFn: api.createPerson,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["persons"] });
      router.push("/");
    },
  });

  const toggleParent = (id: number) => {
    setParentIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length >= 2
        ? prev
        : [...prev, id],
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({
      name: name.trim(),
      gender: gender || null,
      birth_date: birthDate || null,
      parent_ids: parentIds,
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
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. Alice Johnson"
          />
        </Field>

        <Field label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender | "")}
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Prefer not to say</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="X">Other / Non-binary</option>
          </select>
        </Field>

        <Field label="Birth date">
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
          />
        </Field>

        <Field label={`Parents (pick up to 2) — ${parentIds.length}/2 selected`}>
          {people.length === 0 ? (
            <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-500">
              No existing people yet — this person will be a root.
            </p>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-stone-200 p-2">
              {people.map((p) => {
                const checked = parentIds.includes(p.id);
                const disabled = !checked && parentIds.length >= 2;
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 rounded px-2 py-1 ${
                      disabled
                        ? "opacity-40"
                        : "cursor-pointer hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleParent(p.id)}
                    />
                    <span>
                      {p.name}{" "}
                      <span className="text-xs text-stone-500">
                        {p.gender ? `(${p.gender})` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>

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
