import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

// --- Jumper: measure x movement under A/D ---
await page.goto("http://127.0.0.1:8080/play/jumper", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Play$/i }).click();
await page.waitForTimeout(300);

// inject probe into canvas draw by reading via evaluate + rAF sampling of internal state is hard
// Instead: simulate keys and sample canvas pixel variance on left vs right halves over time
async function sampleSideMass() {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const ctx = c.getContext("2d");
    const { width: w, height: h } = c;
    const img = ctx.getImageData(0, 0, w, h).data;
    let left = 0, right = 0;
    // sample mid band where player is
    const y0 = Math.floor(h * 0.35), y1 = Math.floor(h * 0.75);
    for (let y = y0; y < y1; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const a = img[i+3], r=img[i], g=img[i+1], b=img[i+2];
        // non-bg bright-ish pixels
        if (a > 10 && (r+g+b) > 80) {
          if (x < w/2) left++; else right++;
        }
      }
    }
    return { left, right, w, h };
  });
}

await page.keyboard.down("KeyA");
await page.waitForTimeout(700);
await page.keyboard.up("KeyA");
await page.waitForTimeout(50);
const leftSample = await sampleSideMass();
await page.keyboard.down("KeyD");
await page.waitForTimeout(900);
await page.keyboard.up("KeyD");
await page.waitForTimeout(50);
const rightSample = await sampleSideMass();
console.log("jumper left-hold sample", leftSample);
console.log("jumper right-hold sample", rightSample);
// Expect more mass on left after A, more on right after D (rough heuristic)
const leftBias = leftSample && leftSample.left > leftSample.right * 0.7;
const rightBias = rightSample && rightSample.right > rightSample.left * 0.7;
console.log("leftBias?", leftBias, "rightBias?", rightBias);

// --- Snake: score then submit ---
await page.goto("http://127.0.0.1:8080/play/snake", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Play$/i }).click();
await page.waitForTimeout(200);

// play longer trying to get points by random directions
const dirs = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
for (let i = 0; i < 80; i++) {
  await page.keyboard.press(dirs[i % 4]);
  await page.waitForTimeout(90);
}
// force wall death
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(70);
}
await page.waitForTimeout(600);
const scoreText = await page.locator("text=Score").first().textContent().catch(()=>null);
console.log("score header", scoreText);
const gameOver = await page.getByText("Game Over").count();
console.log("game over", gameOver > 0);
// read score from overlay
const overlayScore = await page.locator(".glow-electric, .text-electric").allTextContents();
console.log("overlay texts", overlayScore.slice(0,8));

// If score form present, submit
const postBtn = page.getByRole("button", { name: /Post score/i });
if (await postBtn.count()) {
  await page.locator('input[aria-label="Player name"]').fill("PilotPilot");
  await postBtn.click();
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  console.log("after post:", body.includes("Posted") || body.includes("rank") || body.includes("global"));
  console.log("snippet:", body.match(/Posted[^\n]*/)?.[0] || body.match(/Could not[^\n]*/)?.[0] || "no post msg");
} else {
  console.log("no post form (score may be 0)");
  // Direct server fn call via fetch - TanStack server functions use special endpoints
  // Try posting through evaluate
  const res = await page.evaluate(async () => {
    try {
      // hit the same createServerFn if exposed - fallback: look for _serverFn
      const r = await fetch("/_serverFn/submitScore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { gameId: "snake", playerName: "TestPilot", score: 120 } }),
      });
      return { status: r.status, text: (await r.text()).slice(0, 300) };
    } catch (e) {
      return { err: String(e) };
    }
  });
  console.log("direct submit attempt", res);
}

// Home leaderboard
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/live-home-lb.png" });
const lb = await page.locator("text=Global").allTextContents();
console.log("home global labels", lb.slice(0,5));
console.log("errors", errs);
await browser.close();
