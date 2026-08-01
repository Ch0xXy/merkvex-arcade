# Make Merkvex Arcade live (no local terminal required after this)

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
5. **Environment variables** (optional first deploy, recommended second):
   - Name: `DATABASE_URL`
   - Value: Neon (or any Postgres) connection string  
   - Without it: app still works; global boards use temporary storage
6. Click **Deploy**
7. Copy the production URL, e.g.  
   `https://merkvex-arcade.vercel.app`  
   (exact name may differ — use what Vercel shows)

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
