"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { HeaderSearch } from "./HeaderSearch";

export function Header() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const onAuthPage = pathname === "/login" || pathname === "/signup";

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href={user ? "/" : "/login"} className="text-xl font-semibold tracking-tight">
          🌳 <span className="text-emerald-700">Apon</span>Roots
        </Link>
        {!loading && user && !onAuthPage && (
          <div className="flex flex-1 items-center justify-end gap-6">
            <HeaderSearch />
            <nav className="flex gap-5 text-sm font-medium text-stone-700">
              <Link href="/" className="hover:text-emerald-700">People</Link>
              <Link href="/add" className="hover:text-emerald-700">Add</Link>
              <Link href="/relationship" className="hover:text-emerald-700">Relationship</Link>
              <Link href="/tree" className="hover:text-emerald-700">Tree</Link>
            </nav>
            <div className="flex items-center gap-3 border-l border-stone-200 pl-5">
              <div className="text-right">
                <p className="text-sm font-medium text-stone-900">
                  {user.name || user.email}
                  {user.is_admin && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                      ADMIN
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={logout}
                className="rounded-md border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:bg-stone-100"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
