import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkCallsign } from "@/lib/profanity";
import type { GameId } from "@/lib/scores";
import {
  fetchArcadeScores,
  insertArcadeScore,
  supabaseScoresConfigured,
  trimArcadeScores,
} from "@/lib/supabaseScores";

const GAME_IDS = [
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
] as const;

const submitSchema = z.object({
  gameId: z.enum(GAME_IDS),
  playerName: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[a-zA-Z0-9_\- .]+$/, "Use letters, numbers, spaces, _ or -"),
  score: z.number().int().min(0).max(10_000_000),
});

export type LeaderboardRow = {
  id: string;
  gameId: string;
  playerName: string;
  score: number;
  createdAt: string;
  rank: number;
};

function newId() {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function mapRows(
  rows: Awaited<ReturnType<typeof fetchArcadeScores>>,
): LeaderboardRow[] {
  return rows.map((r, i) => ({
    id: r.id,
    gameId: r.game_id,
    playerName: r.player_name,
    score: Number(r.score),
    createdAt: String(r.created_at),
    rank: i + 1,
  }));
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator((data: { gameId: GameId; limit?: number }) => {
    if (!GAME_IDS.includes(data.gameId as (typeof GAME_IDS)[number])) {
      throw new Error("Invalid game");
    }
    return {
      gameId: data.gameId,
      limit: Math.min(100, Math.max(1, data.limit ?? 100)),
    };
  })
  .handler(async ({ data }) => {
    if (!supabaseScoresConfigured()) {
      console.warn(
        "[leaderboard] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — empty board",
      );
      return [] as LeaderboardRow[];
    }
    const rows = await fetchArcadeScores(data.gameId, data.limit);
    return mapRows(rows);
  });

export const submitScore = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = submitSchema.parse(data);
    const check = checkCallsign(parsed.playerName);
    if (!check.ok) {
      throw new Error(check.reason);
    }
    return { ...parsed, playerName: check.name };
  })
  .handler(async ({ data }) => {
    const check = checkCallsign(data.playerName);
    if (!check.ok) throw new Error(check.reason);

    if (!supabaseScoresConfigured()) {
      throw new Error(
        "Leaderboards not configured. On Vercel set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY " +
          "(Supabase → Project Settings → API). DATABASE_URL is optional now.",
      );
    }

    const id = newId();
    const name = check.name;
    await insertArcadeScore({
      id,
      gameId: data.gameId,
      playerName: name,
      score: data.score,
    });
    await trimArcadeScores(data.gameId, 100);

    const board = await getLeaderboard({ data: { gameId: data.gameId, limit: 100 } });
    const rank = board.findIndex((r) => r.id === id) + 1;
    return { id, rank: rank || null, board };
  });
