"use client";

import type { Gender } from "@/lib/api";

/** Renders a circular avatar: photo if available, otherwise gendered emoji. */
export function PersonAvatar({
  photoUrl,
  gender,
  name,
  size = 48,
}: {
  photoUrl?: string | null;
  gender?: Gender | string | null;
  name?: string;
  size?: number;
}) {
  const emoji = gender === "F" ? "👩" : gender === "M" ? "👨" : "👤";
  const fontSize = Math.round(size * 0.65);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name ?? "Profile photo"}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full border border-stone-200 object-cover shadow-sm"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm"
      style={{
        width: size,
        height: size,
        fontSize,
        lineHeight: 1,
        fontFamily:
          '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif',
      }}
      aria-label={name}
    >
      <span aria-hidden>{emoji}</span>
    </div>
  );
}
