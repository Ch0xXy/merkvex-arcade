import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { checkCallsign } from "@/lib/profanity";
import type { GameId } from "@/lib/scores";

const GAME_IDS = ["breakout", "flappy", "whack", "snake", "jumper", "hangman", "invaders", "tower", "runner", "memory"] as const;

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
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      game_id: string;
      player_name: string;
      score: number;
      created_at: string;
    }>(
      `select id, game_id, player_name, score, created_at
       from arcade_scores
       where game_id = $1
       order by score desc, created_at asc
       limit $2`,
      [data.gameId, data.limit],
    );
    return rows.map((r, i) => ({
      id: r.id,
      gameId: r.game_id,
      playerName: r.player_name,
      score: Number(r.score),
      createdAt: String(r.created_at),
      rank: i + 1,
    })) satisfies LeaderboardRow[];
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

    const sql = await getSql();
    const id = newId();
    const name = check.name;
    await sql.query(
      `insert into arcade_scores (id, game_id, player_name, score)
       values ($1, $2, $3, $4)`,
      [id, data.gameId, name, data.score],
    );

    await sql.query(
      `delete from arcade_scores
       where game_id = $1
         and id not in (
           select id from arcade_scores
           where game_id = $1
           order by score desc, created_at asc
           limit 100
         )`,
      [data.gameId],
    );

    const board = await getLeaderboard({ data: { gameId: data.gameId, limit: 100 } });
    const rank = board.findIndex((r) => r.id === id) + 1;
    return { id, rank: rank || null, board };
  });
