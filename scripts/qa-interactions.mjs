import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const out = {};
const errors = [];

// Minimal valid silent WAV (0.2s, 8kHz mono 16-bit)
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

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        "hirmand-music-state",
        JSON.stringify({ index: 0, volume: 0.7, muted: false, shuffle: false, repeat: true }),
      );
    } catch {
      // Storage may be unavailable in the QA browser context.
    }
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => !String(e).includes("WebGL") && errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && !m.text().includes("Failed to load resource") && errors.push(m.text()));
  await page.route("**/api/music", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifest) }));
  page.route(/\/music\/qa-\d+\.mp3$/, (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", body: buf }));

  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Style assertions
  out.styles = await page.evaluate(() => {
    const gs = (sel, prop) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el)[prop] : null;
    };
    const first = (sel) => document.querySelector(sel);
    const specCard = first(".property-spec-grid > div") || first(".property-divar-specs > div");
    return {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      toolsActiveBg: gs(".tools-switch-btn.is-active", "backgroundImage") || gs(".tools-switch-btn.is-active", "backgroundColor"),
      specCardRadius: specCard ? getComputedStyle(specCard).borderRadius : null,
      playerPad: gs(".music-player", "paddingTop"),
      playerHeight: Math.round(document.querySelector(".music-player")?.getBoundingClientRect().height ?? 0),
      priceStrong: gs(".property-price-block > strong", "color"),
      teamSocialW: first(".team-social") ? Math.round(first(".team-social").getBoundingClientRect().width) : null,
      teamSocialFont: gs(".team-social", "fontSize"),
    };
  });

  // --- Interactive music player test ---
  const player = page.locator(".music-player").first();
  await player.scrollIntoViewIfNeeded();

  // 1. Play
  await page.locator(".music-play").click();
  await page.waitForTimeout(700);
  out.playingAfterClick = await page.evaluate(() => {
    const a = document.querySelector("audio");
    return { paused: a?.paused ?? null, t: a?.currentTime ?? null, dur: a?.duration ?? null };
  });

  // 2. Open playlist directly (compact dock keeps settings panel closed)
  await page.locator('.music-compact-actions button[title="فهرست"]').click();
  await page.waitForTimeout(500);
  out.playlistOpen = (await page.locator(".music-playlist").count()) > 0;
  out.playlistTracks = await page.locator(".music-track").count();
  await page.screenshot({ path: "screenshots/qa-player-playlist.png" });

  // 4. Select track 2
  await page.locator(".music-track").nth(1).click();
  await page.waitForTimeout(800);
  out.track2Selected = await page.evaluate(() => ({
    paused: document.querySelector("audio")?.paused ?? null,
    src: (document.querySelector("audio")?.currentSrc || "").split("/").pop(),
  }));

  // 5. Close playlist, verify compact single-row state (no error strip, progress merged)
  await page.locator('.music-compact-actions button[title="فهرست"]').click();
  await page.waitForTimeout(300);
  out.compactState = await page.evaluate(() => {
    const p = document.querySelector(".music-player");
    const err = p.querySelector(".music-player-error");
    const prog = p.querySelector(".music-progress-row");
    return {
      height: Math.round(p.getBoundingClientRect().height),
      errorVisible: err ? getComputedStyle(err).display !== "none" : false,
      progressAbs: prog ? getComputedStyle(prog).position : null,
    };
  });
  await page.screenshot({ path: "screenshots/qa-player-compact.png" });

  // 6. Hide and re-launch
  await page.locator('.music-compact-actions button[title="مخفی کردن"]').click();
  await page.waitForTimeout(300);
  out.hiddenLauncher = (await page.locator(".music-player-launcher.is-visible").count()) > 0;
  await page.locator(".music-player-launcher").click();
  await page.waitForTimeout(300);
  out.reShown = (await page.locator(".music-player:not(.is-hidden)").count()) > 0;

  await ctx.close();

  // --- Mobile: tap playlist + tools interaction ---
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mctx.addInitScript(() => {
    try {
      localStorage.setItem(
        "hirmand-music-state",
        JSON.stringify({ index: 0, volume: 0.7, muted: false, shuffle: false, repeat: true }),
      );
    } catch {
      // Storage may be unavailable in the QA browser context.
    }
  });
  const mp = await mctx.newPage();
  mp.on("pageerror", (e) => !String(e).includes("WebGL") && errors.push("m: " + String(e)));
  await mp.route("**/api/music", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifest) }));
  mp.route(/\/music\/qa-\d+\.mp3$/, (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", body: buf }));

  await mp.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 });
  await mp.waitForTimeout(1400);
  await mp.locator('.music-compact-actions button[title="فهرست"]').click();
  await mp.waitForTimeout(400);
  out.mobilePlaylist = (await mp.locator(".music-track").count()) > 0;
  await mp.locator(".music-track").nth(2).tap();
  await mp.waitForTimeout(500);
  out.mobileTrack3 = await mp.evaluate(() => ({
    src: (document.querySelector("audio")?.currentSrc || "").split("/").pop(),
  }));

  // Tools tab switch on mobile
  await mp.locator(".tools-switch-btn").nth(3).click();
  await mp.waitForTimeout(400);
  out.mobileLoanTab = await mp.evaluate(() => {
    const active = document.querySelector(".tools-switch-btn.is-active strong");
    const tabs = document.querySelectorAll(".commission-tab");
    return { active: active?.textContent ?? null, loanTabs: tabs.length };
  });
  await mp.screenshot({ path: "screenshots/qa-mobile-player-tools.png" });
  await mctx.close();

  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close();
}
