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

## Local dev only (optional)

```powershell
cd D:\Projects\merkvex-arcade
npm run dev
```

→ http://127.0.0.1:8080/arcade  

Not required for production.
