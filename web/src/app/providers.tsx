"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, refetchOnWindowFocus: false },
        },
      }),
  );
  // GoogleOAuthProvider gracefully no-ops if clientId is empty.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  return (
    <QueryClientProvider client={client}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>{children}</AuthProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}
