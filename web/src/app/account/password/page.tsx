"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (loading) {
    return <p className="text-stone-500">Loading…</p>;
  }
  if (!user) {
    return (
      <p className="text-stone-600">
        Please{" "}
        <Link href="/login" className="text-emerald-700 underline">
          sign in
        </Link>{" "}
        to change your password.
      </p>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPw.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await api.changePassword(oldPw, newPw);
      setSuccess(true);
      setOldPw("");
      setNewPw("");
      setConfirm("");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message.replace(/^API \d+: /, "")
          : "Couldn't change password",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md">
      <h1 className="mb-2 text-2xl font-semibold text-stone-900">
        Change password
      </h1>
      <p className="mb-6 text-sm text-stone-600">
        Signed in as <strong>{user.email}</strong>.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Current password
          </label>
          <input
            type="password"
            required
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            New password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-stone-500">At least 6 characters.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Confirm new password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none"
            autoComplete="new-password"
          />
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✅ Password updated.
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="mt-6 text-sm text-stone-600">
        <Link
          href="/forgot-password"
          className="text-stone-500 hover:text-emerald-700 hover:underline"
        >
          Forgot your current password?
        </Link>
      </p>
    </section>
  );
}
