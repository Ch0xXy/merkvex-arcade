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
      "Bounce the spark ball and clear the wall. Higher rarity faces take more hits. Clear the board for a new wave.",
    controls: "Move: mouse / touch / ← → · P pause",
    accent: "electric",
    icon: "breakout",
  },
  {
    id: "flappy",
    title: "Deck Flyer",
    tagline: "One flap, open sky",
    blurb: "Fly your character through neon gates. Miss a gap and the run ends.",
    controls: "Flap: click / space / tap",
    accent: "cyan",
    icon: "flappy",
  },
  {
    id: "whack",
    title: "Rare Rush",
    tagline: "Pop rares before they vanish",
    blurb: "Characters pop from the board. Higher rarity = more points. Catch the mythics.",
    controls: "Click / tap targets",
    accent: "electric",
    icon: "whack",
  },
  {
    id: "snake",
    title: "Neon Coil",
    tagline: "Grow the signal chain",
    blurb: "Guide the coil and scoop glowing energy pods. Violet pods pack more charge.",
    controls: "WASD / arrows / swipe",
    accent: "cyan",
    icon: "snake",
  },
  {
    id: "jumper",
    title: "Vault Jumper",
    tagline: "Endless platform climb",
    blurb: "Bounce upward through floating pads. Grab mid-air pickups for combo score.",
    controls: "Move: A/D · ←/→ · drag",
    accent: "electric",
    icon: "jumper",
  },
  {
    id: "hangman",
    title: "Cipher Scramble",
    tagline: "Pick packs. Crack words.",
    blurb:
      "Word puzzles with a full library: Merkvex, market, space, animals, food, and more.",
    controls: "Pick packs · type / tap letters",
    accent: "cyan",
    icon: "hangman",
  },
  {
    id: "invaders",
    title: "Volt Invaders",
    tagline: "Hold the neon skyline",
    blurb:
      "Defend the vault line from a descending swarm. Blast hostiles before they break through.",
    controls: "Move: ← → / A D · Shoot: space / tap",
    accent: "electric",
    icon: "invaders",
  },
  {
    id: "tower",
    title: "Vault Guard",
    tagline: "Tower defense lite",
    blurb:
      "Serpentine paths, pads that shoot, rising maps. Spend energy and hold the core.",
    controls: "Tap empty pads to place · drag to pan (desktop click)",
    accent: "cyan",
    icon: "tower",
  },
  {
    id: "runner",
    title: "Lane Runner",
    tagline: "Three lanes, endless night",
    blurb:
      "Sprint down neon lanes. Dodge junk, scoop charge, outrun the glitch storm.",
    controls: "Lanes: ← → / A D / swipe · 1 2 3",
    accent: "electric",
    icon: "runner",
  },
  {
    id: "memory",
    title: "Market Memory",
    tagline: "Match the vault faces",
    blurb:
      "Flip cards and clear the board. Three sizes, rarity + combos for score. No clock.",
    controls: "Tap cards · Compact / Standard / Deep vault",
    accent: "cyan",
    icon: "memory",
  },
];

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
