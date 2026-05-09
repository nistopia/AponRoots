"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";
import { PersonAvatar } from "@/components/PersonAvatar";

interface FeaturedTree {
  slug: string;
  label: string;
  description: string;
  rootPersonId: number;
  emoji: string;
}

// Hardcoded list of seeded demo trees on prod (owned by demo@aponroots.com).
// Add new entries as you seed each tree.
const FEATURED_TREES: FeaturedTree[] = [
  {
    slug: "british_royals",
    label: "British Royals — House of Windsor",
    description:
      "From King George V (b. 1865) down to Prince Louis. 24 people, four generations of monarchs and consorts.",
    rootPersonId: 67,
    emoji: "👑",
  },
  {
    slug: "mughals",
    label: "Mughal Emperors",
    description:
      "Babur to Bahadur Shah I — six generations of emperors, plus Mumtaz Mahal and the children of Shah Jahan. 19 people.",
    rootPersonId: 91,
    emoji: "🕌",
  },
  {
    slug: "tagore",
    label: "Tagore Family — Bengali Literary Dynasty",
    description:
      "Three generations centered on Nobel laureate Rabindranath Tagore, including the Bengal School artists Abanindranath and Gaganendranath. 21 people.",
    rootPersonId: 110,
    emoji: "📜",
  },
  {
    slug: "nehru_gandhi",
    label: "Nehru–Gandhi Family",
    description:
      "Motilal Nehru down to today — Jawaharlal, Indira, Rajiv, and the next generation. 19 people.",
    rootPersonId: 131,
    emoji: "🇮🇳",
  },
  {
    slug: "greek_olympians",
    label: "Greek Gods — Olympian Pantheon",
    description:
      "Mythological genealogy from Uranus and Gaia through Cronus to Zeus and the twelve Olympians. 26 figures.",
    rootPersonId: 150,
    emoji: "⚡",
  },
  {
    slug: "house_stark",
    label: "House Stark (A Song of Ice and Fire)",
    description:
      "Rickard Stark and his descendants — the Stark children of Winterfell, plus Jon Snow's true parentage. 17 figures.",
    rootPersonId: 176,
    emoji: "🐺",
  },
];

export default function FamousTreesPage() {
  const queries = useQueries({
    queries: FEATURED_TREES.map((t) => ({
      queryKey: ["person", t.rootPersonId],
      queryFn: () => api.getPerson(t.rootPersonId),
      retry: false,
    })),
  });

  return (
    <section className="max-w-4xl">
      <div className="mb-2 flex items-end gap-3">
        <h1 className="text-2xl font-semibold">Famous Trees</h1>
        <span className="text-sm text-stone-500">
          Explore historical family trees seeded as demos.
        </span>
      </div>
      <p className="mb-6 text-sm text-stone-600">
        These are curated public-domain genealogies you can browse to see
        what AponRoots can do. They&apos;re read-only for everyone except
        the demo account that owns them.
      </p>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FEATURED_TREES.map((t, i) => {
          const q = queries[i];
          const root: Person | undefined = q.data;
          return (
            <li
              key={t.slug}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-3xl" aria-hidden>
                  {t.emoji}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-stone-900">
                    {t.label}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {t.description}
                  </p>
                  {root ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                      <PersonAvatar
                        photoUrl={root.photo_url}
                        gender={root.gender}
                        name={root.name}
                        size={28}
                      />
                      <span>
                        Rooted at{" "}
                        <Link
                          href={`/persons/${root.id}`}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          {root.name}
                        </Link>
                      </span>
                    </div>
                  ) : q.isLoading ? (
                    <p className="mt-3 text-sm text-stone-400">
                      Loading root…
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-rose-600">
                      Tree not available right now.
                    </p>
                  )}
                </div>
              </div>
              {root && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/tree?root=${root.id}`}
                    className="rounded-md bg-emerald-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    🌳 View family tree
                  </Link>
                  <Link
                    href={`/persons/${root.id}`}
                    className="rounded-md border border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
                  >
                    Open profile
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
