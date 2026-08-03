import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Crosshair,
  Gamepad2,
  Layers,
  Joystick,
  Keyboard,
  MousePointerClick,
  Plane,
  Rocket,
  Shield,
  Trophy,
  Zap,
} from "lucide-react";
import { LeaderboardPanel } from "@/components/arcade/Leaderboard";
import { PilotBay } from "@/components/arcade/PilotBay";
import { GAMES } from "@/games/catalog";
import { getAllHighScores, type GameId } from "@/lib/scores";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/arcade/")({
  component: ArcadeHome,
});

const ICONS = {
  breakout: Joystick,
  flappy: Plane,
  whack: MousePointerClick,
  snake: Zap,
  jumper: Rocket,
  hangman: Keyboard,
  invaders: Crosshair,
  tower: Shield,
  runner: Rocket,
  memory: Layers,
} as const;

function ArcadeHome() {
  const [scores, setScores] = useState<Record<GameId, number> | null>(null);
  const [boardGame, setBoardGame] = useState<GameId>("breakout");

  useEffect(() => {
    setScores(getAllHighScores());
  }, []);

  const merkvexHideout = import.meta.env.DEV
    ? "http://127.0.0.1:8797/hideout.html"
    : "https://merkvex.com/hideout.html";
  const merkvexSite = import.meta.env.DEV
    ? "http://127.0.0.1:8797/"
    : "https://merkvex.com/";

  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a
            href={merkvexHideout}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised/80 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-[0.14em] text-cyan transition hover:border-cyan/50 hover:text-electric"
          >
            ← Back to Hideout
          </a>
          <a
            href={merkvexSite}
            className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-muted transition hover:text-fg"
          >
            Merkvex.com
          </a>
        </div>
        <header className="mb-8 text-center sm:mb-12">
          <div className="mb-4 inline-flex items-center gap-3 rounded-2xl border border-border bg-surface-raised/80 px-4 py-2 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-cyan bg-void shadow-[0_0_16px_rgba(62,203,255,0.35)]">
              <span className="font-display text-sm font-extrabold tracking-tighter text-electric">
                MV
              </span>
            </div>
            <div className="text-left">
              <p className="font-display text-[10px] uppercase tracking-[0.28em] text-cyan">
                by ChoxxyVerse
              </p>
              <p className="font-display text-lg font-extrabold tracking-wide text-electric glow-electric sm:text-xl">
                MERKVEX
              </p>
            </div>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">
            <span className="text-electric glow-electric">Arcade</span>{" "}
            <span className="text-cyan glow-cyan">Cabinet</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted sm:text-base">
            Mini games for the market. Climb the{" "}
            <span className="text-electric">global top 100</span>. Pick a character, then play.
          </p>
          <div className="mx-auto mt-5 inline-flex max-w-full items-center gap-3 rounded-2xl border border-border/70 bg-void-deep/70 px-3 py-2 sm:px-4">
            <PilotBay size="sm" label="Last pick" />
            <p className="text-left text-xs text-muted sm:text-sm">
              <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-cyan">
                Character
              </span>
              <br />
              Choose who you play as on each game&apos;s ready screen.
            </p>
          </div>
        </header>

        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-cyan" />
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-muted">
              Select cabinet
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game) => {
              const Icon = ICONS[game.icon];
              const best = scores?.[game.id] ?? 0;
              return (
                <Link
                  key={game.id}
                  to="/arcade/play/$gameId"
                  params={{ gameId: game.id }}
                  className={cn(
                    "panel-arcade group relative overflow-hidden rounded-2xl p-5 transition",
                    "hover:border-electric/60 hover:shadow-[0_0_28px_rgba(245,230,66,0.12)]",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
                  )}
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, #3ecbff, #f5e642, transparent)",
                    }}
                  />
                  <div
                    className={cn(
                      "mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl border",
                      game.accent === "electric"
                        ? "border-electric/40 bg-electric/10 text-electric"
                        : "border-cyan/40 bg-cyan/10 text-cyan",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3
                    className={cn(
                      "font-display text-xl font-bold",
                      game.accent === "electric" ? "text-electric" : "text-cyan",
                    )}
                  >
                    {game.title}
                  </h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    {game.tagline}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{game.blurb}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-display text-[10px] uppercase tracking-wider text-muted">
                      Local best
                    </span>
                    <span className="font-display text-sm font-bold tabular-nums text-electric">
                      {best.toLocaleString()}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mb-10">
          <div className="panel-arcade relative overflow-hidden rounded-2xl p-5 sm:p-6">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #ff2bd6, #3ecbff, #f5e642, transparent)",
              }}
            />
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-electric" />
              <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-muted">
                Global leaderboard
              </h2>
            </div>
            <p className="mb-3 text-sm text-muted">
              Top 100 per cabinet. Switch games to scout the competition before you play.
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setBoardGame(g.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition",
                    boardGame === g.id
                      ? "border-electric bg-electric/15 text-electric"
                      : "border-border bg-void-deep text-muted hover:border-cyan hover:text-cyan",
                  )}
                >
                  {shortTitle(g.title)}
                </button>
              ))}
            </div>
            <LeaderboardPanel
              gameId={boardGame}
              title={`${getTitle(boardGame)} · global top 100`}
              limit={100}
            />
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-muted">
          <p>
            Merkvex Arcade Cabinet · characters · global top 100 ·{" "}
            <span className="text-electric">the market for trading cards</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

function getTitle(id: GameId) {
  return GAMES.find((g) => g.id === id)?.title ?? id;
}

function shortTitle(title: string) {
  return title
    .replace("Volt ", "")
    .replace("Neon ", "")
    .replace("Vault ", "")
    .replace("Cipher ", "")
    .replace("Deck ", "")
    .replace("Rare ", "")
    .replace("Market ", "")
    .replace("Lane ", "");
}
