# Deploying AponRoots

This guide deploys:
- **Backend** (FastAPI + SQLite) → Fly.io with a 1 GB persistent volume.
- **Frontend** (Next.js) → Vercel.
- **Domain** `aponroots.com` (Cloudflare) — apex to Vercel, `api.` to Fly.

The end state: `https://aponroots.com` (web) talks to `https://api.aponroots.com`.

---

## 0. Prereqs

- A Cloudflare account holding `aponroots.com` (DNS hosted on Cloudflare).
- A GitHub account with this repo pushed.
- Install `flyctl`:
  ```bash
  brew install flyctl
  fly auth signup   # or `fly auth login`
  ```

---

## 1. Backend → Fly.io

From the repo root:

```bash
cd backend

# 1.1 Create the app and pick a region
fly launch --no-deploy --name aponroots-api --region sea --copy-config
# (the included fly.toml already covers most of this — say "no" to creating a new one)

# 1.2 Create the persistent volume (one-time)
fly volumes create aponroots_data --size 1 --region sea --yes

# 1.3 Set production secrets (one-time)
fly secrets set \
  APONROOTS_SECRET_KEY="$(openssl rand -hex 32)" \
  GOOGLE_CLIENT_ID="<your_google_client_id>"

# 1.4 Deploy
fly deploy

# 1.5 Run the auth migration on the live volume (one-time, replace pw)
fly ssh console -C "python -m app.migrate_to_auth nistopia@gmail.com 'YourStrongPassword'"

# 1.6 Custom domain
fly certs create api.aponroots.com
# Fly prints a CNAME — add it in Cloudflare:
#   Type: CNAME
#   Name: api
#   Target: aponroots-api.fly.dev   (or whatever Fly told you)
#   Proxy status: DNS only (gray cloud)  ← important; orange cloud breaks Fly TLS
fly certs check api.aponroots.com   # wait until "Issued"
```

Verify:

```bash
curl https://api.aponroots.com/
# {"app":"AponRoots","version":"0.2.0","docs":"/docs"}
```

---

## 2. Frontend → Vercel

1. Go to https://vercel.com → **Add New Project** → import `nistopia/AponRoots`.
2. **Root Directory:** `web`
3. Framework: Next.js (auto).
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://api.aponroots.com`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = your client id
5. Click **Deploy** — you'll get `aponroots.vercel.app`.
6. **Project → Settings → Domains** → add:
   - `aponroots.com` (apex)
   - `www.aponroots.com`
   Vercel will give you DNS records. Add them in Cloudflare:
   - Apex: `A` records pointing to `76.76.21.21` (or whatever Vercel shows), *Proxy: DNS only*.
   - `www`: `CNAME` to `cname.vercel-dns.com`, *Proxy: DNS only*.

---

## 3. Google OAuth — production origins

Open the OAuth client you created earlier in
[Google Cloud Console](https://console.cloud.google.com) and add:

- **Authorized JavaScript origins**
  - `https://aponroots.com`
  - `https://www.aponroots.com`
- **Authorized redirect URIs** (same)

If the OAuth consent screen is still in "Testing", you'll need to add each
new tester email manually until you click **Publish App**.

---

## 4. After-deploy smoke test

1. Open `https://aponroots.com` → redirects to `/login`.
2. Sign in with email/password (the admin you created via migrate).
3. Sign in with Google → links to your admin via shared email.
4. Add a person → confirm it persists (refresh).
5. Sign out → sign up a new test user → verify shared-read / owner-write.

---

## 5. Operational notes

- **Logs**: `fly logs` (backend), Vercel dashboard (frontend).
- **DB backups**: snapshot the volume periodically — `fly volumes list`,
  `fly volumes snapshots create <vol-id>`.
- **Migrating to Postgres** (when you outgrow SQLite): create a Fly Postgres
  cluster, point `DATABASE_URL` at it, run `Base.metadata.create_all()`.
- **Costs at this size**: ~$0/mo on the free tiers; ~$5/mo if the API needs
  to stay always-on (set `min_machines_running = 1`).
