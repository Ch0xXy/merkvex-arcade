import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

await page.goto("http://127.0.0.1:8080/play/jumper", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Play$/i }).click();
await page.waitForTimeout(200);

// Hook into canvas by patching requestAnimationFrame isn't easy.
// Instrument via page.evaluate to read key state by dispatching and measuring player blob centroid.

async function playerCentroid() {
  return page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return null;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const w = c.width, h = c.height;
    const img = ctx.getImageData(0, 0, w, h).data;
    let sx = 0, sy = 0, n = 0;
    // player is yellowish/bright and mid-lower region typically
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        const r = img[i], g = img[i+1], b = img[i+2], a = img[i+3];
        if (a < 200) continue;
        // character sprites have mixed colors; find non-platform non-bg
        // platforms are flat yellow/cyan strips - skip thin horizontal lines by requiring vertical density
        // Use high-saturation colorful pixels
        const max = Math.max(r,g,b), min = Math.min(r,g,b);
        if (max < 60) continue;
        if (max - min < 25 && max < 200) continue; // dull
        // exclude pure electric yellow platform bars (high y-span small)
        sx += x; sy += y; n++;
      }
    }
    if (!n) return null;
    return { x: sx / n, y: sy / n, n, w };
  });
}

// baseline
await page.waitForTimeout(300);
const mid = await playerCentroid();

// hold A for 0.8s
await page.keyboard.down("KeyA");
await page.waitForTimeout(800);
await page.keyboard.up("KeyA");
await page.waitForTimeout(50);
const left = await playerCentroid();

// hold D for 1.0s  
await page.keyboard.down("KeyD");
await page.waitForTimeout(1000);
await page.keyboard.up("KeyD");
await page.waitForTimeout(50);
const right = await playerCentroid();

console.log({ mid, left, right });
if (left && right) {
  console.log("delta left-right x", right.x - left.x);
  console.log("moved left of mid?", left.x < (mid?.x ?? 999));
  console.log("moved right of left?", right.x > left.x);
}
await page.screenshot({ path: "/workspace/screenshots/jumper-after-move.png" });
await browser.close();
