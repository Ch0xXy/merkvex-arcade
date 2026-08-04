/**
 * Subpath deploy support (merkvex.com/arcade, Option B — Netlify proxy).
 *
 * With ARCADE_BASE=/arcade/ the SSR HTML references /arcade/assets/* and
 * /arcade/characters/*, but Vite/Nitro still emit the physical files at
 * .vercel/output/static/{assets,characters,...}. Vercel serves static files
 * by literal path, so without this step every asset request would fall
 * through to the server function and 404.
 *
 * Fix: mirror the static output into static/<base>/ after the build. Both
 * URL shapes then work — merkvex.com/arcade/* through the prefix-preserving
 * Netlify proxy AND direct merkvex-arcade.vercel.app/arcade/* origin checks.
 *
 * No-op when ARCADE_BASE is unset ("/"), so the standalone deployment and
 * local builds are untouched.
 */
import { cpSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const raw = process.env.ARCADE_BASE || "/";
// Git Bash on Windows rewrites "/arcade/" into "C:/.../arcade/" (MSYS path
// conversion) — refuse anything that isn't a plain URL path segment.
if (!/^\/[a-z0-9/_-]*$/i.test(raw)) {
  console.error(`[subpath-assets] ARCADE_BASE looks mangled: "${raw}" — expected e.g. "/arcade/". On Git Bash use MSYS_NO_PATHCONV=1 or run from PowerShell.`);
  process.exit(1);
}
const base = raw.replace(/^\/+|\/+$/g, ""); // "/arcade/" -> "arcade"
if (!base) {
  console.log("[subpath-assets] ARCADE_BASE unset — nothing to do");
  process.exit(0);
}

const staticDir = join(process.cwd(), ".vercel", "output", "static");
if (!existsSync(staticDir)) {
  console.error(`[subpath-assets] ${staticDir} missing — run after vite build`);
  process.exit(1);
}

const dest = join(staticDir, base);
let copied = 0;
for (const entry of readdirSync(staticDir)) {
  if (entry === base) continue; // never recurse into our own mirror
  cpSync(join(staticDir, entry), join(dest, entry), { recursive: true });
  copied++;
}
console.log(`[subpath-assets] mirrored ${copied} static entries under /${base}/`);
