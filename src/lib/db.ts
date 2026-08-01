/** Which database backend is active. */
export type DbSource = "postgres" | "pglite";

/**
 * Resolve DATABASE_URL at call time (not module top-level).
 * Vite/Nitro can evaluate top-level process.env at build time when the var
 * is missing, baking `pglite` into the Vercel bundle permanently.
 */
function getDatabaseUrl(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const raw = process.env.DATABASE_URL;
  return raw && raw.trim() ? raw.trim() : undefined;
}

function isVercelOrProd(): boolean {
  if (typeof process === "undefined") return false;
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL === "true" ||
    process.env.NODE_ENV === "production"
  );
}

/**
 * Active backend:
 * - **Postgres** when `DATABASE_URL` is set (Supabase / any PG)
 * - **PGLite** only for local/dev without DATABASE_URL
 * - Never PGLite on Vercel (WASM data file is not in the serverless bundle)
 */
export function resolveDbSource(): DbSource {
  if (getDatabaseUrl()) return "postgres";
  if (isVercelOrProd()) {
    throw new Error(
      "[db] DATABASE_URL is not set on this Vercel deployment. " +
        "Add it under Project → Settings → Environment Variables (Production), " +
        "then Redeploy. Use the Supabase Database URI (transaction pooler).",
    );
  }
  return "pglite";
}

/** @deprecated use resolveDbSource() — kept for any static imports */
export const dbSource: DbSource = "postgres"; // label only; real path is lazy

/**
 * Minimal shared SQL surface, satisfied by both Postgres and PGLite.
 */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
  __pgUrlUsed__?: string;
};

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

function createPostgresSql(connectionString: string): Promise<Sql> {
  // Reuse pool if URL unchanged; recreate if env changed (rare)
  if (
    globalRef.__pgSqlPromise__ &&
    globalRef.__pgUrlUsed__ === connectionString
  ) {
    return globalRef.__pgSqlPromise__;
  }
  globalRef.__pgUrlUsed__ = connectionString;
  globalRef.__pgSqlPromise__ = (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({
      connectionString,
      // Supabase transaction pooler / serverless-friendly
      max: 1,
      ssl: connectionString.includes("supabase")
        ? { rejectUnauthorized: false }
        : undefined,
    });
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    globalRef.__pgUrlUsed__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  if (isVercelOrProd()) {
    throw new Error(
      "[db] PGLite is disabled on Vercel. Set DATABASE_URL to your Supabase Postgres URI.",
    );
  }
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite({
      parsers: {
        [OID_INT8]: Number,
        [OID_DATE]: identity,
        [OID_INTERVAL]: identity,
      },
    });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = new Set(doneRows.rows.map((r) => r.name));
    for (const [path, text] of Object.entries(migrations).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const name = path.split("/").pop() as string;
      if (done.has(name)) continue;
      await pg.transaction(async (tx) => {
        await tx.exec(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined)
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;
let sqlPromiseKey: string | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  const source = resolveDbSource();
  if (source === "postgres") {
    const url = getDatabaseUrl()!;
    return createPostgresSql(url);
  }
  return createPgliteSql();
}

/**
 * Shared server-only SQL client.
 * Postgres (Supabase) when DATABASE_URL is set; PGLite only for local dev.
 */
export function getSql(): Promise<Sql> {
  const key = getDatabaseUrl() ?? "pglite";
  if (sqlPromise && sqlPromiseKey === key) return sqlPromise;
  sqlPromiseKey = key;
  sqlPromise = createSql().catch((err) => {
    sqlPromise = null;
    sqlPromiseKey = null;
    throw err;
  });
  return sqlPromise;
}

export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (resolveDbSource() !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export function ensureDbReady(): Promise<void> {
  try {
    if (resolveDbSource() !== "pglite") return Promise.resolve();
  } catch {
    return Promise.resolve();
  }
  return getSql().then(() => undefined);
}

// Eager PGLite only in local Node dev — never on Vercel
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && !isVercelOrProd() && !getDatabaseUrl()) {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
  });
}
