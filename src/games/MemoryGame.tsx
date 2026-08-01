import { useMemo, useRef, useState } from "react";
import { GameCanvasShell } from "@/components/arcade/GameCanvasShell";
import { getGame } from "@/games/catalog";
import { getSelectedAgent } from "@/lib/agentLoadout";
import { CHARACTERS, RARITY_COLOR, type Character, type Rarity } from "@/lib/characters";
import { getHighScore, setHighScore } from "@/lib/scores";
import { cn } from "@/lib/utils";

const meta = getGame("memory")!;

type BoardSize = 6 | 10 | 12;

type Card = {
  key: string;
  char: Character;
  flipped: boolean;
  matched: boolean;
};

/** Fixed grids that fit the cabinet panel in one view (no scroll). */
const SIZE_META: Record<
  BoardSize,
  {
    label: string;
    blurb: string;
    /** Tailwind grid classes — explicit rows so cards fill height. */
    grid: string;
    cols: number;
    rows: number;
    clearBonus: number;
  }
> = {
  6: {
    label: "Compact",
    blurb: "12 cards · clear all",
    grid: "grid-cols-4 grid-rows-3",
    cols: 4,
    rows: 3,
    clearBonus: 200,
  },
  10: {
    label: "Standard",
    blurb: "20 cards · clear all",
    grid: "grid-cols-5 grid-rows-4",
    cols: 5,
    rows: 4,
    clearBonus: 450,
  },
  12: {
    label: "Deep vault",
    blurb: "24 cards · clear all",
    grid: "grid-cols-6 grid-rows-4",
    cols: 6,
    rows: 4,
    clearBonus: 700,
  },
};

const RARITY_BONUS: Record<Rarity, number> = {
  common: 25,
  uncommon: 45,
  rare: 80,
  legendary: 130,
  mythic: 200,
  void: 280,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a;
}

function pickAgents(n: number): Character[] {
  const pool = shuffle(CHARACTERS);
  if (n >= CHARACTERS.length) return pool.slice(0, n);
  const picks = pool.slice(0, n);
  if (n >= 10 && !picks.some((c) => ["rare", "legendary", "mythic", "void"].includes(c.rarity))) {
    const rare = CHARACTERS.find((c) => c.rarity === "rare" || c.rarity === "legendary");
    if (rare) picks[picks.length - 1] = rare;
  }
  return picks;
}

function buildDeck(size: BoardSize): Card[] {
  const agents = pickAgents(size);
  const deck: Card[] = [];
  agents.forEach((char, i) => {
    deck.push({ key: `${char.id}-a-${i}`, char, flipped: false, matched: false });
    deck.push({ key: `${char.id}-b-${i}`, char, flipped: false, matched: false });
  });
  return shuffle(deck);
}

export function MemoryGame() {
  const [status, setStatus] = useState<"ready" | "playing" | "over">("ready");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(() => getHighScore("memory"));
  const [boardSize, setBoardSize] = useState<BoardSize>(10);
  const [cards, setCards] = useState<Card[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lock, setLock] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const openRef = useRef<number[]>([]);
  const scoreRef = useRef(0);
  const matchesRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const sizeRef = useRef(boardSize);
  sizeRef.current = boardSize;
  const movesRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const start = (size = boardSize) => {
    const deck = buildDeck(size);
    setBoardSize(size);
    sizeRef.current = size;
    setCards(deck);
    setMoves(0);
    movesRef.current = 0;
    setMatches(0);
    matchesRef.current = 0;
    setCombo(0);
    comboRef.current = 0;
    setBestCombo(0);
    bestComboRef.current = 0;
    setScore(0);
    scoreRef.current = 0;
    setFlash(null);
    openRef.current = [];
    setLock(false);
    setStatus("playing");
  };

  const endGame = (finalScore: number) => {
    const next = setHighScore("memory", finalScore);
    setHigh(next);
    setStatus("over");
  };

  const flip = (index: number) => {
    if (statusRef.current !== "playing" || lock) return;
    const card = cards[index];
    if (!card || card.flipped || card.matched) return;
    if (openRef.current.includes(index)) return;

    const nextOpen = [...openRef.current, index];
    setCards((prev) => prev.map((c, i) => (i === index ? { ...c, flipped: true } : c)));
    openRef.current = nextOpen;

    if (nextOpen.length < 2) return;

    setLock(true);
    movesRef.current += 1;
    setMoves(movesRef.current);
    const [i0, i1] = nextOpen;

    window.setTimeout(() => {
      setCards((prev) => {
        const c0 = prev[i0!]!;
        const c1 = prev[i1!]!;
        const match = c0.char.id === c1.char.id;

        if (match) {
          comboRef.current += 1;
          setCombo(comboRef.current);
          if (comboRef.current > bestComboRef.current) {
            bestComboRef.current = comboRef.current;
            setBestCombo(bestComboRef.current);
          }

          const rarityPts = RARITY_BONUS[c0.char.rarity];
          const sizePts = sizeRef.current === 12 ? 35 : sizeRef.current === 10 ? 20 : 10;
          // Combo multiplies score for chaining matches without a miss
          const mult = 1 + (comboRef.current - 1) * 0.35;
          const gain = Math.round((rarityPts + sizePts) * mult);
          scoreRef.current += gain;
          setScore(scoreRef.current);
          matchesRef.current += 1;
          setMatches(matchesRef.current);

          const comboTag =
            comboRef.current > 1 ? ` · x${comboRef.current.toFixed(2).replace(/\.00$/, "")} combo` : "";
          setFlash(`+${gain}${comboTag} · ${c0.char.name}`);

          const cleared = matchesRef.current >= sizeRef.current;
          if (cleared) {
            const perfect = sizeRef.current;
            const movesUsed = Math.max(1, movesRef.current);
            // Accuracy: perfect board = full clear bonus; more misses = less
            const accuracy = Math.min(1, perfect / movesUsed);
            const clearPts = Math.round(SIZE_META[sizeRef.current].clearBonus * accuracy);
            const comboBonus = bestComboRef.current * 25;
            const total = Math.max(50, scoreRef.current + clearPts + comboBonus);
            scoreRef.current = total;
            setScore(total);
            setFlash(
              `Clear · accuracy ${Math.round(accuracy * 100)}% · combo best ${bestComboRef.current} · ${total}`,
            );
            window.setTimeout(() => endGame(total), 850);
          }

          return prev.map((c, i) =>
            i === i0 || i === i1 ? { ...c, matched: true, flipped: true } : c,
          );
        }

        // miss — break combo
        comboRef.current = 0;
        setCombo(0);
        setFlash("Miss · combo reset");
        return prev.map((c, i) => (i === i0 || i === i1 ? { ...c, flipped: false } : c));
      });
      openRef.current = [];
      setLock(false);
    }, 480);
  };

  const readyExtra = (
    <div className="mb-2 w-full max-w-md text-left">
      <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
        Board · clear every card
      </p>
      <div className="grid grid-cols-3 gap-2">
        {([6, 10, 12] as BoardSize[]).map((n) => {
          const on = boardSize === n;
          const m = SIZE_META[n];
          return (
            <button
              key={n}
              type="button"
              onClick={() => setBoardSize(n)}
              className={cn(
                "rounded-xl border px-2 py-2.5 text-center transition",
                on
                  ? "border-cyan/60 bg-cyan/15 text-cyan"
                  : "border-border/70 bg-void-deep/70 text-muted hover:border-border",
              )}
            >
              <span className="block font-display text-sm font-bold">{m.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">{m.blurb}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-display text-[11px] text-muted">
        Always clear the full board · rarity + combos · no clock
      </p>
    </div>
  );

  const pilot = useMemo(() => getSelectedAgent(), [status]);
  const grid = SIZE_META[boardSize].grid;

  return (
    <GameCanvasShell
      meta={meta}
      score={score}
      highScore={high}
      status={status}
      onRestart={() => {
        setStatus("ready");
        setScore(0);
        setCards([]);
        setFlash(null);
        setCombo(0);
      }}
      onStart={() => start(boardSize)}
      readyExtra={readyExtra}
      hidePlayPilot
      overIsWin
      overTitle="Vault Clear"
      overEyebrow="Board complete"
      overStatusLabel="CLEAR"
      pilotLocationHint="Your pilot is the dealer mascot. Cards are random vault agents."
      hint={
        status === "playing"
          ? `Clear board ${matches * 2}/${boardSize * 2} · ${moves} flips · combo x${combo}`
          : "Clear every card · rarity + combos · accuracy bonus on full clear"
      }
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-[#22063a] via-[#0e0520] to-[#05020e]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2 py-1.5 sm:px-3">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={pilot.idle}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg border border-cyan/40 bg-void-deep object-contain"
            />
            <div className="min-w-0">
              <p className="font-display text-[9px] uppercase tracking-wider text-cyan">Dealer</p>
              <p className="truncate font-display text-xs font-bold text-fg">{pilot.name}</p>
            </div>
          </div>
          {status === "playing" && (
            <div className="flex shrink-0 gap-2.5 text-right font-display text-[10px] sm:gap-3 sm:text-[11px]">
              <div>
                <p className="text-muted">Cleared</p>
                <p className="font-bold text-electric">
                  {matches * 2}/{boardSize * 2}
                </p>
              </div>
              <div>
                <p className="text-muted">Moves</p>
                <p className="font-bold text-cyan">{moves}</p>
              </div>
              <div>
                <p className="text-muted">Combo</p>
                <p className="font-bold text-fg">x{combo}</p>
              </div>
            </div>
          )}
        </div>

        {flash && (
          <p className="shrink-0 truncate px-2 py-0.5 text-center font-display text-[11px] font-semibold text-electric sm:text-xs">
            {flash}
          </p>
        )}

        <div className="min-h-0 flex-1 p-1.5 sm:p-2">
          {status === "ready" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="font-display text-sm text-muted">
                Flip cards and clear the whole board. Combos and rarity build score — no timer.
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {(Object.keys(RARITY_BONUS) as Rarity[]).map((r) => (
                  <span
                    key={r}
                    className="rounded-full border px-2 py-0.5 font-display text-[10px] uppercase"
                    style={{
                      borderColor: `${RARITY_COLOR[r]}88`,
                      color: RARITY_COLOR[r],
                    }}
                  >
                    {r} +{RARITY_BONUS[r]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(status === "playing" || status === "over") && cards.length > 0 && (
            <div className={cn("mx-auto grid h-full w-full max-w-3xl gap-1.5 sm:gap-2", grid)}>
              {cards.map((card, i) => {
                const show = card.flipped || card.matched;
                const neon = RARITY_COLOR[card.char.rarity];
                return (
                  <button
                    key={card.key}
                    type="button"
                    disabled={status !== "playing" || card.matched || lock}
                    onClick={() => flip(i)}
                    className={cn(
                      "relative min-h-0 min-w-0 overflow-hidden rounded-lg border transition active:scale-[0.97] sm:rounded-xl",
                      show
                        ? "border-transparent bg-void-deep/90"
                        : "border-cyan/30 bg-gradient-to-br from-[#2d1654] to-[#12081f] hover:border-electric/50",
                      card.matched && "opacity-90",
                    )}
                    style={
                      show
                        ? {
                            boxShadow: `0 0 12px ${neon}40`,
                            borderColor: `${neon}99`,
                          }
                        : undefined
                    }
                  >
                    {show ? (
                      <div className="flex h-full flex-col items-center justify-center p-0.5 sm:p-1">
                        <img
                          src={card.char.idle}
                          alt={card.char.name}
                          draggable={false}
                          className="min-h-0 w-full flex-1 object-contain"
                        />
                        <p className="line-clamp-1 w-full font-display text-[8px] font-bold text-fg sm:text-[9px]">
                          {card.char.name.split(" ")[0]}
                        </p>
                        <p
                          className="hidden font-display text-[7px] uppercase tracking-wider sm:block"
                          style={{ color: neon }}
                        >
                          {card.char.rarity}
                        </p>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center">
                        <span className="font-display text-base font-extrabold text-electric/80 sm:text-lg">
                          MV
                        </span>
                        <span className="mt-0.5 font-display text-[7px] uppercase tracking-[0.18em] text-cyan/55 sm:text-[8px]">
                          Merkvex
                        </span>
                      </div>
                    )}
                    {card.matched && (
                      <span className="absolute right-0.5 top-0.5 rounded bg-success/20 px-0.5 font-display text-[7px] font-bold text-success">
                        OK
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </GameCanvasShell>
  );
}
