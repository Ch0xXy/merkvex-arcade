import { useEffect, useState } from "react";
import { getSelectedAgent, getSelectedAgentId } from "@/lib/agentLoadout";
import { RARITY_COLOR, type Character } from "@/lib/characters";
import { cn } from "@/lib/utils";

type Props = {
  /** sm = HUD chip · md = ready card · lg = in-game stage */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Optional override (defaults to loadout selection) */
  agent?: Character | null;
  label?: string;
  /** 0–1 glitch damage for hangman-style stages */
  damage?: number;
  /** Subtitle under the name */
  caption?: string;
};

/**
 * Consistent "avatar location" — neon pad + portrait for the selected pilot.
 * Same visual language on ready screens, HUDs, and game stages.
 */
export function PilotBay({
  size = "md",
  className,
  agent,
  label = "Pilot bay",
  damage = 0,
  caption,
}: Props) {
  const [char, setChar] = useState<Character>(() => agent ?? getSelectedAgent());

  useEffect(() => {
    if (agent) {
      setChar(agent);
      return;
    }
    setChar(getSelectedAgent());
    const onEvt = () => setChar(getSelectedAgent());
    window.addEventListener("merkvex-agent-change", onEvt);
    return () => window.removeEventListener("merkvex-agent-change", onEvt);
  }, [agent, agent?.id]);

  // re-read when id might change without agent prop
  useEffect(() => {
    if (agent) return;
    const id = getSelectedAgentId();
    if (id !== char.id) setChar(getSelectedAgent());
  }, [agent, char.id]);

  const neon = RARITY_COLOR[char.rarity] ?? "#3ecbff";
  const dmg = Math.max(0, Math.min(1, damage));

  const dims =
    size === "sm"
      ? { box: "h-11 w-11", img: "p-0.5", pad: "p-1", name: false as const }
      : size === "lg"
        ? { box: "aspect-square w-full max-w-[160px]", img: "p-2", pad: "p-3", name: true as const }
        : { box: "h-28 w-28 sm:h-32 sm:w-32", img: "p-1.5", pad: "p-2", name: true as const };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center",
        size === "sm" ? "flex-row gap-2" : "gap-2",
        className,
      )}
    >
      {size !== "sm" && label ? (
        <p className="font-display text-[9px] font-bold uppercase tracking-[0.22em] text-muted">
          {label}
        </p>
      ) : null}

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-void-deep/80",
          dims.box,
          dims.pad,
        )}
        style={{
          borderColor: `${neon}99`,
          boxShadow: `0 0 ${18 + dmg * 12}px ${neon}44, inset 0 0 24px rgba(8,4,16,0.65)`,
        }}
      >
        {/* pad floor */}
        <div
          className="pointer-events-none absolute inset-x-2 bottom-1 h-3 rounded-[100%] opacity-70"
          style={{
            background: `radial-gradient(ellipse at center, ${neon}66 0%, transparent 70%)`,
          }}
        />
        {/* hex ring */}
        <div
          className="pointer-events-none absolute inset-2 rounded-xl border opacity-40"
          style={{ borderColor: neon }}
        />

        <img
          src={char.idle}
          alt={char.name}
          draggable={false}
          className={cn(
            "relative z-[1] h-full w-full object-contain transition duration-300",
            dims.img,
          )}
          style={{
            filter: [
              dmg > 0.15 ? `saturate(${1 - dmg * 0.85})` : null,
              dmg > 0.35 ? `contrast(${1 + dmg * 0.3})` : null,
              dmg > 0.5 ? `hue-rotate(${dmg * 40}deg)` : null,
              dmg > 0.7 ? "blur(0.4px)" : null,
            ]
              .filter(Boolean)
              .join(" "),
            opacity: 1 - dmg * 0.35,
            transform: dmg > 0.4 ? `translateX(${Math.sin(dmg * 12) * 2}px)` : undefined,
          }}
        />

        {/* damage scanlines */}
        {dmg > 0.25 && (
          <div
            className="pointer-events-none absolute inset-0 z-[2] opacity-40 mix-blend-screen"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,43,214,0.12) 3px, rgba(255,43,214,0.12) 4px)",
            }}
          />
        )}
        {dmg >= 0.99 && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center bg-[rgba(8,4,16,0.55)]">
            <span className="font-display text-[10px] font-bold uppercase tracking-wider text-danger">
              Offline
            </span>
          </div>
        )}
      </div>

      {dims.name && (
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-xs font-bold text-fg sm:text-sm">{char.name}</p>
          <p
            className="font-display text-[9px] uppercase tracking-wider"
            style={{ color: neon }}
          >
            {char.rarity}
            {caption ? ` · ${caption}` : ""}
          </p>
        </div>
      )}

      {size === "sm" && (
        <div className="min-w-0 text-left">
          <p className="truncate font-display text-[10px] font-bold text-fg">{char.name}</p>
          <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
        </div>
      )}
    </div>
  );
}
