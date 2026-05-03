import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

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
          <Header />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
