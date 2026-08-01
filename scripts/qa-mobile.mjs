import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
page.on("pageerror", e => errs.push(String(e)));
for (const path of ["/", "/play/flappy", "/play/whack", "/play/snake", "/play/jumper"]) {
  await page.goto("http://127.0.0.1:8080" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  console.log(path, "overflow?", overflow, "title", await page.title());
  await page.screenshot({ path: `/workspace/screenshots/mobile${path.replace(/\//g,"-") || "-home"}.png` });
}
console.log("errors", errs);
await browser.close();
