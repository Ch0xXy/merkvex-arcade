// Probe via vite SSR load of db module through the running server's API is hard.
// Instead, patch-test: use vite createServer and load module.
import { createServer } from "vite";
import { fileURLToPath } from "url";

const server = await createServer({
  configFile: "/workspace/vite.config.ts",
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const mod = await server.ssrLoadModule("/src/lib/db.ts");
  console.log("ensureDbReady", typeof mod.ensureDbReady);
  await mod.ensureDbReady();
  const sql = await mod.getSql();
  const migs = await sql.query("select name from _migrations order by name");
  console.log("migrations", migs);
  const tables = await sql.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  console.log("tables", tables);
} catch (e) {
  console.error("ERR", e);
} finally {
  await server.close();
}
