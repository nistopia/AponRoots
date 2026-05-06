"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { AuthShell, Divider } from "../login/page";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message.replace(/^API \d+: /, "")
          : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password">
      {done ? (
        <div className="space-y-4">
          <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            If <strong>{email}</strong> is registered, we&apos;ve sent a reset
            link. The link expires in 1 hour. Check your inbox (and spam
            folder).
          </p>
          <p className="text-center text-sm text-stone-600">
            <Link
              href="/login"
              className="font-medium text-emerald-700 hover:underline"
            >
              ← Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <>
          <p className="mb-5 text-sm text-stone-600">
            Enter the email you signed up with. We&apos;ll send you a link to
            set a new password.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none"
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
          <Divider />
          <p className="text-center text-sm text-stone-600">
            <Link
              href="/login"
              className="font-medium text-emerald-700 hover:underline"
            >
              ← Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
