"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type SubtreeGrant } from "@/lib/api";

interface Props {
  personId: number;
  personName: string;
}

/**
 * Sharing controls for a Person — list, add, and revoke SubtreeGrants.
 *
 * Only meant to be rendered for the entry's owner. The backend will
 * still reject if a non-owner tries; the UI just hides the controls.
 */
export function SharingSection({ personId, personName }: Props) {
  const qc = useQueryClient();
  const grantsQ = useQuery({
    queryKey: ["grants", personId],
    queryFn: () => api.listGrants(personId),
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (granteeEmail: string) => api.createGrant(personId, granteeEmail),
    onSuccess: () => {
      setEmail("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["grants", personId] });
    },
    onError: (e) => {
      setError(
        e instanceof ApiError
          ? e.message.replace(/^API \d+: /, "").replace(/^\{"detail":"|"\}$/g, "")
          : "Couldn't share access",
      );
    },
  });

  const revokeMut = useMutation({
    mutationFn: (grantId: number) => api.revokeGrant(personId, grantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["grants", personId] }),
  });

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    addMut.mutate(email.trim());
  };

  return (
    <section className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="mb-1 font-semibold text-stone-900">Sharing</h2>
      <p className="mb-4 text-sm text-stone-600">
        People you add here can edit{" "}
        <strong>{personName}</strong>
        {" "}and all of their blood descendants. They can&apos;t re-share or
        delete your account.
      </p>

      <form onSubmit={onAdd} className="mb-4 flex flex-wrap items-stretch gap-2">
        <input
          type="email"
          required
          placeholder="user@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-[14rem] flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-500 focus:outline-none"
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={addMut.isPending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {addMut.isPending ? "Sharing…" : "Share edit access"}
        </button>
      </form>
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {grantsQ.isLoading && (
        <p className="text-sm text-stone-500">Loading current access…</p>
      )}

      {grantsQ.data && grantsQ.data.length === 0 && (
        <p className="text-sm italic text-stone-500">
          Not shared with anyone yet.
        </p>
      )}

      {grantsQ.data && grantsQ.data.length > 0 && (
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200">
          {grantsQ.data.map((g: SubtreeGrant) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-stone-900">
                  {g.grantee_name || g.grantee_email}
                </p>
                {g.grantee_name && (
                  <p className="text-xs text-stone-500">{g.grantee_email}</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Revoke ${g.grantee_email}'s edit access on ${personName}'s subtree?`,
                    )
                  ) {
                    revokeMut.mutate(g.id);
                  }
                }}
                disabled={revokeMut.isPending}
                className="rounded-md border border-stone-300 px-3 py-1 text-xs text-stone-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
