"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, setToken } from "@/lib/api";
import { AuthShell } from "../login/page";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.resetPassword(token, pw);
      setToken(res.access_token);
      // Force a hard refresh so the auth context picks up the new token.
      window.location.href = "/";
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message.replace(/^API \d+: /, "")
          : "Couldn't reset password",
      );
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid reset link">
        <p className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-700">
          This page needs a reset token. Request a new one from the
          {" "}
          <Link href="/forgot-password" className="font-medium underline">
            forgot password
          </Link>
          {" "}
          page.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            New password
          </label>
          <input
            type="password"
            required
            autoFocus
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
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
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-700 px-5 py-2.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {submitting ? "Resetting…" : "Reset password"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        <button
          onClick={() => router.push("/login")}
          className="text-stone-500 hover:text-emerald-700 hover:underline"
        >
          ← Back to sign in
        </button>
      </p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Loading…"><div /></AuthShell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
