"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";
import { PersonAvatar } from "./PersonAvatar";

/** Profile photo control: shows current photo + change/remove actions. */
export function PhotoUploader({ person }: { person: Person }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadPhoto(person.id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", person.id] });
      qc.invalidateQueries({ queryKey: ["persons"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.removePhoto(person.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["person", person.id] });
      qc.invalidateQueries({ queryKey: ["persons"] });
    },
  });

  const [error, setError] = useState<string | null>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Photo too large (max 10 MB)");
      return;
    }
    setError(null);
    upload.mutate(f, {
      onError: (err) => {
        setError(
          err instanceof Error
            ? err.message.replace(/^API \d+: /, "")
            : "Upload failed",
        );
      },
    });
  };

  return (
    <div className="flex items-center gap-4">
      <PersonAvatar
        photoUrl={person.photo_url}
        gender={person.gender}
        name={person.name}
        size={96}
      />
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {upload.isPending
              ? "Uploading…"
              : person.photo_url
              ? "Change photo"
              : "Upload photo"}
          </button>
          {person.photo_url && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          JPEG/PNG, up to 10 MB. Will be auto-resized to 1024px and stripped
          of metadata.
        </p>
        {error && (
          <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
