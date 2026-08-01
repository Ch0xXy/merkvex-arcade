import { chromium } from "playwright";
import fs from "fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

async function playGame(id, name, afterStart) {
  await page.goto(`http://127.0.0.1:8080/play/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  // click Play
  const play = page.getByRole("button", { name: /^Play$/i });
  if (await play.count()) await play.click();
  await page.waitForTimeout(400);
  if (afterStart) await afterStart(page);
  await page.waitForTimeout(1200);
  const path = `/workspace/screenshots/live-${id}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(id, "shot", path, "errors", errors.length);
  // try end via wait? skip
  return path;
}

await playGame("flappy", "flappy", async (p) => {
  // flap a few times
  for (let i = 0; i < 8; i++) {
    await p.keyboard.press("Space");
    await p.waitForTimeout(280);
  }
});
errors.length = 0;

await playGame("whack", "whack", async (p) => {
  // tap center of canvas a few times
  const canvas = p.locator("canvas");
  const box = await canvas.boundingBox();
  if (box) {
    for (let i = 0; i < 12; i++) {
      const x = box.x + box.width * (0.2 + (i % 3) * 0.3);
      const y = box.y + box.height * (0.35 + Math.floor(i / 3) * 0.18);
      await p.mouse.click(x, y);
      await p.waitForTimeout(180);
    }
  }
});
errors.length = 0;

await playGame("snake", "snake", async (p) => {
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(400);
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(400);
  await p.keyboard.press("ArrowLeft");
  await p.waitForTimeout(400);
});
errors.length = 0;

await playGame("jumper", "jumper", async (p) => {
  // hold A then D
  await p.keyboard.down("KeyA");
  await p.waitForTimeout(500);
  await p.keyboard.up("KeyA");
  await p.keyboard.down("KeyD");
  await p.waitForTimeout(600);
  await p.keyboard.up("KeyD");
  await p.waitForTimeout(800);
});

// Leaderboard submit test via page evaluate fetch to server fn is complex;
// use the game over flow if jumper dies
await page.goto("http://127.0.0.1:8080/play/snake", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Play$/i }).click();
await page.waitForTimeout(200);
// crash into wall quickly
for (let i = 0; i < 30; i++) {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(80);
}
await page.waitForTimeout(500);
const over = await page.getByText("Game Over").count();
console.log("snake game over?", over > 0);
if (over > 0) {
  const input = page.locator('input[aria-label="Player name"]');
  if (await input.count()) {
    await input.fill("QAPilot");
    await page.getByRole("button", { name: /Post score/i }).click();
    await page.waitForTimeout(1500);
    const body = await page.textContent("body");
    console.log("post result snippet:", (body || "").slice(0, 400));
  }
}
await page.screenshot({ path: "/workspace/screenshots/live-snake-over.png" });
console.log("console/page errors total logged above");
await browser.close();
