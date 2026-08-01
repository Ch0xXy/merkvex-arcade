/**
 * Build a safe Postgres URI for Supabase / Vercel.
 *
 * Prefer splitting password out so special characters don't break the URI:
 *   DATABASE_URL=postgresql://postgres.REF@aws-....pooler.supabase.com:5432/postgres
 *   DATABASE_PASSWORD=your raw password from Bitwarden
 *
 * Or a full URI in DATABASE_URL alone (password must be percent-encoded if special).
 */
export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = typeof process !== "undefined" ? process.env : {},
): string | undefined {
  const rawUrl = env.DATABASE_URL?.trim();
  if (!rawUrl) return undefined;

  const pass =
    env.DATABASE_PASSWORD?.trim() ||
    env.SUPABASE_DB_PASSWORD?.trim() ||
    undefined;

  let url = rawUrl.replace(/^["']|["']$/g, ""); // strip accidental quotes

  // Drop leftover placeholder brackets from Supabase copy UI
  if (pass) {
    const enc = encodeURIComponent(pass);
    if (/\[YOUR-PASSWORD\]|\[PASSWORD\]/i.test(url)) {
      url = url.replace(/\[YOUR-PASSWORD\]|\[PASSWORD\]/gi, enc);
    } else if (/:\/\/([^:/?]+)@/.test(url) && !/:\/\/[^:]+:[^@]+@/.test(url)) {
      // user@host with no password → insert
      url = url.replace(/:\/\/([^:/?]+)@/, `://$1:${enc}@`);
    } else if (/:\/\/([^:]+):([^@]*)@/.test(url)) {
      // replace existing password segment with encoded one
      url = url.replace(/:\/\/([^:]+):([^@]*)@/, `://$1:${enc}@`);
    }
  }

  // Ensure sslmode for Supabase hosts
  if (/supabase\.(co|com)|pooler\.supabase/i.test(url) && !/[?&]sslmode=/i.test(url)) {
    url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
  }

  return url;
}
