import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AgentPicker } from "@/components/arcade/AgentPicker";
import { LeaderboardPanel, ScoreSubmitForm } from "@/components/arcade/Leaderboard";
import { PilotBay } from "@/components/arcade/PilotBay";
import type { GameMeta } from "@/games/catalog";
import type { GameId } from "@/lib/scores";
import { cn } from "@/lib/utils";

type Props = {
  meta: GameMeta;
  score: number;
  highScore: number;
  status: "ready" | "playing" | "paused" | "over";
  onRestart: () => void;
  onStart: () => void;
  children: ReactNode;
  hint?: string;
  readyExtra?: ReactNode;
  startDisabled?: boolean;
  startLabel?: string;
  pilotSelect?: boolean;
  pilotLocationHint?: string;
  hidePlayPilot?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  pauseTitle?: string;
  pauseMessage?: string;
  resumeLabel?: string;
  /** End-screen copy — use for wins (memory clear) vs losses. */
  overTitle?: string;
  overEyebrow?: string;
  overStatusLabel?: string;
  overIsWin?: boolean;
};

export function GameCanvasShell({
  meta,
  score,
  highScore,
  status,
  onRestart,
  onStart,
  children,
  hint,
  readyExtra,
  startDisabled,
  startLabel = "Start",
  pilotSelect = true,
  pilotLocationHint,
  hidePlayPilot = false,
  onPause,
  onResume,
  pauseTitle = "Paused",
  pauseMessage = "Take a breath. Resume when you're ready.",
  resumeLabel = "Resume",
  overTitle = "Game Over",
  overEyebrow = "Session ended",
  overStatusLabel,
  overIsWin = false,
}: Props) {
  const [boardKey, setBoardKey] = useState(0);

  return (
    /* Fixed viewport shell — no page scroll; game panel flex-fills remaining height */
    <div className="cabinet-frame flex h-dvh max-h-dvh flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-5xl shrink-0 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <Link
          to="/arcade"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-cyan transition hover:border-cyan hover:text-electric sm:h-11 sm:w-11"
          aria-label="Back to arcade"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[10px] uppercase tracking-[0.2em] text-muted sm:text-xs">
            Arcade Cabinet
          </p>
          <h1
            className={cn(
              "truncate font-display text-base font-bold sm:text-lg",
              meta.accent === "electric" ? "text-electric glow-electric" : "text-cyan glow-cyan",
            )}
          >
            {meta.title}
          </h1>
        </div>
        {onPause && status === "playing" && (
          <button
            type="button"
            onClick={onPause}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-2.5 text-sm font-semibold text-cyan transition hover:border-cyan hover:text-electric sm:h-11 sm:px-3"
            aria-label="Pause"
          >
            <Pause className="h-4 w-4" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}
        {onResume && status === "paused" && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-electric/50 bg-electric/15 px-2.5 text-sm font-semibold text-electric transition hover:border-electric sm:h-11 sm:px-3"
            aria-label="Resume"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Resume</span>
          </button>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface-raised px-2.5 text-sm font-semibold text-fg transition hover:border-electric hover:text-electric sm:h-11 sm:px-3"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Restart</span>
        </button>
      </header>

      <div className="mx-auto grid w-full max-w-5xl shrink-0 gap-1.5 px-3 sm:gap-2 sm:px-4">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <Stat label="Score" value={score} accent="cyan" />
          <Stat label="Best" value={highScore} accent="electric" />
          <Stat
            label="Status"
            value={
              status === "playing"
                ? "LIVE"
                : status === "paused"
                  ? "PAUSE"
                  : status === "over"
                    ? overStatusLabel ?? (overIsWin ? "CLEAR" : "OVER")
                    : "READY"
            }
            accent={
              status === "over"
                ? overIsWin
                  ? "electric"
                  : "danger"
                : status === "paused"
                  ? "electric"
                  : "muted"
            }
          />
        </div>

        <div className="panel-arcade relative flex items-center gap-2 overflow-hidden rounded-xl px-2.5 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
            style={{
              background: "linear-gradient(90deg, transparent, #3ecbff, #f5e642, transparent)",
            }}
          />
          <PilotBay size="sm" label="Character" />
          <div className="min-w-0 flex-1 text-left">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">
              Character
            </p>
            <p className="truncate text-xs text-muted">
              {pilotLocationHint ?? "Shows on the field while you play."}
            </p>
          </div>
          {status === "playing" && !hidePlayPilot && (
            <span className="hidden shrink-0 rounded-full border border-electric/40 bg-electric/10 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-electric sm:inline">
              Live
            </span>
          )}
        </div>
      </div>

      {/* flex-1 + min-h-0 is what kills page scroll: canvas owns leftover height */}
      <div className="mx-auto mt-2 grid w-full max-w-5xl min-h-0 flex-1 gap-2 px-3 pb-2 sm:mt-2.5 sm:gap-3 sm:px-4 sm:pb-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="panel-arcade relative min-h-0 flex-1 overflow-hidden rounded-2xl">
            <div className="absolute inset-0 z-0">{children}</div>

            {status === "playing" && !hidePlayPilot && (
              <div className="pointer-events-none absolute left-2 top-2 z-10 sm:hidden">
                <div className="rounded-xl border border-border/70 bg-[rgba(8,4,16,0.72)] px-1.5 py-1 backdrop-blur-sm">
                  <PilotBay size="sm" label="Character" />
                </div>
              </div>
            )}

            {status === "ready" && (
              <Overlay>
                <p className="mb-0.5 font-display text-[10px] uppercase tracking-[0.25em] text-cyan sm:text-xs">
                  Ready?
                </p>
                <h2 className="mb-1 font-display text-xl font-bold text-electric glow-electric sm:mb-1.5 sm:text-2xl">
                  {meta.title}
                </h2>
                <p className="mb-2 max-w-sm text-xs text-muted sm:mb-2.5 sm:text-sm line-clamp-2">
                  {meta.blurb}
                </p>

                {pilotSelect && (
                  <div className="mb-2 w-full max-w-md rounded-xl border border-border/70 bg-void-deep/60 p-2 text-left sm:mb-2.5 sm:p-3">
                    <div className="mb-2 flex items-center gap-3">
                      <PilotBay size="sm" label="You" caption="selected" />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">
                          Pick a character
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {pilotLocationHint ?? "Optional — just for fun."}
                        </p>
                      </div>
                    </div>
                    <AgentPicker compact showHint={false} />
                  </div>
                )}

                {readyExtra ? (
                  <div className="mb-1 w-full max-w-md shrink-0">{readyExtra}</div>
                ) : null}

                <button
                  type="button"
                  onClick={onStart}
                  disabled={startDisabled}
                  className="mt-1 rounded-xl bg-electric px-7 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-void-deep shadow-[0_0_24px_rgba(245,230,66,0.35)] transition hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {startLabel}
                </button>
                <p className="mt-2 text-[11px] text-muted sm:text-xs">{meta.controls}</p>
              </Overlay>
            )}

            {status === "paused" && (
              <Overlay>
                <p className="mb-1 font-display text-xs uppercase tracking-[0.25em] text-cyan">
                  Hold
                </p>
                <h2 className="mb-2 font-display text-2xl font-bold text-electric glow-electric">
                  {pauseTitle}
                </h2>
                <p className="mb-4 max-w-sm text-sm text-muted">{pauseMessage}</p>
                {onResume && (
                  <button
                    type="button"
                    onClick={onResume}
                    className="inline-flex items-center gap-2 rounded-xl bg-electric px-8 py-3 font-display text-sm font-bold uppercase tracking-wider text-void-deep shadow-[0_0_24px_rgba(245,230,66,0.35)] transition hover:scale-[1.03]"
                  >
                    <Play className="h-4 w-4" />
                    {resumeLabel}
                  </button>
                )}
                <p className="mt-3 text-xs text-muted">Esc / P also toggles pause</p>
              </Overlay>
            )}

            {status === "over" && (
              <Overlay>
                <p
                  className={
                    overIsWin
                      ? "mb-0.5 font-display text-[10px] uppercase tracking-[0.25em] text-electric sm:text-xs"
                      : "mb-0.5 font-display text-[10px] uppercase tracking-[0.25em] text-danger sm:text-xs"
                  }
                >
                  {overEyebrow}
                </p>
                <h2 className="mb-1.5 font-display text-xl font-bold text-fg sm:text-2xl">
                  {overTitle}
                </h2>
                <div className="mb-1.5">
                  <PilotBay size="sm" label="This run" />
                </div>
                <p className="mb-0.5 font-display text-3xl font-bold text-electric glow-electric sm:text-4xl">
                  {score}
                </p>
                <p className="mb-2 text-xs text-muted sm:text-sm">Local best {highScore}</p>
                <ScoreSubmitForm
                  gameId={meta.id as GameId}
                  score={score}
                  onSubmitted={() => setBoardKey((k) => k + 1)}
                />
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onStart}
                    className="rounded-xl bg-electric px-6 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-void-deep shadow-[0_0_24px_rgba(245,230,66,0.35)] transition hover:scale-[1.03]"
                  >
                    Play again
                  </button>
                  <Link
                    to="/arcade"
                    className="rounded-xl border border-border bg-surface-raised px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-cyan transition hover:border-cyan"
                  >
                    Arcade
                  </Link>
                </div>
              </Overlay>
            )}
          </div>
          {hint && status === "playing" && (
            <p className="mt-1 shrink-0 truncate text-center text-[11px] text-muted sm:text-xs">
              {hint}
            </p>
          )}
        </div>

        {/* Desktop only — avoids stacking under canvas and forcing page scroll on mobile */}
        <aside className="hidden min-h-0 min-w-0 flex-col gap-2 overflow-hidden lg:flex">
          <div className="panel-arcade relative flex shrink-0 flex-col items-center overflow-hidden rounded-xl p-2.5">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
              style={{
                background: "linear-gradient(90deg, transparent, #ff2bd6, #3ecbff, transparent)",
              }}
            />
            <p className="mb-1.5 text-center font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Character
            </p>
            <PilotBay size="md" label="" caption="playing" className="mx-auto" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <LeaderboardPanel
              gameId={meta.id as GameId}
              title="High scores"
              limit={100}
              refreshKey={boardKey + (status === "over" ? 1 : 0)}
              className="h-full max-h-full"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: "cyan" | "electric" | "muted" | "danger";
}) {
  const color =
    accent === "cyan"
      ? "text-cyan"
      : accent === "electric"
        ? "text-electric"
        : accent === "danger"
          ? "text-danger"
          : "text-muted";
  return (
    <div className="panel-arcade relative overflow-hidden rounded-xl px-2 py-1.5 text-center sm:px-3 sm:py-2">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background: "linear-gradient(90deg, transparent, #3ecbff88, transparent)",
        }}
      />
      <p className="font-display text-[9px] uppercase tracking-[0.2em] text-muted sm:text-[10px]">
        {label}
      </p>
      <p className={cn("font-display text-base font-bold tabular-nums sm:text-lg", color)}>{value}</p>
    </div>
  );
}

/** Overlay stays inside the game panel only — never grows the page. */
function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-[rgba(8,4,16,0.92)] px-3 text-center backdrop-blur-[3px] sm:px-5">
      <div className="flex max-h-full w-full max-w-lg flex-col items-center justify-center py-2">
        {children}
      </div>
    </div>
  );
}
