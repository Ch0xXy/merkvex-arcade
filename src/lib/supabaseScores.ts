/**
 * Arcade leaderboard via Supabase PostgREST (service role).
 * Avoids fragile Postgres connection strings / pooler passwords on Vercel.
 *
 * Env (server-only on Vercel):
 *   SUPABASE_URL=https://kywqyvygmvogsgcpbajj.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Project Settings → API → service_role)
 *
 * Optional fallbacks: NEXT_PUBLIC_SUPABASE_URL, VITE_SUPABASE_URL (URL only — never put service key in VITE_)
 */

export type ArcadeScoreRow = {
  id: string;
  game_id: string;
  player_name: string;
  score: number;
  created_at: string;
};

/** Merkvex prod Supabase — public project URL (not a secret). */
const MERKVEX_SUPABASE_URL = "https://kywqyvygmvogsgcpbajj.supabase.co";

function supabaseConfig() {
  // Prefer explicit env; fall back to known Merkvex prod URL so Vercel only needs the key.
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    MERKVEX_SUPABASE_URL
  )
    .trim()
    .replace(/\/$/, "");
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ""
  ).trim();
  return { url, key, hasKey: Boolean(key) };
}

export function supabaseScoresConfigured(): boolean {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

export function supabaseScoresConfigHint(): string {
  const { hasKey } = supabaseConfig();
  if (!hasKey) {
    return (
      "Missing SUPABASE_SERVICE_ROLE_KEY on Vercel. " +
      "Supabase → Project Settings → API → service_role (secret). " +
      "Vercel → merkvex-arcade → Settings → Environment Variables → " +
      "Name: SUPABASE_SERVICE_ROLE_KEY → paste key → Production → Save → Redeploy."
    );
  }
  return "Supabase scores config incomplete.";
}

function restHeaders(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export async function fetchArcadeScores(
  gameId: string,
  limit: number,
): Promise<ArcadeScoreRow[]> {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    throw new Error(supabaseScoresConfigHint());
  }
  const res = await fetch(
    `${url}/rest/v1/arcade_scores?select=id,game_id,player_name,score,created_at&game_id=eq.${encodeURIComponent(gameId)}&order=score.desc,created_at.asc&limit=${limit}`,
    { headers: restHeaders(key), method: "GET" },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[scores] GET failed ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ArcadeScoreRow[];
}

export async function insertArcadeScore(row: {
  id: string;
  gameId: string;
  playerName: string;
  score: number;
}): Promise<void> {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    throw new Error(supabaseScoresConfigHint());
  }
  const res = await fetch(`${url}/rest/v1/arcade_scores`, {
    method: "POST",
    headers: restHeaders(key),
    body: JSON.stringify({
      id: row.id,
      game_id: row.gameId,
      player_name: row.playerName,
      score: row.score,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[scores] INSERT failed ${res.status}: ${body.slice(0, 200)}`);
  }
}

/** Keep top 100 per game (best-effort; ignores delete errors). */
export async function trimArcadeScores(gameId: string, keep = 100): Promise<void> {
  const { url, key } = supabaseConfig();
  if (!url || !key) return;
  const top = await fetchArcadeScores(gameId, keep);
  if (top.length < keep) return;
  const minKeep = top[top.length - 1]?.score;
  if (minKeep == null) return;
  // Delete scores strictly below the 100th (simple trim; ties may keep slightly more)
  const res = await fetch(
    `${url}/rest/v1/arcade_scores?game_id=eq.${encodeURIComponent(gameId)}&score=lt.${minKeep}`,
    { method: "DELETE", headers: restHeaders(key) },
  );
  if (!res.ok) {
    console.warn("[scores] trim failed", res.status, await res.text());
  }
}
