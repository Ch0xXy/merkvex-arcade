import type { GameId } from "@/lib/scores";

export type GameMeta = {
  id: GameId;
  title: string;
  tagline: string;
  blurb: string;
  controls: string;
  accent: "electric" | "cyan";
  icon:
    | "breakout"
    | "flappy"
    | "whack"
    | "snake"
    | "jumper"
    | "hangman"
    | "invaders"
    | "tower"
    | "runner"
    | "memory";
};

export const GAMES: GameMeta[] = [
  {
    id: "breakout",
    title: "Volt Breakout",
    tagline: "Smash the market wall",
    blurb:
      "Bounce the spark ball and clear agent bricks. Higher rarity faces are tougher — clear the board for a new wave.",
    controls: "Move: mouse / touch / ← → · P pause",
    accent: "electric",
    icon: "breakout",
  },
  {
    id: "flappy",
    title: "Deck Flyer",
    tagline: "One flap, infinite vaults",
    blurb: "Pilot a Merkvex agent through neon gateways. Miss a gap and you're glitched out.",
    controls: "Flap: click / space / tap",
    accent: "cyan",
    icon: "flappy",
  },
  {
    id: "whack",
    title: "Whack-a-Agent",
    tagline: "Pop rares before they vanish",
    blurb: "Characters pop from the board. Higher rarity = more points. Don't miss the mythics.",
    controls: "Click / tap agents",
    accent: "electric",
    icon: "whack",
  },
  {
    id: "snake",
    title: "Neon Coil",
    tagline: "Grow the signal chain",
    blurb: "Guide the coil and scoop glowing energy pods. Violet pods are rare and pack more charge.",
    controls: "WASD / arrows / swipe",
    accent: "cyan",
    icon: "snake",
  },
  {
    id: "jumper",
    title: "Vault Jumper",
    tagline: "Endless platform climb",
    blurb: "Bounce upward through floating pads. Collect agents mid-air for combo score.",
    controls: "Move: A/D · ←/→ · drag",
    accent: "electric",
    icon: "jumper",
  },
  {
    id: "hangman",
    title: "Cipher Scramble",
    tagline: "Pick packs. Crack words.",
    blurb:
      "Hangman with a full word library — mix Merkvex, cyberpunk, space, market, animals, food, and more.",
    controls: "Pick packs · type / tap letters",
    accent: "cyan",
    icon: "hangman",
  },
  {
    id: "invaders",
    title: "Volt Invaders",
    tagline: "Hold the neon skyline",
    blurb:
      "Pilot your agent under a descending swarm. Blast hostile units before they breach the vault line.",
    controls: "Move: ← → / A D · Shoot: space / tap",
    accent: "electric",
    icon: "invaders",
  },
  {
    id: "tower",
    title: "Vault Guard",
    tagline: "Tower defense lite",
    blurb:
      "Serpentine levels, outer pads that actually shoot, and rising maps. Spend energy, hold the core.",
    controls: "Tap empty pads to place · drag to pan (desktop click)",
    accent: "cyan",
    icon: "tower",
  },
  {
    id: "runner",
    title: "Lane Runner",
    tagline: "Three lanes, infinite signal",
    blurb:
      "Sprint your pilot down neon lanes. Dodge junk, scoop charge, and outrun the glitch storm.",
    controls: "Lanes: ← → / A D / swipe · 1 2 3",
    accent: "electric",
    icon: "runner",
  },
  {
    id: "memory",
    title: "Market Memory",
    tagline: "Match the vault agents",
    blurb:
      "Flip agent cards and clear the whole board. Three sizes, rarity + combos for score — no clock.",
    controls: "Tap cards · Compact / Standard / Deep vault",
    accent: "cyan",
    icon: "memory",
  },
];

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
