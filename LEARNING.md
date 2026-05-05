# AponRoots — Skills Inventory & Learning Path

A breakdown of the skills used to build this project from scratch — both
as a self-assessment guide and as a roadmap for anyone who wants to
build something similar.

---

## 🎯 Core Skills (Used Every Day)

### Python — intermediate
- Functions, classes, decorators
- Virtual environments (`venv`, `pip`)
- Type hints (`Optional`, `List`, `Dict`)
- Reading exception traces

### JavaScript / TypeScript — intermediate
- Async/await, promises, fetch
- Modern ES syntax (destructuring, spread, arrow fns)
- TypeScript basics: interfaces, types, generics
- React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`)

### SQL — basics
- `SELECT`, `INSERT`, `UPDATE`, `JOIN`
- Foreign keys, indexes
- Constraints (UNIQUE, CHECK)
- Reading EXPLAIN output

### HTTP / REST APIs — comfortable
- Methods (GET, POST, PATCH, DELETE), status codes
- Headers (Authorization, Content-Type, CORS)
- JSON request/response bodies
- Path vs query params

### Git + GitHub — comfortable
- Clone, commit, push, pull, branch, merge
- Rebasing / resolving conflicts
- Reading diffs
- GitHub repo / PR / Actions basics

### CLI / Bash — comfortable
- `cd`, `ls`, `grep`, `find`, `curl`, `cat`, `tail`
- Pipes and redirection
- Setting environment variables
- Reading process output

---

## 🌟 Frameworks & Libraries (Stack-Specific)

### Backend

| Tool | What you need to know |
|------|------------------------|
| **FastAPI** | Routes, dependencies, Pydantic schemas, request bodies, async |
| **SQLAlchemy** | Declarative models, sessions, queries, migrations |
| **Pydantic** | BaseModel, validation, Field, EmailStr |
| **bcrypt + JWT** | Password hashing, token signing/verification |
| **boto3** | S3-compatible API for R2 (PutObject, DeleteObject) |
| **Pillow (PIL)** | Image open/save/resize/EXIF handling |

### Frontend

| Tool | What you need to know |
|------|------------------------|
| **Next.js (App Router)** | File-based routing, server vs client components, layouts, metadata |
| **React 19** | Components, hooks, state, refs, conditional rendering |
| **TypeScript** | Types for props, generics, narrowing, `as` casts |
| **Tailwind CSS** | Utility classes, responsive prefixes (`sm:`, `lg:`), state variants (`hover:`, `focus:`) |
| **TanStack Query** | `useQuery`, `useMutation`, query keys, invalidation, refetchOnFocus |
| **react-d3-tree** | Custom node rendering, pathFunc, separation, foreignObject |
| **@react-oauth/google** | GoogleLogin button, credential token handling |

### Cloud / Ops

| Tool | What you need to know |
|------|------------------------|
| **Vercel** | Importing Git project, env vars, custom domains, Analytics |
| **Fly.io** | `fly launch / deploy / secrets / ssh / volumes / certs` |
| **Cloudflare DNS** | Adding A / CNAME records, proxy on/off (gray vs orange cloud) |
| **Cloudflare R2** | Bucket creation, API tokens, custom domain |
| **Google Cloud Console** | OAuth client setup, consent screen, authorized origins |
| **Docker** | Reading a `Dockerfile`, understanding image layers (basic) |

---

## 🧠 Conceptual / Algorithmic Skills

### 1. Graph algorithms
- **BFS** — used for ancestors, descendants, family network discovery, in-law detection
- **LCA** (lowest common ancestor) — heart of the relationship resolver
- **Path reconstruction** — back-tracing through visited maps
- **Cycle detection** — preventing self-ancestry

### 2. Tree visualization
- Hierarchical layouts (top-down vertical)
- Node positioning, separation, link paths
- SVG basics: `<g>`, `<circle>`, `<text>`, `<foreignObject>`, transforms

### 3. Authentication & authorization
- Password hashing (one-way; never reversible)
- JWT vs session cookies
- Bearer token in `Authorization` header
- OAuth 2.0 flow (the modern Google "ID token" variant)
- Per-request auth via FastAPI dependencies

### 4. Database design
- Schema design with normalization
- One-to-many vs many-to-many
- Soft deletes vs hard deletes
- Migration strategy (idempotent column-add SQL)

### 5. Web fundamentals
- Browser cache vs CDN cache
- CORS (origins, preflight, credentials)
- Cookies vs localStorage tradeoffs
- Image MIME types, compression, EXIF

---

## 🎨 Soft / Cross-Cutting Skills

### Product / UX sense
- Picking what to build vs defer
- Empty states, error states, loading states
- Mobile-first thinking (most users are on phones)
- Knowing when to add vs hide a feature

### Reading & writing docs
- Skimming framework docs (FastAPI, Next.js, Tailwind)
- Stack Overflow / GitHub Issues fluency
- Writing clear commit messages

### Debugging mindset
- Reading stack traces start-to-finish
- `print()` / `console.log` discipline
- Bisecting changes via git
- Reading network panels in browser DevTools

### Patience with deploy mechanics
- DNS propagation timing (~30 sec)
- Vercel build cycle (~90 sec)
- Knowing when to hard-refresh vs wait

---

## 🚫 Things You Don't Need

For full transparency, none of these were required to build AponRoots:

- ❌ **Computer science degree** — none of this requires academic CS
- ❌ **DevOps expertise** — Fly + Vercel handle most of it
- ❌ **Frontend animation chops** — Tailwind + simple CSS gets you 95% there
- ❌ **Mobile dev knowledge** — web responsive is enough
- ❌ **Database admin skills** — SQLite needs zero ops; Postgres comes later
- ❌ **Machine learning** — not used anywhere in this app
- ❌ **Microservices / Kubernetes** — overkill for AponRoots
- ❌ **GraphQL** — REST is fine

---

## 📊 Skill Mix by Lines of Code

Roughly how the codebase breaks down:

| Skill | LOC % | Touches |
|-------|-------|---------|
| Python (FastAPI/SQLAlchemy/Pydantic) | ~40% | Backend logic, tests |
| TypeScript / React | ~45% | Web UI, hooks, queries |
| Tailwind CSS | ~10% | Styling everywhere |
| Markdown / Docs | ~3% | README, PROJECT.md, DEPLOY.md |
| Config (TOML, JSON, .env) | ~2% | fly.toml, package.json, vercel |

---

## 🎓 Suggested Learning Order (Rebuild from Scratch)

If someone wanted to build something like AponRoots without any prior
exposure, this is the path I'd recommend:

1. **Python basics** (1 week) — variables, functions, classes, type hints
2. **HTTP + REST** (2 days) — Postman, curl, HTTP semantics
3. **FastAPI tutorial** (3 days) — official docs cover most
4. **SQL & SQLAlchemy** (1 week) — schema design, queries, ORM
5. **JavaScript fundamentals** (1 week) — async, modern syntax
6. **TypeScript essentials** (3 days) — types, interfaces
7. **React + Hooks** (1 week) — beta docs at react.dev
8. **Next.js App Router** (3 days) — file routing, layouts
9. **Tailwind** (2 days) — utility classes, responsive
10. **Auth concepts** (3 days) — bcrypt, JWT, OAuth
11. **Graph algorithms** (3 days) — BFS, LCA, recursion
12. **Cloud deploy** (2 days) — Vercel + Fly + Cloudflare DNS

- ~6–8 weeks for someone starting at "I know basic programming."
- ~3–4 months starting from zero.

---

## 🎯 Why This Project Is a Good Learning Vehicle

- ✅ **Real CRUD** with auth (the bread and butter of web work)
- ✅ **Non-trivial algorithm** (LCA / relationship resolver) — not just CRUD
- ✅ **Real deploy** to a custom domain (mocks the production grind)
- ✅ **Real users** (your family) — feedback loop is real
- ✅ **Multi-tier** (frontend + backend + storage)
- ✅ **All free tier** — no need to spend money to learn

It's also a strong resume project — covers roughly 80% of what a junior
full-stack dev hire interview tests for.

---

*Last updated: 2026-05-05.*
