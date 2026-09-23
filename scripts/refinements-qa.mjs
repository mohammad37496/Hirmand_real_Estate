import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:8080";
mkdirSync("screenshots", { recursive: true });

const MUSIC_STUB = (page) => {
  // A minimal valid silent WAV (0.2s, 8kHz mono 16-bit) so the player reports a real duration.
  const sampleRate = 8000;
  const samples = 1600;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  const manifest = {
    tracks: [
      { id: "t1", title: "آهنگ نمونه یک", artist: "هیرمند", src: "/music/qa-1.mp3" },
      { id: "t2", title: "آهنگ نمونه دو", artist: "هیرمند", src: "/music/qa-2.mp3" },
      { id: "t3", title: "آهنگ نمونه سه", artist: "هیرمند", src: "/music/qa-3.mp3" },
    ],
  };
  page.route("**/api/music", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifest) }),
  );
  page.route(/\/music\/qa-\d+\.mp3$/, (route) =>
    route.fulfill({ status: 200, contentType: "audio/mpeg", body: buf }),
  );
};

const results = { desktop: {}, mobile: {}, errors: [] };
const browser = await chromium.launch();
try {
  // ---------- Desktop ----------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on("pageerror", (e) => results.errors.push("pageerror: " + String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
      results.errors.push("console: " + m.text());
    }
  });

  await MUSIC_STUB(page);

  // Home: tools + team + footer + music player
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1200);

  const musicVisible = await page.locator(".music-player:not(.music-player-empty)").count();
  results.desktop.musicPlayerRendered = musicVisible > 0;
  if (musicVisible) {
    const box = await page.locator(".music-player").boundingBox();
    results.desktop.musicPlayerSize = { w: Math.round(box.width), h: Math.round(box.height) };
    const compactButtons = await page.locator(".music-transport button").evaluateAll((els) =>
      els.map((el) => ({ w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height })),
    );
    results.desktop.musicTransportButtons = compactButtons;
    await page.locator("#music-screenshot-anchor").scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: "screenshots/qa-desktop-music.png" });
  }

  // Tools section
  const tools = page.locator(".tools-wrap");
  results.desktop.toolsRendered = (await tools.count()) > 0;
  if (results.desktop.toolsRendered) {
    await tools.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/qa-desktop-tools.png" });
    // switch to deposit calculator
    await page.locator(".tools-switch-btn").nth(2).click();
    await page.waitForTimeout(400);
    await page.locator(".commission-fields input").first().fill("500000000");
    await page.waitForTimeout(400);
    const resultRows = await page.locator(".commission-rows li").count();
    results.desktop.depositResultRows = resultRows;
    await page.screenshot({ path: "screenshots/qa-desktop-tools-deposit.png" });
  }

  // Team socials: icon only?
  const teamSocialSpans = await page.locator(".team-social span").count();
  results.desktop.teamSocialLabels = teamSocialSpans;
  const socialLinkText = await page.locator(".social-link strong, .social-link small").count();
  results.desktop.contactSocialLabels = socialLinkText;
  if (results.desktop.teamSocialLabels === 0) {
    const team = page.locator("#team");
    await team.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/qa-desktop-team.png" });
  }

  // Footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/qa-desktop-footer.png" });

  // Property detail — get a slug from /properties links
  await page.goto(BASE + "/properties", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const detailHref = await page.evaluate(() => {
    const a = document.querySelector('a[href^="/file/"], a[href^="/properties/"]');
    return a ? a.getAttribute("href") : null;
  });
  if (detailHref) {
    await page.goto(BASE + detailHref, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1000);
    const specCount = await page.locator(".property-divar-specs .property-spec-grid > div, .property-spec-grid > div").count();
    results.desktop.detailSlug = detailHref;
    results.desktop.specCount = specCount;
    await page.screenshot({ path: "screenshots/qa-desktop-detail-top.png" });
    await page.locator(".property-divar-specs, .property-spec-grid").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/qa-desktop-detail-specs.png" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.screenshot({ path: "screenshots/qa-desktop-detail-bottom.png" });
  } else {
    results.desktop.detailSlug = null;
  }

  // Red audit on desktop
  const redAudit = await page.evaluate(() => {
    const reds = new Set();
    const isReddish = (r, g, b) => r > 100 && r > g * 1.45 && r > b * 1.45 && !(g > 60 && b > 60);
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      for (const prop of ["color", "backgroundColor", "borderTopColor"]) {
        const m = cs[prop] && cs[prop].match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (m) {
          const a = m[4] === undefined ? 1 : parseFloat(m[4]);
          if (a === 0) continue;
          if (isReddish(+m[1], +m[2], +m[3])) {
            reds.add(`${prop}:${cs[prop]} on ${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`);
          }
        }
      }
    }
    return Array.from(reds).slice(0, 12);
  });
  results.desktop.redElements = redAudit;

  await desktop.close();

  // ---------- Mobile ----------
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const mpage = await mobile.newPage();
  mpage.on("pageerror", (e) => results.errors.push("m pageerror: " + String(e)));
  mpage.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource")) {
      results.errors.push("m console: " + m.text());
    }
  });
  await MUSIC_STUB(mpage);

  await mpage.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await mpage.waitForTimeout(1200);
  results.mobile.musicPlayerRendered = (await mpage.locator(".music-player:not(.music-player-empty)").count()) > 0;
  await mpage.screenshot({ path: "screenshots/qa-mobile-home-top.png" });

  const toolsM = mpage.locator(".tools-wrap");
  if ((await toolsM.count()) > 0) {
    await toolsM.scrollIntoViewIfNeeded();
    await mpage.waitForTimeout(400);
    const overflowTools = await mpage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    results.mobile.toolsOverflow = overflowTools;
    await mpage.screenshot({ path: "screenshots/qa-mobile-tools.png" });
    await mpage.locator(".tools-switch-btn").nth(1).click();
    await mpage.waitForTimeout(400);
    await mpage.screenshot({ path: "screenshots/qa-mobile-tools-commission.png" });
  }

  const team = mpage.locator("#team");
  if ((await team.count()) > 0) {
    await team.scrollIntoViewIfNeeded();
    await mpage.waitForTimeout(400);
    results.mobile.teamSocialLabels = await mpage.locator(".team-social span").count();
    await mpage.screenshot({ path: "screenshots/qa-mobile-team.png" });
  }

  if (results.desktop.detailSlug) {
    await mpage.goto(BASE + results.desktop.detailSlug, { waitUntil: "networkidle", timeout: 60000 });
    await mpage.waitForTimeout(1000);
    await mpage.screenshot({ path: "screenshots/qa-mobile-detail-top.png" });
    await mpage.locator(".property-divar-specs, .property-spec-grid").first().scrollIntoViewIfNeeded().catch(() => {});
    await mpage.waitForTimeout(400);
    await mpage.screenshot({ path: "screenshots/qa-mobile-detail-specs.png" });
    const overflowDetail = await mpage.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    results.mobile.detailOverflow = overflowDetail;
  }

  // Music dock on mobile
  if (results.mobile.musicPlayerRendered) {
    const mbox = await mpage.locator(".music-player").boundingBox();
    results.mobile.musicPlayerBox = mbox ? { w: Math.round(mbox.width), h: Math.round(mbox.height), y: Math.round(mbox.y) } : null;
  }

  await mobile.close();

  // Save and print
  writeFileSync("screenshots/qa-refinements.json", JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
