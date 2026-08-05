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

/**
 * Display names must NOT match real commercial game trademarks
 * (no Breakout, Invaders, Snake, Memory, Flappy, etc.).
 * Internal ids stay stable for scores/leaderboards.
 */
export const GAMES: GameMeta[] = [
  {
    id: "breakout",
    title: "Brick Volt",
    tagline: "Smash the wall",
    blurb: "Bounce the spark. Clear every brick. Don't drop it.",
    controls: "Move: mouse / touch / arrows · P pause",
    accent: "electric",
    icon: "breakout",
  },
  {
    id: "flappy",
    title: "Gap Glide",
    tagline: "One tap at a time",
    blurb: "Thread the gaps. Timing is everything.",
    controls: "Tap: click / space / touch",
    accent: "cyan",
    icon: "flappy",
  },
  {
    id: "whack",
    title: "Critter Pop",
    tagline: "Hit them before they vanish",
    blurb: "Tap the critters. Rarer ones score bigger.",
    controls: "Click / tap targets",
    accent: "electric",
    icon: "whack",
  },
  {
    id: "snake",
    title: "Neon Coil",
    tagline: "Grow or crash",
    blurb: "Eat the orbs. Don't hit the walls — or yourself.",
    controls: "WASD / arrows / swipe",
    accent: "cyan",
    icon: "snake",
  },
  {
    id: "jumper",
    title: "Pad Climb",
    tagline: "Climb forever",
    blurb: "Bounce up the pads. Grab pickups for combos.",
    controls: "Move: A/D · arrows · drag",
    accent: "electric",
    icon: "jumper",
  },
  {
    id: "hangman",
    title: "Letter Lock",
    tagline: "Guess the word",
    blurb: "Pick a pack. Fill in the letters. Don't run out of tries.",
    controls: "Type or tap letters",
    accent: "cyan",
    icon: "hangman",
  },
  {
    id: "invaders",
    title: "Swarm Hold",
    tagline: "Hold the line",
    blurb: "Shoot the swarm before it reaches you.",
    controls: "Move: arrows / A D · Shoot: space / tap",
    accent: "electric",
    icon: "invaders",
  },
  {
    id: "tower",
    title: "Path Guard",
    tagline: "Defend the path",
    blurb: "Place pads. Spend energy. Stop the rush.",
    controls: "Tap empty pads to place · drag to pan",
    accent: "cyan",
    icon: "tower",
  },
  {
    id: "runner",
    title: "Lane Dash",
    tagline: "Three lanes. Don't crash.",
    blurb: "Swap lanes. Dodge junk. Grab charge.",
    controls: "Lanes: on-screen ← → · arrows / A D / swipe · 1 2 3",
    accent: "electric",
    icon: "runner",
  },
  {
    id: "memory",
    title: "Pair Flip",
    tagline: "Match the pairs",
    blurb: "Flip cards. Find matches. Clear the board.",
    controls: "Tap cards · pick a board size",
    accent: "cyan",
    icon: "memory",
  },
];

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
