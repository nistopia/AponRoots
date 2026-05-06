# AponRoots — Backlog

Living list of ideas and pending work. Loosely prioritized within each section
(top = more wanted / more ready). Status legend:

- 🔥 = blocking or actively wanted
- 🟢 = ready to build, not urgent
- 🟡 = needs design / decision before building
- 💤 = parked / nice-to-have / waiting for demand

When picking up an item: copy the section header into the commit message,
update status here in the same commit when shipped (move to **Shipped** or
delete).

---

## Operational / one-offs

| Status | Item | Notes |
|--------|------|-------|
| 🔥 | **Configure R2 bucket CORS** | Required for photos in exported tree PNGs/SVGs. Allow GET from `https://aponroots.com`, `https://www.aponroots.com`, `http://localhost:3000`. Cloudflare Dashboard → R2 → `aponroots-photos` → Settings → CORS Policy. |
| 🔥 | **Change admin password** | `nistopia@gmail.com` still on bootstrap password `Nis44haT##` — needs a Change Password page (see below) or a one-off `fly ssh` script. |

## Features

| Status | Item | Notes |
|--------|------|-------|
| 🟢 | **Change Password page** | `/account/password` with old + new + confirm; backend `PUT /me/password`. Required to retire the bootstrap admin password. |
| 🟢 | **Birthday widget** | Home page card: "🎂 Upcoming birthdays this week / month". Compute from `birth` field, ignore year. Sort by next occurrence. |
| 🟡 | **Stories / memories per person** | Long-form notes, photos, dates pinned to a person. Visibility scope: family-wide vs owner-only? Comment threads? Decide before building. |
| 🟡 | **Per-entry edit sharing** | Today: only the owner (or admin) can edit a person. Want: owner can grant edit access to specific other users for specific persons. Needs a `person_collaborators` table + UI. |
| 🟡 | **GEDCOM export** | Industry-standard `.ged` so users can import their tree into Ancestry / FamilySearch / etc. Probably easier than import. Start here. |
| 🟡 | **GEDCOM import** | Parse `.ged`, map to persons + relationships, dedupe against existing tree. Date format quirks ("ABT 1950", "BEF 1950"). Owner = importing user. |
| 💤 | **Bangla UI translation** | Two layers: (1) static UI strings via i18n; (2) computed relationship labels in Bangla — much harder, need a structural relationship → Bangla label mapper that handles paternal/maternal distinction (chacha/mama, fufu/khala, etc.). |
| 💤 | **React Native mobile app** | Reuse FastAPI backend; native UI for tree + add/edit; offline-first sync. Significant scope — only if the web app sees real adoption. |

## Tree visualization polish

| Status | Item | Notes |
|--------|------|-------|
| 🟢 | **Fit-to-screen / reset-zoom button** | Toolbar button that recenters and re-fits the tree. Test on iPhone Safari first (foreignObject + transform interactions are flaky there). |
| 🟢 | **Print-friendly page** | `@media print` stylesheet that hides nav/header and expands the tree to fill the page. Complements the SVG export. |
| 🟡 | **Hourglass view** | Show ancestors above + descendants below the rooted person in one view. Currently only descendants are shown; ancestors require clicking the up-arrow. |
| 🟡 | **Dates on nodes (optional toggle)** | Show "1952–2010" under the name when present. Toggle off by default to keep nodes compact. |
| 💤 | **Half-sibling visual distinction** | Different line style (dashed?) for half-sibling links so they're visually distinct from full siblings. |

## Auth / users

| Status | Item | Notes |
|--------|------|-------|
| 🟢 | **Forgot Password / reset email** | Link in email → token-based reset page. Needs SMTP config in Fly secrets. |
| 🟡 | **Profile editing** | Display name, avatar, account email change. |
| 🟡 | **Admin user list page** | `/admin/users` with role toggle, deactivate, see last login. Admin-only route. |

## Reliability / ops

| Status | Item | Notes |
|--------|------|-------|
| 🟢 | **Automated daily DB backup to R2** | Cron job on Fly: `sqlite3 aponroots.db .backup → R2`. Retention 30 days. |
| 🟢 | **Sentry / error monitoring** | Both backend (FastAPI) and frontend (Next.js). Free tier should cover current traffic. |
| 🟡 | **Postgres migration plan** | SQLite is fine to maybe ~1000 users / 10K persons. Document the cut-over (Fly Postgres? Neon? Supabase?) so it's not a surprise. |

## Tech debt

| Status | Item | Notes |
|--------|------|-------|
| 🟢 | **Photo upload progress indicator** | Currently the upload is silent — show a spinner / % during boto3 upload. |
| 🟢 | **Tree page: virtualize large subtrees** | For families >200 people the SVG node count is fine but render perf may sag. Premature for current scale; revisit when someone reports lag. |
| 🟡 | **Component extraction in tree/page.tsx** | `personGlyph` and the inline `renderCustomNodeElement` are getting big. Extract to `web/src/components/tree/*` once the surface stabilizes. |

## Shipped (recent)

For full history see `git log --oneline`. Recent highlights:

- ✅ High-res PNG / SVG tree export (full tree, not just viewport)
- ✅ Tree click-to-reroot + up-arrow to parents
- ✅ Couple nodes with custom descending-link routing to blood parent
- ✅ Photo uploads via Cloudflare R2 + Pillow normalization
- ✅ Co-in-law (samdhi) detection and "by marriage" labeling for compound in-laws
- ✅ Family-network BFS so in-laws appear on /home
- ✅ Google OAuth + JWT auth + admin role
- ✅ Vercel + Fly + R2 production deploy at aponroots.com

---

> **Editing this file:** add new items at the top of the relevant section so the
> latest thinking is at the top. Don't worry about formatting symmetry — readability
> beats consistency. Move shipped items to the bottom section (or just delete if
> trivial — git log is the audit trail).
