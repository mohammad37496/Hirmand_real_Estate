import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";

const shots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "screenshots/d-home.png",
      "screenshots/d-home-mid.png",
      "screenshots/d-properties.png",
      "screenshots/d-detail.png",
      "screenshots/d-tracking.png",
      "screenshots/d-admin.png",
      "screenshots/m-home.png",
      "screenshots/m-properties.png",
      "screenshots/m-detail.png",
      "screenshots/m-admin.png",
    ];

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto("about:blank");

let fail = 0;
console.log("file                       size    colors  dark%  light%  meanL  verdict");
console.log("-".repeat(84));

for (const f of shots) {
  if (!existsSync(f)) {
    console.log(`${f.padEnd(26)} MISSING`);
    fail++;
    continue;
  }
  const b64 = readFileSync(f).toString("base64");
  const r = await page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = "data:image/png;base64," + data;
    });
    const scale = Math.min(1, 700 / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const colors = new Set();
    let dark = 0;
    let light = 0;
    let lum = 0;
    let n = 0;
    // row-wise variance => text/edges present
    let busyRows = 0;
    for (let y = 0; y < h; y++) {
      let rowMin = 255;
      let rowMax = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const R = px[i];
        const G = px[i + 1];
        const B = px[i + 2];
        const L = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
        colors.add(((R >> 4) << 8) | ((G >> 4) << 4) | (B >> 4));
        if (L < 0.15) dark++;
        if (L > 0.94) light++;
        lum += L;
        n++;
        if (L * 255 < rowMin) rowMin = L * 255;
        if (L * 255 > rowMax) rowMax = L * 255;
      }
      if (rowMax - rowMin > 40) busyRows++;
    }
    return {
      colors: colors.size,
      dark: (dark / n) * 100,
      light: (light / n) * 100,
      meanL: lum / n,
      busyRows,
      h,
      w,
      origW: img.width,
      origH: img.height,
    };
  }, b64);

  const blank = r.colors < 12 || r.busyRows < 3;
  if (blank) fail++;
  console.log(
    `${f.padEnd(26)} ${r.origW}x${r.origH}  ${String(r.colors).padStart(5)}  ${r.dark
      .toFixed(2)
      .padStart(5)}  ${r.light.toFixed(2).padStart(6)}  ${r.meanL.toFixed(2)}  ${
      blank ? "BLANK/UNIFORM  <-- PROBLEM" : "ok (busyRows=" + r.busyRows + ")"
    }`,
  );
}

console.log("\nblank/uniform shots:", fail);
await browser.close();
process.exit(fail ? 1 : 0);
