"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Gender, type Person } from "@/lib/api";
import { PersonAutocomplete } from "@/components/PersonAutocomplete";

export default function AddPersonPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [parent1, setParent1] = useState<number | null>(null);
  const [parent2, setParent2] = useState<number | null>(null);
  const [children, setChildren] = useState<number[]>([]);
  const [childPick, setChildPick] = useState<number | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setPhotoError("Photo too large (max 10 MB)");
      setPhoto(null);
      return;
    }
    setPhotoError(null);
    setPhoto(f);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    const parent_ids = [parent1, parent2].filter(
      (id): id is number => id !== null,
    );
    const errors: string[] = [];
    try {
      const created = await api.createPerson({
        name: name.trim(),
        gender: gender || null,
        birth_date: birthDate || null,
        parent_ids,
      });

      if (photo) {
        try {
          await api.uploadPhoto(created.id, photo);
        } catch (err) {
          errors.push(
            `photo upload failed: ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }

      for (const childId of children) {
        try {
          await api.addParent(childId, created.id);
        } catch (err) {
          errors.push(
            `couldn't link child #${childId}: ${
              err instanceof Error ? err.message : "unknown error"
            }`,
          );
        }
      }

      qc.invalidateQueries({ queryKey: ["persons"] });
      qc.invalidateQueries({ queryKey: ["person", created.id] });

      if (errors.length === 0) {
        router.push(`/persons/${created.id}`);
        return;
      }
      setSubmitError(
        `Person added (id ${created.id}), but: ${errors.join("; ")}`,
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const photoPreview = photo ? URL.createObjectURL(photo) : null;

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
            Profile photo (optional)
          </h2>
          <div className="flex items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-stone-50 text-3xl"
              aria-hidden
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : gender === "F" ? (
                "👩"
              ) : gender === "M" ? (
                "👨"
              ) : (
                "👤"
              )}
            </div>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickPhoto}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  {photo ? "Change photo" : "Choose photo"}
                </button>
                {photo && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoto(null);
                      if (photoInputRef.current)
                        photoInputRef.current.value = "";
                    }}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-500">
                JPEG/PNG, up to 10 MB. Auto-resized to 1024px on upload.
              </p>
              {photoError && (
                <p className="mt-1 text-xs text-rose-700">{photoError}</p>
              )}
            </div>
          </div>
        </div>

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

        <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-700">
            Children (optional)
          </h2>
          <p className="text-xs text-stone-500">
            Pick existing people to link as children. Each child can have at
            most 2 parents.
          </p>
          {children.length > 0 && (
            <ul className="space-y-2">
              {children.map((id) => (
                <ChildRow
                  key={id}
                  id={id}
                  onRemove={() =>
                    setChildren((c) => c.filter((x) => x !== id))
                  }
                />
              ))}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <PersonAutocomplete
                label="Add a child"
                value={childPick}
                onChange={setChildPick}
                excludeIds={children}
                placeholder="Search by name…"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (childPick !== null && !children.includes(childPick)) {
                  setChildren((c) => [...c, childPick]);
                  setChildPick(null);
                }
              }}
              disabled={childPick === null}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {submitError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-md bg-emerald-700 px-5 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Add person"}
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

function ChildRow({
  id,
  onRemove,
}: {
  id: number;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const cached = qc
    .getQueryData<Person[]>(["persons"])
    ?.find((p) => p.id === id);
  return (
    <li className="flex items-center justify-between rounded-md bg-stone-50 px-3 py-2">
      <span className="text-sm">{cached?.name ?? `#${id}`}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-sm text-red-600 hover:underline"
      >
        Remove
      </button>
    </li>
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
