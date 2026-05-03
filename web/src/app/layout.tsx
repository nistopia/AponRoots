import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AponRoots — Family Tree",
  description: "Build your family tree and discover every relationship.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <Providers>
          <header className="border-b border-stone-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-xl font-semibold tracking-tight">
                🌳 <span className="text-emerald-700">Apon</span>Roots
              </Link>
              <nav className="flex gap-6 text-sm font-medium text-stone-700">
                <Link href="/" className="hover:text-emerald-700">
                  People
                </Link>
                <Link href="/add" className="hover:text-emerald-700">
                  Add Person
                </Link>
                <Link href="/relationship" className="hover:text-emerald-700">
                  Find Relationship
                </Link>
                <Link href="/tree" className="hover:text-emerald-700">
                  Tree
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
