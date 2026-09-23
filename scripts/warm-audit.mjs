import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("screenshots", { recursive: true });

function auditWarm() {
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || "");
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).map((x) => parseFloat(x)).filter((n) => !Number.isNaN(n));
    if (p.length < 3) return null;
    const alpha = p.length > 3 ? p[3] : 1;
    return [p[0], p[1], p[2], alpha];
  };
  const hueOf = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l: (max + min) / 255 / 2 };
    let h;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    const l = (max + min) / 2 / 255;
    const s = d / (255 - Math.abs(2 * l * 255 - 255));
    return { h, s, l };
  };
  const isWarm = (rgb) => {
    const { h, s, l } = hueOf(rgb[0], rgb[1], rgb[2]);
    return h >= 15 && h <= 75 && s > 0.18 && l > 0.18 && l < 0.95;
  };

  const hits = {};
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    for (const prop of ["color", "backgroundColor", "borderTopColor", "borderBottomColor"]) {
      const rgb = parse(cs[prop]);
      if (!rgb) continue;
      if (prop === "backgroundColor" && rgb[3] === 0) continue;
      if (!isWarm(rgb)) continue;
      const key = cs[prop].replace(/\s+/g, " ").trim() + "  |  " + prop;
      if (!hits[key]) hits[key] = { count: 0, samples: [] };
      hits[key].count++;
      if (hits[key].samples.length < 5) {
        const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
        hits[key].samples.push(el.tagName.toLowerCase() + cls);
      }
    }
  }
  return hits;
}

const out = { routes: [], errors: [] };
const browser = await chromium.launch();

async function run(prefix, ctxOpts, routes) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    const s = String(e);
    if (!/webgl/i.test(s)) out.errors.push(prefix + " pageerror: " + s);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !/webgl/i.test(m.text()) && !m.text().includes("Failed to load resource"))
      out.errors.push(prefix + " console: " + m.text());
  });
  for (const r of routes) {
    const e = { prefix, name: r.name, route: r.route };
    try {
      await page.goto(BASE + r.route, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(900);
      if (r.scroll) {
        await page.evaluate((y) => window.scrollTo(0, y), r.scroll);
        await page.waitForTimeout(600);
      }
      e.warm = await page.evaluate(auditWarm);
    } catch (err) {
      e.error = err.message;
    }
    out.routes.push(e);
  }
  await ctx.close();
}

await run("d", { viewport: { width: 1440, height: 900 } }, [
  { name: "home", route: "/" },
  { name: "home-mid", route: "/", scroll: 1500 },
  { name: "home-low", route: "/", scroll: 6000 },
  { name: "home-bottom", route: "/", scroll: 12000 },
  { name: "properties", route: "/properties" },
  { name: "detail", route: "/file/qa-refine-0001" },
  { name: "tracking", route: "/tracking" },
  { name: "admin", route: "/admin" },
]);
await run("m", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, [
  { name: "home", route: "/" },
  { name: "properties", route: "/properties" },
  { name: "detail", route: "/file/qa-refine-0001" },
  { name: "admin", route: "/admin" },
]);

writeFileSync("screenshots/warm-audit.json", JSON.stringify(out, null, 2));

for (const r of out.routes) {
  const keys = r.warm ? Object.keys(r.warm) : [];
  console.log(`\n=== ${r.prefix}-${r.name} ${r.route}  warmKinds=${keys.length}`);
  for (const k of keys.sort((a, b) => r.warm[b].count - r.warm[a].count)) {
    const w = r.warm[k];
    console.log(`  ${String(w.count).padStart(4)}x  ${k}\n        e.g. ${w.samples.join(", ")}`);
  }
  if (r.error) console.log("  ERROR " + r.error);
}
console.log("\nnon-webgl errors:", out.errors.length, JSON.stringify(out.errors));
await browser.close();
