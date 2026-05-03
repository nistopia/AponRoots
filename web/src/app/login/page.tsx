"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^API \d+: /, "")
          : "Login failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Welcome back">
      <div className="mb-5 flex justify-center">
        <GoogleSignInButton />
      </div>
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
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
        <Field label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            autoComplete="current-password"
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
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-stone-600">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-emerald-700 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-8 max-w-md">
      <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-stone-900">
          🌳 AponRoots
        </h1>
        <h2 className="mb-6 text-lg text-stone-600">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-stone-400">
      <hr className="flex-1 border-stone-200" />
      <span>or with email</span>
      <hr className="flex-1 border-stone-200" />
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
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-emerald-500 focus:outline-none";
