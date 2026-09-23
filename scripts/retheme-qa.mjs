import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("screenshots", { recursive: true });

const results = { errors: [], shots: [], detail: null };
const browser = await chromium.launch();

async function capture(ctxOpts, prefix, routes) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results.errors.push(prefix + " pageerror: " + String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
      results.errors.push(prefix + " console: " + m.text());
    }
  });
  for (const r of routes) {
    await page
      .goto(BASE + r.route, { waitUntil: "networkidle", timeout: 60000 })
      .catch((e) => results.errors.push(prefix + " goto " + r.route + ": " + e.message));
    await page.waitForTimeout(900);
    if (r.scroll) {
      await page.evaluate((y) => window.scrollTo(0, y), r.scroll);
      await page.waitForTimeout(500);
    }
    const file = `screenshots/${prefix}-${r.name}.png`;
    await page.screenshot({ path: file });
    results.shots.push(file);
  }
  await ctx.close();
}

// Discover a real property-detail URL from the listing page.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/properties", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  results.detail = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/properties/"]') || document.querySelector('a[href^="/file/"]');
    return a ? a.getAttribute("href") : null;
  });
  await ctx.close();
}
const detail = results.detail || "/properties";

await capture({ viewport: { width: 1440, height: 900 } }, "d", [
  { name: "home", route: "/" },
  { name: "home-mid", route: "/", scroll: 1500 },
  { name: "properties", route: "/properties" },
  { name: "detail", route: detail },
  { name: "admin", route: "/admin" },
  { name: "tracking", route: "/tracking" },
]);

await capture(
  { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  "m",
  [
    { name: "home", route: "/" },
    { name: "properties", route: "/properties" },
    { name: "detail", route: detail },
    { name: "admin", route: "/admin" },
  ],
);

writeFileSync("screenshots/retheme-qa.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
