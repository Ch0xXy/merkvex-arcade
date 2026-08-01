/**
 * Player agent loadout + unlock gate.
 *
 * Today (arcade standalone): all agents unlocked.
 * When Merkvex site is wired: pass owned agent IDs into `setUnlockSource`
 * (or set `window.__MERKVEX_UNLOCKED__ = string[] | 'all'`) so locked
 * portraits can't be selected until the player owns them.
 */

import { CHARACTERS, type Character } from "@/lib/characters";

const SELECTED_KEY = "merkvex-arcade-agent-v1";
const DEFAULT_ID = "cyber-chick";

export type UnlockSource = "all" | Set<string> | (() => "all" | string[]);

let unlockSource: UnlockSource = "all";

/** Inject ownership from the parent Merkvex app. Call once on boot. */
export function setUnlockSource(source: UnlockSource) {
  unlockSource = source;
}

function readUnlockIds(): "all" | Set<string> {
  // Parent site can inject before React boots
  if (typeof window !== "undefined") {
    const w = window as Window & { __MERKVEX_UNLOCKED__?: "all" | string[] };
    if (w.__MERKVEX_UNLOCKED__ === "all") return "all";
    if (Array.isArray(w.__MERKVEX_UNLOCKED__)) {
      return new Set(w.__MERKVEX_UNLOCKED__);
    }
  }
  if (unlockSource === "all") return "all";
  if (unlockSource instanceof Set) return unlockSource;
  const v = unlockSource();
  return v === "all" ? "all" : new Set(v);
}

export function isAgentUnlocked(id: string): boolean {
  const u = readUnlockIds();
  if (u === "all") return true;
  // Always keep a free starter pool so arcade never dead-ends
  const free = new Set([
    "street-handler",
    "pocket-slime",
    "deck-runner",
    "cyber-chick",
    "kiosk-clerk",
    "glass-kitten",
    "patch-hacker",
    "spark-beetle",
  ]);
  return free.has(id) || u.has(id);
}

export function getCharacter(id: string | null | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS.find((c) => c.id === DEFAULT_ID) ?? CHARACTERS[0]!;
}

export function getSelectedAgentId(): string {
  if (typeof window === "undefined") return DEFAULT_ID;
  try {
    const id = localStorage.getItem(SELECTED_KEY);
    if (id && CHARACTERS.some((c) => c.id === id) && isAgentUnlocked(id)) return id;
  } catch {
    /* ignore */
  }
  return DEFAULT_ID;
}

export function getSelectedAgent(): Character {
  return getCharacter(getSelectedAgentId());
}

export function setSelectedAgentId(id: string): Character | null {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) return null;
  if (!isAgentUnlocked(id)) return null;
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("merkvex-agent-change", { detail: { id } }));
  }
  return c;
}

export function listSelectableAgents(): { char: Character; unlocked: boolean }[] {
  return CHARACTERS.map((char) => ({ char, unlocked: isAgentUnlocked(char.id) }));
}
