# Merkvex Arcade — handoff (integrated 2026-08-01)

## What this is
TanStack Start + React 19 + Vite + Tailwind v4 arcade cabinet:
10 games, agent pilot select, global leaderboards (Postgres/PGLite), neon UI.

**Canonical project path:** `D:\Projects\merkvex-arcade` (copied from export).

## Routes (mounted under /arcade)
| Path | Screen |
|------|--------|
| `/` | Redirect → `/arcade` |
| `/arcade` | Lobby + pilot bay + global leaderboard |
| `/arcade/play/$gameId` | Game session |

## Run locally
```bash
cd D:\Projects\merkvex-arcade
npm install
npm run dev          # http://127.0.0.1:8080/arcade
npm run build        # must pass for Vercel (migrate no-ops without DATABASE_URL)
npm run typecheck
```

## Main Merkvex site (static Netlify)
- Hideout cabinet → `/arcade.html`
- `arcade.html` is a **bridge** into this app (`MX_ARCADE_ORIGIN` or default `http://127.0.0.1:8080`)
- Prod: deploy this folder to Vercel, set `window.MX_ARCADE_ORIGIN = 'https://…'` on the static site (or localStorage `mx_arcade_origin`)

## Database
1. Set `DATABASE_URL` (Neon/Postgres) on Vercel.
2. Build runs `scripts/migrate.mjs` → applies `migrations/0001_auth.sql` + `0002_arcade_scores.sql` once.
3. Without `DATABASE_URL`, PGLite embeds schema at runtime (preview only).

## Agent unlocks (later)
`src/lib/agentLoadout.ts` — `setUnlockSource(ids)` or `window.__MERKVEX_UNLOCKED__`.
Default: all unlocked; free starter pool always available.

## Games (GameId)
breakout, flappy, whack, snake, jumper, hangman, invaders, tower, runner, memory

## Notes
- Agent sprites: `public/characters/clean/*_idle.png`
- Leaderboard: `src/lib/leaderboard.ts` + `migrations/0002_arcade_scores.sql`
- Profanity filter: `src/lib/profanity.ts`
- Do not commit secrets; inject DB URL via env on deploy
- `vite.config.ts` gates `nitro({ preset: "vercel" })` for production builds
