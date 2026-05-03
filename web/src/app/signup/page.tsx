"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "../login/page";

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup(email, password, name || undefined);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^API \d+: /, "")
          : "Signup failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Create your account">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Your name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="name"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="email"
          />
        </Field>
        <Field label="Password (min 6 chars)">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete="new-password"
          />
        </Field>
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
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-emerald-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
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
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none";
