"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Global header search. Debounced, keyboard-friendly, click-anywhere-to-close.
 * Uses the backend /persons/search endpoint so it scales beyond what the
 * home page has loaded.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: results = [] } = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api.searchPersons(debounced, 8),
    enabled: debounced.length > 0,
  });

  const go = (id: number) => {
    setOpen(false);
    setQ("");
    router.push(`/persons/${id}/edit`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[highlight].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        type="search"
        placeholder="Search people…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => q && setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
      />
      {open && debounced && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-500">No matches</p>
          ) : (
            <ul>
              {results.map((p, i) => (
                <li key={p.id}>
                  <button
                    onClick={() => go(p.id)}
                    onMouseEnter={() => setHighlight(i)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      i === highlight
                        ? "bg-emerald-50 text-emerald-900"
                        : "text-stone-800 hover:bg-stone-50"
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-stone-500">
                      {p.gender ? `(${p.gender})` : ""}{" "}
                      {p.birth_date ? p.birth_date.slice(0, 4) : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
