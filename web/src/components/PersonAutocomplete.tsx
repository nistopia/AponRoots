"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Person } from "@/lib/api";

/**
 * Text input with debounced autosuggest backed by the search API.
 * - Shows up to 8 matches as you type.
 * - Arrow keys + Enter to pick, Esc to close.
 * - Clicking outside dismisses.
 * - When a person is selected, the input shows their name. Editing the
 *   text deselects them (forces a fresh pick).
 *
 * Excludes any IDs in `excludeIds` from suggestions (e.g. "don't suggest
 * the other person you've already picked").
 */
export function PersonAutocomplete({
  label,
  value,
  onChange,
  excludeIds = [],
  placeholder = "Type a name…",
}: {
  label: string;
  value: number | null;
  onChange: (id: number | null, person?: Person) => void;
  excludeIds?: number[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // When `value` changes externally (e.g. parent clears it), sync the text.
  // We fetch the full directory once so we can show the selected person's name.
  const { data: allPeople = [] } = useQuery({
    queryKey: ["persons", "all"],
    queryFn: () => api.listPersons(false),
  });

  const selectedPerson = useMemo(
    () => allPeople.find((p) => p.id === value) ?? null,
    [allPeople, value],
  );

  // Sync displayed text with the selected person's name (when not actively typing)
  useEffect(() => {
    if (!open) {
      setText(selectedPerson?.name ?? "");
    }
  }, [selectedPerson, open]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 150);
    return () => clearTimeout(t);
  }, [text]);

  // Click outside closes
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

  const filtered = useMemo(
    () => results.filter((p) => !excludeIds.includes(p.id)),
    [results, excludeIds],
  );

  const select = (p: Person) => {
    onChange(p.id, p);
    setText(p.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setText("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === "ArrowDown" && text) {
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      select(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-stone-700">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
            // Editing text after a selection clears the choice.
            if (value !== null) onChange(null);
          }}
          onFocus={() => text && setOpen(true)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 pr-9 text-stone-900 placeholder:text-stone-400 focus:border-emerald-500 focus:outline-none"
        />
        {(text || value !== null) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-stone-400 hover:text-stone-700"
          >
            ✕
          </button>
        )}
      </div>

      {open && debounced && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-stone-500">No matches</p>
          ) : (
            <ul>
              {filtered.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => select(p)}
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
                      {p.birth_date ? `b. ${p.birth_date.slice(0, 4)}` : ""}
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
