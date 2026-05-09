"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { HeaderSearch } from "./HeaderSearch";

export function Header() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const onAuthPage = pathname === "/login" || pathname === "/signup";
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = (
    <>
      <Link href="/" className="hover:text-emerald-700" onClick={() => setMenuOpen(false)}>People</Link>
      <Link href="/add" className="hover:text-emerald-700" onClick={() => setMenuOpen(false)}>Add</Link>
      <Link href="/relationship" className="hover:text-emerald-700" onClick={() => setMenuOpen(false)}>Relationship</Link>
      <Link href="/tree" className="hover:text-emerald-700" onClick={() => setMenuOpen(false)}>Tree</Link>
      <Link href="/famous-trees" className="hover:text-emerald-700" onClick={() => setMenuOpen(false)}>Famous Trees</Link>
    </>
  );

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
        <Link href={user ? "/" : "/login"} className="text-lg font-semibold tracking-tight sm:text-xl">
          🌳 <span className="text-emerald-700">Apon</span>Roots
        </Link>
        {!loading && user && !onAuthPage && (
          <>
            {/* Desktop layout */}
            <div className="hidden flex-1 items-center justify-end gap-6 lg:flex">
              <HeaderSearch />
              <nav className="flex gap-5 text-sm font-medium text-stone-700">{navLinks}</nav>
              <div className="flex items-center gap-3 border-l border-stone-200 pl-5">
                <div className="text-right">
                  <p className="text-sm font-medium text-stone-900">
                    <Link
                      href="/account/password"
                      className="hover:text-emerald-700 hover:underline"
                      title="Account settings"
                    >
                      {user.name || user.email}
                    </Link>
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

            {/* Mobile / tablet hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-md border border-stone-300 p-2 text-stone-700 hover:bg-stone-100 lg:hidden"
              aria-label="Toggle menu"
            >
              <span className="block h-0.5 w-5 bg-current"></span>
              <span className="mt-1 block h-0.5 w-5 bg-current"></span>
              <span className="mt-1 block h-0.5 w-5 bg-current"></span>
            </button>
          </>
        )}
      </div>

      {/* Mobile drawer */}
      {!loading && user && !onAuthPage && menuOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-3 lg:hidden">
          <div className="mb-3">
            <HeaderSearch />
          </div>
          <nav className="flex flex-col gap-3 text-base font-medium text-stone-700">
            {navLinks}
            <Link
              href="/account/password"
              className="hover:text-emerald-700"
              onClick={() => setMenuOpen(false)}
            >
              Change password
            </Link>
          </nav>
          <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3">
            <p className="text-sm text-stone-700">
              {user.name || user.email}
              {user.is_admin && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                  ADMIN
                </span>
              )}
            </p>
            <button
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="rounded-md border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:bg-stone-100"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
