# Make Merkvex Arcade live (no local terminal required after this)

**LIVE:** https://merkvex-arcade.vercel.app/arcade  
Wired into main site `arcade.html` as `PRODUCTION_ARCADE` (2026-08-01).

The arcade is a **separate cloud app**. Your PC PowerShell is only for development. Once Vercel is connected to GitHub, every push deploys itself.

## Why not Netlify with the main site?

Main Merkvex site = static HTML, no build.  
Arcade = React + server (leaderboards, migrations). It needs a Node host. **Vercel** is already configured (`nitro` preset).

## You do this once (about 10 minutes)

### 1. Repo (already done if you see github.com/Ch0xXy/merkvex-arcade)

Code lives at: `D:\Projects\merkvex-arcade`  
GitHub: **https://github.com/Ch0xXy/merkvex-arcade**

### 2. Deploy on Vercel (click UI — no PowerShell)

1. Open **https://vercel.com/new**
2. Sign in with **GitHub** (Ch0xXy)
3. Import **`merkvex-arcade`**
4. Framework: leave default / leave blank (build uses `npm run build`)
5. **Environment variables** — Merkvex uses **Supabase** (not Neon):
   - Name: `DATABASE_URL`
   - Value: Supabase Dashboard → project **kywqyvygmvogsgcpbajj** (prod) → **Project Settings → Database → Connection string → URI**
   - Prefer **Transaction pooler** (port **6543**) for Vercel
   - Replace `[YOUR-PASSWORD]` with the DB password
   - `arcade_scores` table is already created on prod via Supabase migration
   - Without `DATABASE_URL`: app still works; global boards use temporary PGLite
6. Click **Deploy** (or Redeploy after saving the env var)
7. Production URL: **https://merkvex-arcade.vercel.app**

### 3. Point the main Merkvex site at that URL

On the live site, Hideout → Arcade must open the **Vercel** app, not `127.0.0.1`.

**Option A — tell Grok the URL**  
Reply with the Vercel URL. We hardcode it into `arcade.html` / Hideout and you deploy the static site.

**Option B — set it yourself in the browser once (quick test)**  
On auroravoltcards.com:

```js
localStorage.setItem('mx_arcade_origin', 'https://YOUR-VERCEL-URL.vercel.app')
```

Then open Hideout → Arcade.

**Option C — permanent in code**  
In `arcade.html`, production default becomes your Vercel URL (Grok can do this when you paste the URL).

### 4. Optional: custom domain

In Vercel → Project → Domains → add e.g. `arcade.auroravoltcards.com`  
Then use that as `MX_ARCADE_ORIGIN`.

## After it’s live

| Action | Who |
|--------|-----|
| Play arcade from phone / any browser | Works without your PC on |
| Change game code | Push to `merkvex-arcade` GitHub → Vercel auto-redeploys |
| Shared global top 100 | Set `DATABASE_URL` on Vercel + redeploy |

## merkvex.com/arcade cutover (Option B — Netlify proxy, Sam-ratified 2026-08-04)

Goal: the arcade lives at **https://merkvex.com/arcade** (no new domain).
The code support is already merged and **inert by default** — nothing changes
until step 1. Order matters:

1. **Vercel env flip:** Project → Settings → Environment Variables → add
   `ARCADE_BASE` = `/arcade/` (Production) → **Redeploy**.
   - What it does: every asset/page URL moves under `/arcade/` (Vite `base`),
     and the build mirrors static output so `merkvex-arcade.vercel.app/arcade`
     keeps working standalone (`scripts/subpath-assets.mjs`).
   - Verify: `https://merkvex-arcade.vercel.app/arcade` loads with working
     styles/games (view source: asset URLs start `/arcade/assets/`).
2. **Netlify rules:** in the main site's `netlify.toml`, uncomment the
   "ARCADE PROXY" block (three rules: `/arcade`, `/arcade/*`, `/_serverFn/*`)
   → `netlify deploy --prod --dir .`.
   - Verify: `https://merkvex.com/arcade` plays a game end to end and the
     leaderboard loads (that round-trips `/_serverFn/*`).
3. **Flip the doors:** point `arcade.html` cabinet links (and
   `mx_arcade_origin` default) at `/arcade` instead of the vercel.app URL.
4. Optional later: Vercel redirect vercel.app → merkvex.com/arcade once
   traffic is confirmed.

Asset-collision answer: the main site owns `/assets/`; the arcade under this
plan owns `/arcade/assets/` and `/_serverFn/` — zero overlap, no strip-prefix
rewriting, cookies first-party on merkvex.com. Auth/multiplayer template code
is unused by the arcade routes, so no OAuth broker redirect-URI changes are
needed for this cutover.

## Local dev only (optional)

```powershell
cd D:\Projects\merkvex-arcade
npm run dev
```

→ http://127.0.0.1:8080/arcade  

Not required for production.
