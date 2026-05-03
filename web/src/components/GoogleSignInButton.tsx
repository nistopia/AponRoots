"use client";

import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";

/** Renders the official Google "Sign in with Google" button.
 *  No-ops gracefully if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set. */
export function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return (
      <p className="rounded-md bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
        Google sign-in is not configured. Set
        <code className="mx-1">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>
        in <code>web/.env.local</code> to enable it.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <GoogleLogin
        onSuccess={async (resp) => {
          setError(null);
          if (!resp.credential) {
            setError("No credential returned from Google");
            return;
          }
          try {
            await loginWithGoogle(resp.credential);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message.replace(/^API \d+: /, "")
                : "Google sign-in failed",
            );
          }
        }}
        onError={() => setError("Google sign-in was cancelled or failed.")}
        theme="outline"
        size="large"
        width="320"
      />
      {error && (
        <p className="w-full rounded-md bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
