import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const reqs = [];
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("server") || u.includes("leaderboard") || u.includes("_server") || u.includes("fn")) {
    reqs.push({ method: r.method(), url: u, post: r.postData()?.slice(0,200) });
  }
});
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("server") || u.includes("fn") || u.includes("leaderboard")) {
    const t = await r.text().catch(()=>"");
    console.log("RESP", r.status(), u.slice(0,120), t.slice(0,200));
  }
});
await page.goto("http://127.0.0.1:8080/play/snake", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("captured reqs", JSON.stringify(reqs, null, 2));
await browser.close();
