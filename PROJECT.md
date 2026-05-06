# AponRoots — Project Knowledge Base

A living reference for anyone (including future-you, AI agents, or new
contributors) working on this codebase. Update it whenever a non-obvious
convention changes.

---

## 🌳 What AponRoots Is

A modern, private family-tree app for everyday families. Tagline:
*"Trace the roots, cherish the bonds."*

- Live: <https://aponroots.com>
- API: <https://api.aponroots.com>
- Repo: <https://github.com/nistopia/AponRoots>
- Tech: FastAPI + SQLite (backend) · Next.js 16 + Tailwind (web)
- Deploy: Vercel (web) · Fly.io (backend) · Cloudflare (DNS + R2 photos)
- Monetization stance: **Free for families. No paywalls. Keep doors open
  architecturally for later** — but do NOT add Stripe / upgrade UI.

---

## 🏗️ Architecture

```
Browser
   │
   ├──── HTML / JS / images ────► Vercel (apon-roots project)
   │       (Next.js app from web/)
   │
   └──── /api/* ─────────────────► Fly.io (aponroots-api, sjc region)
           (FastAPI from backend/)
                 │
                 ├── SQLite on /data persistent volume
                 └── boto3 → Cloudflare R2 (photos.aponroots.com)
```

### Repos & deploy targets

| Component | Source | Hosted | Custom domain |
|-----------|--------|--------|---------------|
| Web frontend | `web/` | Vercel project `apon-roots` | aponroots.com / www |
| API backend | `backend/` | Fly app `aponroots-api` (region `sjc`) | api.aponroots.com |
| Photos | n/a | Cloudflare R2 bucket `aponroots-photos` | photos.aponroots.com |
| Code | GitHub `nistopia/AponRoots` | (public repo for Vercel Hobby tier) | — |
| DNS | Cloudflare | — | aponroots.com (apex CNAME-flattened) |

---

## 🗄️ Data Model (`backend/app/models.py`)

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `users` | App accounts | `email` unique; `is_admin` bool; `google_sub` for OAuth-linked accounts |
| `persons` | Tree entries | `user_id` FK = owner; gender `M/F/X`; `photo_url`, `birthplace`, `current_location`, `occupation` |
| `parent_child` | Edges (max 2 parents per child) | Unique `(parent_id, child_id)`; cycles blocked at API |
| `unions` | Spouse pairs | Unordered: `partner_a_id < partner_b_id`; multiple spouses allowed |

Identity: integer `id` only. Names + DOBs are NOT unique — multiple
people can have the exact same name.

---

## 🔐 Authorization Model (`backend/app/scope.py`)

- **READ**: any authenticated user can read any person — the family
  network is intentionally non-private within AponRoots, on the
  assumption that family data sharing is the whole point.
- **WRITE**: owner, admin, or **subtree grantee** (see below).
- **`/persons?mine=true`** returns the user's *family network* — entries
  they own PLUS everyone reachable via parent/child/spouse BFS, PLUS
  every grant-writable subtree (root + descendants), all combined and
  BFS-expanded. The expansion is deliberately wide so owners see in-laws
  added by another account, and grantees see the family context around
  their granted subtree (not just an isolated branch).
- **Subtree grants** (`SubtreeGrant`): owner or admin can share write
  access on a person + all of their blood descendants. Dynamic — new
  descendants auto-included. Grantees CANNOT re-share. See
  `aponroots-relationships` skill for resolver details.
- `PersonOut` includes `owner_id` and `can_edit` (computed per request,
  with grant-writable IDs precomputed once per list endpoint to avoid
  N queries).

---

## 👨‍👩‍👧 Relationship Resolver (`backend/app/relationship.py`)

Resolution priority:
1. **Blood** via LCA (lowest common ancestor) → "1st cousin once removed", etc.
2. **In-law** via `find_in_law` (BFS through both A and B's blood
   relatives, looking for any spouse edge that connects them).
3. **Direct spouse** → just "spouse".

In-law label formatting (`_format_in_law_label`):
- Simple kinship terms (`father`, `mother`, `brother`, `sister`,
  `son`, `daughter`) → suffix **`-in-law`**.
- Compound terms containing `cousin`, `aunt`, `uncle`, `niece`, `nephew`,
  `removed`, or `great-` → use **` by marriage`** (e.g.
  "1st cousin once removed by marriage").

Co-in-law (Bangla *samdhi*) detected when neither X==A nor Y==B in the
spouse-edge match. Labels include `co-father-in-law` /
`co-mother-in-law` / `co-grandparent-in-law` / etc.

Response shape (`schemas.RelationshipResult`):
- `path`: list of person ids hop-by-hop A→B
- `path_edges`: same length minus one, each entry `parent` / `child` / `spouse`
- `via`: `"blood"`, `"your-spouse"`, `"their-spouse"`, `"co-in-law"`,
  `"spouse"`, or `"self"`
- `distance_a`/`distance_b` reflect the resolver's bookkeeping; the web
  narration counts edges from `path_edges` directly so it stays accurate
  for in-law paths.

---

## 🌳 Tree Rendering (`web/src/app/tree/page.tsx`)

Custom `react-d3-tree` setup. `buildTree` groups children by their other
parent, producing four node kinds:

| Type | When |
|------|------|
| `person` | Single individual |
| `couple` | A person + ONE spouse; all children hang below (joint or solo) |
| `marriage_branch` | Additional spouses for multi-marriage cases |

Rendering specifics:
- Nodes use `<foreignObject>` with HTML `<img>` / emoji — SVG `<text>`
  renders inconsistently on iOS Safari for emoji.
- Couples drawn symmetrically about x=0 (primary at `-PERSON_GAP/2`,
  spouse at `+PERSON_GAP/2`). Heart sits at x=0.
- Descending links route to the **blood-descendant** emoji, not the heart
  center, so it's clear who's related by blood vs marriage.
- `PERSON_GAP = 150`; nodeSize 280×150; separation 1.4 / 1.8.
- Names wrap up to 3 lines via `-webkit-line-clamp`.
- Avoid the 🧑 person emoji — renders as empty ring on iOS Safari. Use
  👨/👩/👤 instead.

---

## 📷 Photo Storage (`backend/app/storage.py`)

- Bucket: `aponroots-photos` on Cloudflare R2.
- Public CDN: `https://photos.aponroots.com`.
- Pipeline: `Pillow.ImageOps.exif_transpose` (rotate by EXIF) → strip
  metadata → downsize to 1024px max edge → JPEG quality 85 → uploaded
  with `Cache-Control: public, max-age=31536000, immutable`.
- Object key: `persons/{person_id}/{uuid}.jpg`.
- Endpoints: `POST /persons/{id}/photo` (multipart), `DELETE /persons/{id}/photo`.
- Old photo is best-effort deleted when replaced.

Required env on Fly:
```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET=aponroots-photos
R2_PUBLIC_BASE_URL=https://photos.aponroots.com
```

---

## 🔑 Authentication

- Password hashing: `passlib[bcrypt]==1.7.4` + `bcrypt==4.0.1` (newer
  bcrypt versions break passlib — pin both).
- JWT via `python-jose` (HS256, 30-day expiry).
- Google OAuth via `google-auth` (backend) + `@react-oauth/google` (web).
- Google Client ID `414598736160-l8hleblk30ig50s8mlm88c28jd36i1lf.apps.googleusercontent.com`
  is a **public identifier** — safe to commit / log.
- Default admin: `nistopia@gmail.com` (id=1). Created via
  `python -m app.migrate_to_auth`.
- Frontend stores JWT in `localStorage` under key `aponroots_token`.
- Public web routes: `/`, `/login`, `/signup`. All others redirect to
  `/login` when logged out. `/` shows the marketing landing for guests
  and the family list for logged-in users.

---

## 🎨 Styling Conventions

- **Light theme locked.** `<html style={{ colorScheme: "light" }}>` plus
  `!important` on body bg/color in `globals.css` so OS dark mode never
  bleeds through.
- Tailwind utility classes throughout. No CSS modules.
- Palette: emerald (`emerald-700`/`-800` primary), rose (`rose-500/600`
  for spouse hearts), amber (`amber-100/400` for LCA highlight).
- Person emoji: 👨/👩/👤 (avoid 🧑 — see Tree section).
- Emoji font fallback chain everywhere emoji is rendered:
  ```
  "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla", sans-serif
  ```
- Mobile-responsive header: hamburger drawer below `lg` breakpoint.
- Reusable `PersonAvatar` component renders photo if available,
  gendered emoji otherwise.

---

## 🛠️ Dev Workflow

### Backend
```bash
cd ~/repos/AponRoots/backend
source .venv/bin/activate
uvicorn app.main:app --reload   # local dev
```

Tests (must all pass before push):
```bash
cd ~/repos/AponRoots
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/ -q
```

Deploy:
```bash
cd ~/repos/AponRoots/backend
fly deploy
```

Run migration on prod (idempotent — also adds new columns):
```bash
fly ssh console -C "python -m app.migrate_to_auth nistopia@gmail.com 'PASSWORD'"
```

### Web
```bash
cd ~/repos/AponRoots/web
npm run dev    # localhost:3000
npm run build  # must pass before push
```

Vercel auto-deploys on push to `main`. No manual step needed for the web tier.

### Git
- Use `/usr/bin/git` for commits if you hit shell-wrapper hangs.
- Commit format: conventional commits (`feat:` / `fix:` / `chore:` / `docs:`)
  with multi-line body explaining what + why.
- All commits include the Co-authored-by trailer for the AI agent.
- Author email must be a **real GitHub-verified email** (Vercel rejects
  auto-generated `host@hostname.local` and blocks the deploy).

---

## 🚦 Cheat Sheet — Quick Operations

| Task | Command |
|------|---------|
| Backend logs | `fly logs -a aponroots-api` |
| Backend status | `fly status -a aponroots-api` |
| List Fly secrets | `fly secrets list -a aponroots-api` |
| Set a Fly secret | `fly secrets set KEY=value -a aponroots-api` |
| SSH into backend | `fly ssh console -a aponroots-api` |
| Pull prod DB to laptop | `fly ssh sftp get -a aponroots-api /data/aponroots.db ~/Backups/aponroots-$(date +%Y%m%d).db` |
| Volume snapshot | `fly volumes list -a aponroots-api` then `fly volumes snapshots create <vol-id>` |
| Login as admin (curl) | `curl -X POST https://api.aponroots.com/auth/login -H "Content-Type: application/json" -d '{"email":"nistopia@gmail.com","password":"..."}'` |
| Total person count | `curl -s https://api.aponroots.com/persons -H "Authorization: Bearer $TOKEN" \| python3 -c "import sys,json;print(len(json.load(sys.stdin)))"` |

---

## ⚠️ Known Gotchas / Lessons Learned

1. **bcrypt 5.x breaks passlib** — pin `bcrypt==4.0.1`.
2. **iOS Safari renders 🧑 emoji as an empty ring.** Use 👤 for "other/unset".
3. **SVG `<text>` for emoji is unreliable on iOS** — use `foreignObject` + HTML.
4. **Vercel blocks deploys with no-reply / `host.local` author emails** —
   set git user.email to a verified GitHub email globally.
5. **Vercel Deployment Protection** is on by default in the Hobby tier —
   disable it under Settings → Deployment Protection.
6. **Vercel "framework: Other"** vs Next.js auto-detect breaks deploys —
   ensure Framework Preset is "Next.js" and Root Directory is `web`.
7. **Cloudflare proxy must be DNS-only (gray cloud)** for `api.` and
   `photos.` subdomains — orange-cloud proxies break Fly/R2 SSL.
8. **`fly auth signup` requires a credit card on file** post-trial even
   for the free tier — won't actually charge until you exceed free limits.
9. **R2 bucket needs Custom Domain enabled** (not the rate-limited
   `r2.dev` URL) for production photo serving.
10. **TanStack Query's `refetchOnWindowFocus: true`** keeps multi-user
    edits in sync without manual refresh.
11. **Compound in-law labels need "by marriage"**, not "-in-law", to
    read grammatically (e.g. "first cousin once removed by marriage").
12. **Couple node link should land on blood-descendant emoji**, not the
    heart center, so lineage is visually unambiguous.

---

## 🔮 Open Doors (intentionally NOT built yet)

| Door | Why not built |
|------|---------------|
| Stripe / paid tiers | User explicitly chose "free for family, doors open" stance |
| GEDCOM import/export | Useful for portability; not yet asked for |
| Stories / memories per person | Was on the post-photo wishlist |
| Bangla UI translation | Big project, lower priority |
| React Native mobile app | Original goal, deferred until web stabilizes |
| Postgres migration | SQLite is fine until ~100 active users or multi-region need |
| Per-entry sharing (other users edit) | Future feature; current model is owner-only writes |
| Password change page | Easy add when the temp admin password gets rotated |

---

*Last updated: 2026-05-05.*
