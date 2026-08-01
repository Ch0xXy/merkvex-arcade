import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { PilotBay } from "@/components/arcade/PilotBay";
import { getGame } from "@/games/catalog";
import {
  ALL_CATEGORY_IDS,
  CATEGORIES,
  categoryWordCount,
  pickWord,
  wordsInCategories,
  type WordCategoryId,
  type WordEntry,
  type WordTier,
} from "@/games/wordBank";
import { getHighScore, setHighScore } from "@/lib/scores";
import { cn } from "@/lib/utils";

const meta = getGame("hangman")!;
const MAX_LIVES = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CATS_KEY = "merkvex-cipher-cats-v1";
const DEFAULT_CATS: WordCategoryId[] = ["merkvex", "cyberpunk", "arcade", "tech"];

type Round = {
  entry: WordEntry;
  guessed: Set<string>;
  wrong: number;
  solved: boolean;
  failed: boolean;
};

function lettersOf(word: string) {
  return [...new Set(word.toUpperCase().replace(/[^A-Z]/g, "").split(""))];
}

function readSavedCats(): Set<WordCategoryId> {
  try {
    const raw = localStorage.getItem(CATS_KEY);
    if (!raw) return new Set(DEFAULT_CATS);
    const arr = JSON.parse(raw) as string[];
    const valid = arr.filter((id): id is WordCategoryId =>
      ALL_CATEGORY_IDS.includes(id as WordCategoryId),
    );
    return valid.length ? new Set(valid) : new Set(DEFAULT_CATS);
  } catch {
    return new Set(DEFAULT_CATS);
  }
}

const ACCENT_ON: Record<string, string> = {
  electric: "border-electric/60 bg-electric/15 text-electric",
  cyan: "border-cyan/60 bg-cyan/15 text-cyan",
  violet: "border-[#c084fc]/60 bg-[#c084fc]/15 text-[#c084fc]",
  mint: "border-success/60 bg-success/15 text-success",
};

export function HangmanGame() {
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("hangman"));
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<WordCategoryId>>(() => new Set(DEFAULT_CATS));
  const usedRef = useRef(new Set<string>());
  const catsRef = useRef(selected);
  catsRef.current = selected;
  const statusRef = useRef(status);
  statusRef.current = status;
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const streakRef = useRef(0);

  useEffect(() => {
    setSelected(readSavedCats());
  }, []);

  const poolSize = useMemo(() => wordsInCategories(selected).length, [selected]);

  const persistCats = (next: Set<WordCategoryId>) => {
    setSelected(next);
    try {
      localStorage.setItem(CATS_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const toggleCat = (id: WordCategoryId) => {
    const next = new Set(selected);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    persistCats(next);
  };

  const selectAll = () => persistCats(new Set(ALL_CATEGORY_IDS));
  const selectDefaults = () => persistCats(new Set(DEFAULT_CATS));

  const nextRound = useCallback((nextStreak: number) => {
    const prefer: WordTier =
      nextStreak < 2 ? "easy" : nextStreak < 5 ? "mid" : Math.random() > 0.45 ? "hard" : "mid";
    const cats = catsRef.current;
    const pool = wordsInCategories(cats);
    const entry = pickWord(usedRef.current, { prefer, categories: cats });
    usedRef.current.add(entry.word);
    if (usedRef.current.size > Math.min(Math.max(3, pool.length - 2), 40)) usedRef.current.clear();
    setRound({
      entry,
      guessed: new Set(),
      wrong: 0,
      solved: false,
      failed: false,
    });
    setFlash(null);
  }, []);

  const startGame = () => {
    if (selected.size === 0 || poolSize === 0) return;
    usedRef.current = new Set();
    scoreRef.current = 0;
    livesRef.current = MAX_LIVES;
    streakRef.current = 0;
    setScore(0);
    setLives(MAX_LIVES);
    setStreak(0);
    setStatus("playing");
    nextRound(0);
  };

  const endGame = () => {
    const next = setHighScore("hangman", scoreRef.current);
    setHigh(next);
    setStatus("over");
  };

  const reveal = useMemo(() => {
    if (!round) return [];
    return round.entry.word.split("").map((ch) => {
      if (!/[A-Za-z]/.test(ch)) return { ch, show: true };
      const up = ch.toUpperCase();
      return { ch: up, show: round.guessed.has(up) || round.failed || round.solved };
    });
  }, [round]);

  const guess = useCallback(
    (letter: string) => {
      if (statusRef.current !== "playing" || !round) return;
      const L = letter.toUpperCase();
      if (!/^[A-Z]$/.test(L)) return;
      if (round.guessed.has(L) || round.solved || round.failed) return;

      const word = round.entry.word.toUpperCase();
      const nextGuessed = new Set(round.guessed);
      nextGuessed.add(L);
      const hit = word.includes(L);
      let wrong = round.wrong;
      let nextLives = livesRef.current;

      if (!hit) {
        wrong += 1;
        nextLives = Math.max(0, livesRef.current - 1);
        livesRef.current = nextLives;
        setLives(nextLives);
      }

      const needed = lettersOf(word);
      const solved = needed.every((c) => nextGuessed.has(c));
      const failed = !hit && (wrong >= MAX_LIVES || nextLives <= 0);

      setRound({
        entry: round.entry,
        guessed: nextGuessed,
        wrong,
        solved,
        failed,
      });

      if (solved) {
        const base = 40 + word.replace(/[^A-Z]/g, "").length * 8;
        const tierBonus = round.entry.tier === "hard" ? 40 : round.entry.tier === "mid" ? 20 : 10;
        const lifeBonus = nextLives * 5;
        const streakBonus = streakRef.current * 12;
        const gained = base + tierBonus + lifeBonus + streakBonus;
        scoreRef.current += gained;
        setScore(scoreRef.current);
        const ns = streakRef.current + 1;
        streakRef.current = ns;
        setStreak(ns);
        setFlash(`+${gained}  ·  word clear`);
        if (ns % 2 === 0 && nextLives < MAX_LIVES) {
          livesRef.current = nextLives + 1;
          setLives(nextLives + 1);
        }
        window.setTimeout(() => {
          if (statusRef.current === "playing") nextRound(ns);
        }, 900);
      } else if (failed) {
        setFlash(`The word was ${word}`);
        window.setTimeout(() => endGame(), 1100);
      }
    },
    [round, nextRound],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (statusRef.current === "ready" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        startGame();
        return;
      }
      if (statusRef.current !== "playing") return;
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
        e.preventDefault();
        guess(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guess]);

  const gallowsStage = round ? Math.min(MAX_LIVES, round.wrong) : 0;
  const pilotDamage = gallowsStage / MAX_LIVES;
  const catLabel =
    selected.size === ALL_CATEGORY_IDS.length
      ? "All packs"
      : [...selected]
          .map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id)
          .slice(0, 3)
          .join(" · ") + (selected.size > 3 ? ` +${selected.size - 3}` : "");

  const readyExtra = (
    <div className="mb-1 w-full max-w-md text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
          Word packs
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectDefaults}
            className="font-display text-[10px] font-semibold uppercase tracking-wider text-cyan hover:text-electric"
          >
            Core
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="font-display text-[10px] font-semibold uppercase tracking-wider text-cyan hover:text-electric"
          >
            All
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {CATEGORIES.map((cat) => {
          const on = selected.has(cat.id);
          const count = categoryWordCount(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCat(cat.id)}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-left transition",
                on
                  ? ACCENT_ON[cat.accent]
                  : "border-border/70 bg-void-deep/70 text-muted hover:border-border",
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="font-display text-xs font-bold">{cat.label}</span>
                <span className="font-display text-[10px] tabular-nums opacity-80">{count}</span>
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight opacity-80">{cat.blurb}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-display text-[11px] text-muted">
        {poolSize} words in pool · tap packs to mix
      </p>
    </div>
  );

  return (
    <GameCanvasShell
      meta={meta}
      score={score}
      highScore={high}
      status={status}
      onRestart={() => {
        setStatus("ready");
        setScore(0);
        setRound(null);
        setFlash(null);
      }}
      onStart={startGame}
      startDisabled={poolSize === 0}
      startLabel={poolSize ? "Play" : "Pick a pack"}
      readyExtra={readyExtra}
      hidePlayPilot
      pilotLocationHint="Your pilot stands on the cipher stage (left). Wrong letters glitch them offline."
      hint={`Type or tap letters · ${catLabel}`}
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#22063a] via-[#0e0520] to-[#05020e] px-3 py-2 sm:px-5 sm:py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border",
                  i < lives
                    ? "border-cyan bg-cyan shadow-[0_0_8px_rgba(62,203,255,0.55)]"
                    : "border-border bg-void-deep opacity-40",
                )}
                aria-hidden
              />
            ))}
            <span className="ml-1 font-display text-[10px] uppercase tracking-wider text-muted">
              lives
            </span>
          </div>
          <div className="text-right">
            <div className="font-display text-xs font-bold uppercase tracking-wider text-electric">
              streak {streak}
            </div>
            {status === "playing" && (
              <div className="max-w-[140px] truncate font-display text-[9px] uppercase tracking-wider text-muted sm:max-w-[200px]">
                {catLabel}
              </div>
            )}
          </div>
        </div>

        <div className="grid flex-1 gap-3 lg:grid-cols-[160px_1fr]">
          {/* Avatar stage — dedicated location for selected pilot */}
          <div className="mx-auto flex w-full max-w-[180px] flex-col items-center justify-start gap-2 rounded-2xl border border-cyan/30 bg-void-deep/60 p-3 shadow-[0_0_24px_rgba(62,203,255,0.12)]">
            <p className="font-display text-[9px] font-bold uppercase tracking-[0.2em] text-cyan">
              Cipher stage
            </p>
            <PilotBay
              size="lg"
              label=""
              damage={status === "playing" || status === "over" ? pilotDamage : 0}
              caption={
                gallowsStage === 0
                  ? "secure"
                  : gallowsStage >= MAX_LIVES
                    ? "offline"
                    : `err ${gallowsStage}/${MAX_LIVES}`
              }
            />
            <Gallows stage={gallowsStage} />
          </div>

          <div className="flex min-w-0 flex-col">
            {round && (
              <>
                <p className="mb-1 text-center font-display text-[10px] uppercase tracking-[0.22em] text-cyan">
                  hint · {round.entry.hint}
                </p>
                <p className="mb-3 text-center font-display text-[10px] uppercase tracking-wider text-muted">
                  {CATEGORIES.find((c) => c.id === round.entry.category)?.label ?? round.entry.category}
                  {" · "}
                  {round.entry.tier}
                  {" · "}
                  {round.entry.word.replace(/[^A-Za-z]/g, "").length} letters
                </p>

                <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  {reveal.map((cell, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex h-10 w-8 items-center justify-center rounded-lg border font-display text-lg font-bold sm:h-12 sm:w-10 sm:text-xl",
                        cell.show
                          ? round?.failed && !round.guessed.has(cell.ch)
                            ? "border-danger/50 bg-danger/10 text-danger"
                            : "border-electric/60 bg-electric/15 text-electric shadow-[0_0_10px_rgba(245,230,66,0.25)]"
                          : "border-border bg-surface-raised/40 text-transparent",
                      )}
                    >
                      {cell.show ? cell.ch : "·"}
                    </span>
                  ))}
                </div>

                {flash && (
                  <p className="mb-3 text-center font-display text-sm font-semibold text-cyan">
                    {flash}
                  </p>
                )}
              </>
            )}

            {!round && status === "ready" && (
              <div className="mb-4 flex flex-1 flex-col items-center justify-center text-center">
                <p className="font-display text-sm text-muted">
                  Pick packs & pilot, then hit Play.
                </p>
              </div>
            )}

            <div className="mt-auto grid grid-cols-7 gap-1.5 sm:grid-cols-9 sm:gap-2">
              {ALPHABET.map((L) => {
                const used = round?.guessed.has(L) ?? false;
                const inWord = round ? round.entry.word.toUpperCase().includes(L) : false;
                const wrong = used && !inWord;
                const right = used && inWord;
                return (
                  <button
                    key={L}
                    type="button"
                    disabled={status !== "playing" || used || !!round?.solved || !!round?.failed}
                    onClick={() => guess(L)}
                    className={cn(
                      "h-10 rounded-lg border font-display text-sm font-bold transition active:scale-95 sm:h-11",
                      right && "border-cyan/60 bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(62,203,255,0.35)]",
                      wrong && "border-danger/40 bg-danger/10 text-danger/70 line-through",
                      !used &&
                        "border-border bg-surface-raised text-fg hover:border-cyan hover:text-cyan",
                      (status !== "playing" || used) && "opacity-70",
                    )}
                  >
                    {L}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </GameCanvasShell>
  );
}

function Gallows({ stage }: { stage: number }) {
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full max-w-[140px] opacity-80" aria-hidden>
      <defs>
        <linearGradient id="gWire" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3ecbff" />
          <stop offset="100%" stopColor="#f5e642" />
        </linearGradient>
      </defs>
      <path d="M10 32 H90" stroke="#3ecbff55" strokeWidth="2.5" />
      <path d="M22 32 V8 H50" stroke="#3ecbff88" strokeWidth="2.5" fill="none" />
      <path d="M50 8 V14" stroke="url(#gWire)" strokeWidth="2" />
      {stage >= 1 && (
        <text x="56" y="18" fill="#f5e642" fontSize="9" fontFamily="monospace">
          ERR×{stage}
        </text>
      )}
    </svg>
  );
}
