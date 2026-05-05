"use client";

import { useEffect, useState } from "react";

interface Step {
  emoji: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    emoji: "🌱",
    title: "Add yourself first",
    body: "Sign up, then create your own entry — your name, gender, birth date.",
    visual: (
      <MockCard>
        <span className="text-3xl">👨</span>
        <span className="font-semibold">Arjun</span>
      </MockCard>
    ),
  },
  {
    emoji: "👨‍👩‍👧",
    title: "Add your parents",
    body: "Each new person can link to up to two parents using a simple search box.",
    visual: (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <MockCard>
            <span className="text-2xl">👨</span>
            <span className="text-xs font-semibold">Vikram</span>
          </MockCard>
          <span className="text-rose-500">♥</span>
          <MockCard>
            <span className="text-2xl">👩</span>
            <span className="text-xs font-semibold">Lakshmi</span>
          </MockCard>
        </div>
        <span className="text-stone-300">│</span>
        <MockCard>
          <span className="text-2xl">👨</span>
          <span className="text-xs font-semibold">Arjun</span>
        </MockCard>
      </div>
    ),
  },
  {
    emoji: "💍",
    title: "Add your spouse",
    body: "Mark partnerships and they show up linked by ♥ in the family tree.",
    visual: (
      <div className="flex items-center gap-3">
        <MockCard>
          <span className="text-3xl">👨</span>
          <span className="text-xs font-semibold">Arjun</span>
        </MockCard>
        <span className="text-2xl text-rose-500">♥</span>
        <MockCard>
          <span className="text-3xl">👩</span>
          <span className="text-xs font-semibold">Priya</span>
        </MockCard>
      </div>
    ),
  },
  {
    emoji: "🌳",
    title: "Watch your tree grow",
    body: "Tap any person to make them the root and explore in any direction.",
    visual: (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <MockCard>
            <span className="text-2xl">👨</span>
            <span className="text-[10px] font-semibold">Arjun</span>
          </MockCard>
          <span className="text-rose-500">♥</span>
          <MockCard>
            <span className="text-2xl">👩</span>
            <span className="text-[10px] font-semibold">Priya</span>
          </MockCard>
        </div>
        <span className="text-stone-300">│</span>
        <div className="flex items-center gap-2">
          <MockCard>
            <span className="text-xl">👦</span>
            <span className="text-[10px] font-semibold">Rohan</span>
          </MockCard>
          <MockCard>
            <span className="text-xl">👧</span>
            <span className="text-[10px] font-semibold">Maya</span>
          </MockCard>
        </div>
      </div>
    ),
  },
  {
    emoji: "🔍",
    title: "Discover relationships",
    body: 'Pick any two people and AponRoots names exactly how they\'re related — even "second cousin once removed" or "co-mother-in-law".',
    visual: (
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="flex items-center gap-3">
          <MockCard>
            <span className="text-2xl">👩</span>
            <span className="text-[10px] font-semibold">Maya</span>
          </MockCard>
          <span className="text-stone-400">↔</span>
          <MockCard>
            <span className="text-2xl">👨</span>
            <span className="text-[10px] font-semibold">Karan</span>
          </MockCard>
        </div>
        <span className="mt-2 rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
          first cousin
        </span>
      </div>
    ),
  },
  {
    emoji: "👨‍👩‍👧‍👦",
    title: "Invite your family",
    body: "Each family member can sign up and grow your tree from their side. In-laws connect automatically.",
    visual: (
      <div className="flex items-center gap-1 text-3xl">
        <span>👨</span>
        <span>👩</span>
        <span>👴</span>
        <span>👵</span>
        <span>👦</span>
        <span>👧</span>
      </div>
    ),
  },
];

function MockCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm">
      {children}
    </div>
  );
}

export function HowItWorks() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 4 seconds
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % STEPS.length);
    }, 4000);
    return () => clearTimeout(t);
  }, [index, paused]);

  const step = STEPS[index];

  return (
    <div
      className="rounded-xl border border-stone-200 bg-gradient-to-br from-emerald-50 to-stone-50 p-6 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          How it works
        </h3>
        <span className="text-xs text-stone-500">
          {index + 1} / {STEPS.length}
        </span>
      </div>

      {/* Visual */}
      <div
        key={index}
        className="mb-4 flex min-h-[140px] animate-fade items-center justify-center"
      >
        {step.visual}
      </div>

      {/* Caption */}
      <div key={`text-${index}`} className="animate-fade text-center">
        <p className="mb-1 text-base font-semibold text-stone-900">
          <span className="mr-1.5" aria-hidden>
            {step.emoji}
          </span>
          {step.title}
        </p>
        <p className="text-sm text-stone-600">{step.body}</p>
      </div>

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Step ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-6 bg-emerald-700" : "w-1.5 bg-stone-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
