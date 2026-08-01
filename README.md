# Merkvex Arcade

TanStack Start + React 19 + Vite + Tailwind neon cabinet.

- **10 games:** breakout, flappy, whack, snake, jumper, hangman, invaders, tower, runner, memory  
- **Pilot picker** + agent sprites (`public/characters/clean/`)  
- **Global leaderboards** → Postgres table `arcade_scores` (or PGLite without `DATABASE_URL`)

## Routes

| Path | Screen |
|------|--------|
| `/` | Redirect → `/arcade` |
| `/arcade` | Cabinet lobby + leaderboard |
| `/arcade/play/$gameId` | Play one cabinet |

## Local

```bash
npm install
npm run dev      # http://0.0.0.0:8080/arcade
npm run build    # Vercel output under .vercel/output
npm run typecheck
```

## Vercel

1. Import this repo/folder as a Vercel project.  
2. Set env **`DATABASE_URL`** (Neon recommended).  
3. Deploy. Build already runs `scripts/migrate.mjs` (no-op if URL missing).  
4. Point main Merkvex site at this origin (see website `arcade.html` `MX_ARCADE_ORIGIN`).

## Agent unlocks (later)

`src/lib/agentLoadout.ts`:

```ts
setUnlockSource(ownedIds); // or 'all'
// or window.__MERKVEX_UNLOCKED__ = ['cyber-chick', ...]
```

Today all agents unlock; free starter pool always stays playable.

## Main site bridge

Static Netlify site (`AuroraVolt Cards/website`) keeps `/arcade.html` as a launcher that deep-links into this app when `MX_ARCADE_ORIGIN` is set (default local `http://127.0.0.1:8080`).
