"use client";

import Link from "next/link";
import { HowItWorks } from "@/components/HowItWorks";

export function Landing() {
  return (
    <div className="-mx-4 -my-6 sm:-mx-6 sm:-my-8">
      {/* Hero */}
      <section className="bg-gradient-to-b from-emerald-50 via-stone-50 to-white px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-3xl">🌳</p>
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl md:text-6xl">
            <span className="text-emerald-700">Apon</span>Roots
          </h1>
          <p className="mt-4 text-xl italic text-emerald-700 sm:text-2xl">
            Trace the roots, cherish the bonds.
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base text-stone-700 sm:text-lg">
            A modern, private space for families to map their tree, discover
            how they&apos;re connected, and pass their story on to the next
            generation.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Start your tree — it&apos;s free
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-stone-300 bg-white px-6 py-3 text-base font-semibold text-stone-700 transition hover:bg-stone-100"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Why this matters */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Why family history matters
          </p>
          <h2 className="text-center text-3xl font-bold text-stone-900 sm:text-4xl">
            Every family carries a story worth keeping.
          </h2>
          <div className="mt-10 space-y-6 text-base leading-relaxed text-stone-700 sm:text-lg">
            <p>
              The names of our grandparents. The villages our parents grew up
              in. The cousin who married into another country. These are the
              quiet, ordinary details that give us our identity — and they
              vanish, generation by generation, when no one writes them down.
            </p>
            <p>
              Children who know where they come from develop a stronger sense
              of self. Families that share their stories build deeper
              empathy. Cultures that preserve their lineage stay connected
              even as their children scatter across the globe.
            </p>
            <p>
              <strong className="text-stone-900">
                AponRoots is built so your family&apos;s story doesn&apos;t
                end with you.
              </strong>{" "}
              Add the people you remember today, invite your relatives to add
              their branches, and watch the picture grow into something your
              great-grandchildren will thank you for.
            </p>
          </div>
        </div>
      </section>

      {/* Tour */}
      <section className="bg-stone-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-2 text-center text-3xl font-bold text-stone-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mb-8 text-center text-stone-600">
            Six small steps. Your tree builds itself as you and your family add
            people.
          </p>
          <HowItWorks />
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-stone-900 sm:text-4xl">
            Built for real families
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              emoji="🤝"
              title="Designed for collaboration"
              body="Every relative can sign up and grow their side of the tree. In-laws and cousins connect automatically."
            />
            <Feature
              emoji="🔍"
              title="Knows every relationship"
              body='From "father" to "second cousin once removed" to "co-mother-in-law" — AponRoots names every connection automatically.'
            />
            <Feature
              emoji="🌳"
              title="Beautiful visual tree"
              body="See couples, multiple marriages, and generations laid out clearly. Tap anyone to make them the new root."
            />
            <Feature
              emoji="🔒"
              title="Private by default"
              body="Your tree is yours. Email/password or Google sign-in. No tracking ads. Edit access stays with whoever owns each entry."
            />
            <Feature
              emoji="📱"
              title="Works on every device"
              body="Add a great-aunt from your phone in line at the bank, or sit down at a laptop and chart out the whole branch."
            />
            <Feature
              emoji="💸"
              title="Free for families"
              body="No subscription. Add as many people as you like. We built this for our family — and yours."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Start with one name today.
          </h2>
          <p className="mt-4 text-lg text-emerald-100">
            In ten years, you&apos;ll be glad you did.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-md bg-white px-6 py-3 text-base font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
          >
            Create your free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-100 px-4 py-8 text-center text-sm text-stone-600 sm:px-6">
        <p>
          🌳 AponRoots ·{" "}
          <Link href="/login" className="text-emerald-700 hover:underline">
            Sign in
          </Link>{" "}
          ·{" "}
          <Link href="/signup" className="text-emerald-700 hover:underline">
            Sign up
          </Link>
        </p>
        <p className="mt-2 italic">Trace the roots, cherish the bonds.</p>
      </footer>
    </div>
  );
}

function Feature({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-3 text-3xl" aria-hidden>
        {emoji}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-stone-900">{title}</h3>
      <p className="text-sm leading-relaxed text-stone-600">{body}</p>
    </div>
  );
}
