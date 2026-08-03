import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import {
  getSelectedAgentId,
  listSelectableAgents,
  setSelectedAgentId,
} from "@/lib/agentLoadout";
import { RARITY_COLOR, type Character } from "@/lib/characters";
import { cn } from "@/lib/utils";

type Props = {
  /** compact = scrollable strip for ready overlays */
  compact?: boolean;
  className?: string;
  onChange?: (char: Character) => void;
  /** Show unlock teaser copy */
  showHint?: boolean;
};

export function AgentPicker({ compact = false, className, onChange, showHint = true }: Props) {
  const [selectedId, setSelectedId] = useState(DEFAULT_SAFE);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const roster = listSelectableAgents();

  useEffect(() => {
    setSelectedId(getSelectedAgentId());
    const onEvt = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id;
      if (id) setSelectedId(id);
    };
    window.addEventListener("merkvex-agent-change", onEvt);
    return () => window.removeEventListener("merkvex-agent-change", onEvt);
  }, []);

  const updateScrollAffordance = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  };

  useEffect(() => {
    if (!compact) return;
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollAffordance();
    el.addEventListener("scroll", updateScrollAffordance, { passive: true });
    const ro = new ResizeObserver(updateScrollAffordance);
    ro.observe(el);
    // images loading can change scrollWidth
    const t = window.setTimeout(updateScrollAffordance, 400);
    return () => {
      el.removeEventListener("scroll", updateScrollAffordance);
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [compact, roster.length]);

  const pick = (char: Character, unlocked: boolean) => {
    if (!unlocked) return;
    const next = setSelectedAgentId(char.id);
    if (next) {
      setSelectedId(next.id);
      onChange?.(next);
    }
  };

  const scrollByCards = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(240, el.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="min-w-0 text-left">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Your agent
          </p>
          {showHint && (
            <p className="mt-0.5 text-[11px] text-muted">
              Pick who you play as. Later: unlocks sync from Merkvex ownership.
            </p>
          )}
        </div>
        <p className="shrink-0 font-display text-[10px] uppercase tracking-wider text-cyan">
          {roster.find((r) => r.char.id === selectedId)?.char.name ?? "—"}
        </p>
      </div>

      {compact ? (
        <div className="relative">
          {/* left / right fade + buttons so the full roster is reachable */}
          <button
            type="button"
            aria-label="Scroll agents left"
            disabled={!canLeft}
            onClick={() => scrollByCards(-1)}
            className={cn(
              "absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-void-deep/95 text-cyan shadow-lg transition",
              canLeft ? "opacity-100 hover:border-cyan" : "pointer-events-none opacity-0",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Scroll agents right"
            disabled={!canRight}
            onClick={() => scrollByCards(1)}
            className={cn(
              "absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-void-deep/95 text-cyan shadow-lg transition",
              canRight ? "opacity-100 hover:border-cyan" : "pointer-events-none opacity-0",
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div
            ref={scrollerRef}
            className={cn(
              "flex gap-2 overflow-x-auto overscroll-x-contain px-8 pb-2 pt-0.5",
              "touch-pan-x scroll-smooth",
              // visible thin scrollbar so users know more agents exist
              "[scrollbar-width:thin] [scrollbar-color:rgba(62,203,255,0.55)_rgba(18,8,36,0.8)]",
              "[&::-webkit-scrollbar]:h-2",
              "[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-void-deep",
              "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-cyan/50",
            )}
            onWheel={(e) => {
              // convert vertical wheel to horizontal when over the strip
              const el = scrollerRef.current;
              if (!el) return;
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
              }
            }}
          >
            {roster.map(({ char, unlocked }) => (
              <AgentCard
                key={char.id}
                char={char}
                unlocked={unlocked}
                selected={char.id === selectedId}
                compact
                onPick={() => pick(char, unlocked)}
              />
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] text-muted">
            Scroll or use arrows · {roster.length} agents
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {roster.map(({ char, unlocked }) => (
            <AgentCard
              key={char.id}
              char={char}
              unlocked={unlocked}
              selected={char.id === selectedId}
              onPick={() => pick(char, unlocked)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({
  char,
  unlocked,
  selected,
  compact,
  onPick,
}: {
  char: Character;
  unlocked: boolean;
  selected: boolean;
  compact?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!unlocked}
      title={unlocked ? char.name : `${char.name} · unlock in Merkvex`}
      className={cn(
        compact ? "w-[80px] shrink-0" : "w-full",
        "group relative overflow-hidden rounded-xl border text-left transition",
        selected
          ? "border-electric bg-electric/10 shadow-[0_0_16px_rgba(245,230,66,0.2)]"
          : unlocked
            ? "border-border bg-void-deep/80 hover:border-cyan/50"
            : "cursor-not-allowed border-border/50 bg-void-deep/40 opacity-55",
      )}
    >
      <div className="aspect-square bg-[radial-gradient(circle_at_50%_35%,rgba(62,203,255,0.12),transparent_65%)]">
        <img
          src={char.idle}
          alt=""
          className={cn("h-full w-full object-contain p-1 transition", !unlocked && "grayscale")}
          draggable={false}
        />
      </div>
      <div className="px-1.5 py-1">
        <p className="truncate font-display text-[9px] font-bold text-fg sm:text-[10px]">{char.name}</p>
        <p
          className="truncate text-[8px] uppercase tracking-wider sm:text-[9px]"
          style={{ color: RARITY_COLOR[char.rarity] }}
        >
          {char.rarity}
        </p>
      </div>
      {selected && (
        <span className="absolute right-1 top-1 rounded bg-electric px-1 py-0.5 font-display text-[8px] font-bold uppercase text-void-deep">
          Active
        </span>
      )}
      {!unlocked && (
        <span className="absolute inset-0 flex items-center justify-center bg-[rgba(8,4,16,0.45)]">
          <Lock className="h-5 w-5 text-muted" />
        </span>
      )}
    </button>
  );
}

const DEFAULT_SAFE = "cyber-chick";

/** Tiny active-agent chip for headers. */
export function ActiveAgentChip({ className }: { className?: string }) {
  const [id, setId] = useState(DEFAULT_SAFE);
  useEffect(() => {
    setId(getSelectedAgentId());
    const onEvt = (e: Event) => {
      const next = (e as CustomEvent<{ id: string }>).detail?.id;
      if (next) setId(next);
    };
    window.addEventListener("merkvex-agent-change", onEvt);
    return () => window.removeEventListener("merkvex-agent-change", onEvt);
  }, []);
  const char = listSelectableAgents().find((r) => r.char.id === id)?.char;
  if (!char) return null;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised/80 px-2 py-1",
        className,
      )}
    >
      <img src={char.idle} alt="" className="h-8 w-8 object-contain" />
      <div className="min-w-0 text-left">
        <p className="truncate font-display text-[10px] font-bold text-fg">{char.name}</p>
        <p className="text-[9px] uppercase tracking-wider text-muted">character</p>
      </div>
    </div>
  );
}
