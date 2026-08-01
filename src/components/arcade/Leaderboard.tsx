import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { getLeaderboard, submitScore, type LeaderboardRow } from "@/lib/leaderboard";
import { checkCallsign } from "@/lib/profanity";
import type { GameId } from "@/lib/scores";
import { cn } from "@/lib/utils";

const NAME_KEY = "merkvex-arcade-player-name";

export function usePlayerName() {
  const [name, setName] = useState("Pilot");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) {
        const check = checkCallsign(saved);
        setName(check.ok ? check.name : "Pilot");
      }
    } catch {
      /* ignore */
    }
  }, []);
  const save = (n: string) => {
    const check = checkCallsign(n);
    if (!check.ok) return { ok: false as const, reason: check.reason };
    setName(check.name);
    try {
      localStorage.setItem(NAME_KEY, check.name);
    } catch {
      /* ignore */
    }
    return { ok: true as const, name: check.name };
  };
  return { name, save };
}

export function LeaderboardPanel({
  gameId,
  title = "Global top 100",
  refreshKey = 0,
  compact = false,
  limit,
  className,
}: {
  gameId: GameId;
  title?: string;
  refreshKey?: number;
  compact?: boolean;
  /** Default 100; compact defaults to 10 unless set. */
  limit?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchLimit = limit ?? (compact ? 10 : 100);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboard({ data: { gameId, limit: fetchLimit } })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, refreshKey, fetchLimit]);

  return (
    <div
      className={cn(
        "panel-arcade relative flex flex-col overflow-hidden rounded-xl",
        compact ? "p-3" : "p-3 sm:p-4",
        className,
      )}
    >
      {/* neon edge glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{
          background:
            "linear-gradient(90deg, transparent, #ff2bd6, #3ecbff, #f5e642, transparent)",
        }}
      />
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-electric" />
          <h3 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-muted">
            {title}
          </h3>
        </div>
        <span className="font-display text-[10px] tabular-nums text-cyan/80">
          {loading ? "…" : `${rows.length}`}
        </span>
      </div>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No scores yet - be first.</p>
      ) : (
        <ol
          className={cn(
            "min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1",
            compact ? "max-h-[220px]" : "max-h-none",
            "[scrollbar-width:thin] [scrollbar-color:rgba(62,203,255,0.45)_rgba(18,8,36,0.8)]",
          )}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1",
                r.rank <= 3 && "border-border/40 bg-void-deep/50",
              )}
            >
              <span
                className={cn(
                  "w-7 shrink-0 font-display text-xs font-bold tabular-nums",
                  r.rank === 1
                    ? "text-electric"
                    : r.rank === 2
                      ? "text-cyan"
                      : r.rank === 3
                        ? "text-[#c084fc]"
                        : "text-muted/70",
                )}
              >
                {r.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                {r.playerName}
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-cyan">
                {r.score.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ScoreSubmitForm({
  gameId,
  score,
  onSubmitted,
}: {
  gameId: GameId;
  score: number;
  onSubmitted?: () => void;
}) {
  const { name, save } = usePlayerName();
  const [input, setInput] = useState(name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setInput(name);
  }, [name]);

  const submit = async () => {
    setErr(null);
    setMsg(null);
    const saved = save(input);
    if (!saved.ok) {
      setErr(saved.reason);
      return;
    }
    setBusy(true);
    try {
      const res = await submitScore({
        data: { gameId, playerName: saved.name, score },
      });
      setMsg(res.rank ? `Posted · rank #${res.rank}` : "Posted to board");
      onSubmitted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-border/70 bg-void-deep/60 p-3 text-left">
      <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        Post to global top 100
      </p>
      <div className="flex gap-2">
        <input
          value={input}
          maxLength={16}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Callsign"
          className="min-w-0 flex-1 rounded-lg border border-border bg-void px-3 py-2 text-sm text-fg outline-none focus:border-cyan"
        />
        <button
          type="button"
          disabled={busy || score <= 0}
          onClick={submit}
          className="rounded-lg bg-electric px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-void-deep disabled:opacity-50"
        >
          {busy ? "…" : "Post"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      {msg && <p className="mt-2 text-xs text-cyan">{msg}</p>}
    </div>
  );
}
