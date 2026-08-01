const PREFIX = "merkvex-arcade-v1:";

export type GameId =
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

export const ALL_GAME_IDS: GameId[] = [
  "breakout",
  "flappy",
  "whack",
  "snake",
  "jumper",
  "hangman",
  "invaders",
  "tower",
  "runner",
  "memory",
];

export function getHighScore(gameId: GameId): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(PREFIX + gameId);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setHighScore(gameId: GameId, score: number): number {
  const prev = getHighScore(gameId);
  const next = Math.max(prev, Math.floor(score));
  try {
    localStorage.setItem(PREFIX + gameId, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function getAllHighScores(): Record<GameId, number> {
  return Object.fromEntries(ALL_GAME_IDS.map((id) => [id, getHighScore(id)])) as Record<
    GameId,
    number
  >;
}
