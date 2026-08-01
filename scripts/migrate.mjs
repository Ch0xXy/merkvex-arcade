#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs after `vite build` when DATABASE_URL is set. On Vercel + Supabase:
 * - SSL is required
 * - Transaction pooler (6543) dislikes multi-statement BEGIN blocks → apply
 *   each statement carefully / use IF NOT EXISTS
 * - Failure must not block deploys when schema is already applied via Supabase MCP
 *
 * No DATABASE_URL → skip (local PGLite handles itself).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const onVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (PGLite / already-migrated Supabase).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

function poolConfig(url) {
  const isSupabase = /supabase\.(co|com)/i.test(url) || url.includes("pooler.supabase");
  return {
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 15_000,
    // Supabase requires TLS; local Docker often does not
    ssl: isSupabase || onVercel ? { rejectUnauthorized: false } : undefined,
  };
}

async function main() {
  const pool = new pg.Pool(poolConfig(databaseUrl));
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name),
    );

    let files;
    try {
      files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    } catch {
      console.log("[migrate] no migrations/ directory — nothing to do.");
      return;
    }

    let count = 0;
    for (const name of files) {
      if (applied.has(name)) continue;
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        // Avoid BEGIN/COMMIT multi-statement (breaks Supabase transaction pooler).
        // Each file should be idempotent (IF NOT EXISTS).
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [
          name,
        ]);
      } catch (err) {
        // Already applied outside this tracker (e.g. Supabase MCP)
        const msg = String(err?.message || err);
        if (/already exists|duplicate/i.test(msg)) {
          await client.query(
            "INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            [name],
          );
          console.log(`[migrate] ${name} already present — marked applied`);
          count += 1;
          continue;
        }
        console.error(`[migrate] error applying ${name}`);
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  // Schema may already exist on Supabase; never block a Vercel deploy on migrate
  if (onVercel) {
    console.error(
      "[migrate] non-fatal on Vercel — deploy continues. Fix DATABASE_URL/SSL if boards stay empty.",
    );
    process.exit(0);
  }
  process.exit(1);
});
