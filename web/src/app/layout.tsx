import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "AponRoots — Family Tree",
  description: "Build your family tree and discover every relationship.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ colorScheme: "light" }}>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
