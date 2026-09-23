import { chromium } from "playwright";

// Point at the dev server by default; set QA_BASE to audit the built preview.
const BASE = process.env.QA_BASE || "http://127.0.0.1:8080";
const browser = await chromium.launch();

const isWarm = (s) => {
  const m = /rgba?\(([^)]+)\)/.exec(s || "");
  if (!m) return false;
  const p = m[1].split(/[,\s/]+/).map(Number).filter((n) => !Number.isNaN(n));
  if (p.length < 3) return false;
  return p[0] > p[2] && p[0] - p[2] >= 8;
};

async function probe(page, sel, action, label) {
  const el = page.locator(sel).first();
  if ((await el.count()) === 0) return null;
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 4000 });
    if (action === "hover") await el.hover({ timeout: 4000 });
    else await el.focus({ timeout: 4000 });
    await page.waitForTimeout(180);
    const r = await el.evaluate((e) => {
      const cs = getComputedStyle(e);
      return {
        color: cs.color,
        background: cs.backgroundColor,
        borderTop: cs.borderTopColor,
        outline: cs.outlineColor + " " + cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    });
    const bad = Object.entries(r).filter(([, v]) => isWarm(v) || (typeof v === "string" && /201,\s*162,\s*74|218,\s*181,\s*92|138,\s*94,\s*20|192,\s*138,\s*42|226,\s*196,\s*140|240,\s*217,\s*173/.test(v)));
    if (bad.length) return `${label} [${sel}] -> ` + bad.map(([k, v]) => `${k}: ${v}`).join(" | ");
    return null;
  } catch (e) {
    return `${label} [${sel}] ERROR ${e.message.split("\n")[0]}`;
  }
}

const routes = ["/", "/properties", "/file/qa-refine-0001", "/tracking"];
const hovers = [".btn-gold", ".btn-ghost", ".property-card", ".team-social", ".footer-social-chip", ".properties-filter-chip"];
const focuses = ["input", "select", ".hero-search select", ".btn-gold", "a.btn-gold"];

let issues = [];

for (const vp of [
  { name: "desktop", opts: { viewport: { width: 1440, height: 900 } } },
  { name: "mobile", opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
]) {
  const ctx = await browser.newContext(vp.opts);
  const page = await ctx.newPage();
  for (const route of routes) {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    for (const sel of hovers) {
      const r = await probe(page, sel, "hover", `${vp.name} ${route} hover`);
      if (r) issues.push(r);
    }
    // Fly-out menu links sit under an overlay, so real hover never lands on
    // them. Force the pseudo-state through CDP instead — that is the only way
    // to read `:hover` / `:focus-visible` styles on these reliably.
    for (const sel of [".mobile-menu a", ".mobile-menu button"]) {
      try {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
        if (!nodeId) continue;
        for (const state of ["hover", "focus-visible"]) {
          await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: state === "hover" ? ["hover"] : ["focus", "focus-visible"] });
          const r = await page.evaluate((s) => {
            const e = document.querySelector(s);
            if (!e) return null;
            const cs = getComputedStyle(e);
            return { color: cs.color, background: cs.backgroundColor, borderTop: cs.borderTopColor, outline: cs.outlineColor };
          }, sel);
          const bad = Object.entries(r || {}).filter(([, v]) => isWarm(v));
          if (bad.length) issues.push(`${vp.name} ${route} menu:${state} [${sel}] -> ` + bad.map(([k, v]) => `${k}: ${v}`).join(" | "));
          await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
        }
        await cdp.detach();
      } catch {
        /* menu absent on this breakpoint — fine */
      }
    }

    for (const sel of focuses) {
      const r = await probe(page, sel, "focus", `${vp.name} ${route} focus`);
      if (r) issues.push(r);
    }
  }
  await ctx.close();
}

console.log(issues.length ? issues.join("\n") : "no warm colours found in hover/focus states");
console.log("\ntotal issues:", issues.length);
await browser.close();
