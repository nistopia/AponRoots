"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { api, ApiError, getToken, setToken, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// "/" is public so logged-out users see the landing page.
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/about"];
// These routes redirect authenticated users INTO the app. The marketing
// landing at "/" stays accessible to logged-in users too (it then
// renders the family list itself).
const REDIRECT_AUTHED_AWAY_FROM = ["/login", "/signup"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Try to hydrate user from existing token on mount.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => setUser(u))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Redirect rules
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_ROUTES.includes(pathname);
    if (!user && !isPublic) {
      router.replace("/login");
    } else if (user && REDIRECT_AUTHED_AWAY_FROM.includes(pathname)) {
      router.replace("/");
    }
  }, [loading, user, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.login(email, password);
      setToken(r.access_token);
      setUser(r.user);
      router.replace("/");
    },
    [router],
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      const r = await api.signup(email, password, name);
      setToken(r.access_token);
      setUser(r.user);
      router.replace("/");
    },
    [router],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) => {
      const r = await api.google(credential);
      setToken(r.access_token);
      setUser(r.user);
      router.replace("/");
    },
    [router],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.replace("/");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
