import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

// Call submitScore the same way the app does - via the imported server fn
// Easiest: open play page, evaluate by importing isn't easy.
// Use network: click through with forced score by monkeypatching local state after game over.

// Approach: use page to load Leaderboard component's submit by invoking server fn through window fetch
// Discover the server fn URL pattern from getLeaderboard first
const lbReqs = [];
page.on("request", (r) => {
  if (r.url().includes("_serverFn")) lbReqs.push({ method: r.method(), url: r.url(), post: r.postData() });
});

await page.goto("http://127.0.0.1:8080/play/snake", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Find submitScore export id from leaderboard.ts module
const leaderboardSrc = await page.evaluate(async () => {
  const r = await fetch("/src/lib/leaderboard.ts");
  return r.text();
});
// look for createClientRpc ids
const ids = [...leaderboardSrc.matchAll(/createClientRpc\("([^"]+)"\)/g)].map(m => m[1]);
console.log("server fn ids", ids);

// POST submit using same encoding as client if possible
// Simpler path: use Playwright to run the client module's submitScore
const result = await page.evaluate(async () => {
  // dynamic import of the client-transformed leaderboard module
  const mod = await import("/src/lib/leaderboard.ts");
  try {
    const res = await mod.submitScore({ data: { gameId: "snake", playerName: "TestPilot", score: 420 } });
    return { ok: true, res };
  } catch (e) {
    return { ok: false, err: String(e), stack: e?.stack?.slice(0,300) };
  }
});
console.log("submit result", JSON.stringify(result, null, 2));

const board = await page.evaluate(async () => {
  const mod = await import("/src/lib/leaderboard.ts");
  return mod.getLeaderboard({ data: { gameId: "snake", limit: 10 } });
});
console.log("board", board);

// also flappy, whack, jumper sample posts
for (const g of ["flappy", "whack", "jumper", "breakout"]) {
  const r = await page.evaluate(async (gameId) => {
    const mod = await import("/src/lib/leaderboard.ts");
    return mod.submitScore({ data: { gameId, playerName: "Pilot", score: 100 + Math.floor(Math.random()*50) } });
  }, g);
  console.log(g, "rank", r.rank, "top", r.board?.[0]?.score);
}

// home page shows board
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
// click snake board tab if present
const snakeBtn = page.getByRole("button", { name: /Neon Coil|snake/i });
if (await snakeBtn.count()) await snakeBtn.first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/lb-home.png" });
const text = await page.locator("body").innerText();
console.log("has TestPilot?", text.includes("TestPilot"));
console.log("has Pilot?", text.includes("Pilot"));
console.log("errors", errs.slice(0,5));
await browser.close();
