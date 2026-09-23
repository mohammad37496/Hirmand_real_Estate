import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Static counterpart to scripts/warm-audit.mjs: finds warm colour *literals* in
// the stylesheets so you can locate a stray brass/copper value before the
// browser ever renders it.
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync("src")
      .filter((f) => f.endsWith(".css"))
      .map((f) => path.join("src", f));

function hue(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  if (!d) return { h: 0, s: 0, l: (mx + mn) / 510 };
  let h;
  if (mx === r) h = 60 * (((g - b) / d) % 6);
  else if (mx === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  const l = (mx + mn) / 510;
  return { h, s: d / (255 - Math.abs(2 * l * 255 - 255)), l };
}
const isWarm = (r, g, b) => {
  const { h, s, l } = hue(r, g, b);
  return h >= 15 && h <= 75 && s > 0.18 && l > 0.18 && l < 0.95;
};

let grand = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const counts = new Map();
  for (const m of src.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    let h = m[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 8) h = h.slice(0, 6);
    if (h.length !== 6) continue;
    const tok = "#" + h.toLowerCase();
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  for (const m of src.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) {
    const tok = `rgb(${m[1]},${m[2]},${m[3]})`;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }

  const warmRows = [];
  for (const [tok, n] of counts) {
    let r, g, b;
    if (tok.startsWith("#")) {
      r = parseInt(tok.slice(1, 3), 16);
      g = parseInt(tok.slice(3, 5), 16);
      b = parseInt(tok.slice(5, 7), 16);
    } else {
      [r, g, b] = tok.match(/\d+/g).map(Number);
    }
    if (isWarm(r, g, b)) warmRows.push({ tok, n });
  }
  warmRows.sort((a, b) => b.n - a.n);
  const total = warmRows.reduce((s, x) => s + x.n, 0);
  grand += total;
  console.log(`\n### ${f}   warm distinct=${warmRows.length}  occurrences=${total}`);
  for (const x of warmRows) console.log(`  ${String(x.n).padStart(3)}x  ${x.tok}`);
}
console.log(`\nTOTAL warm occurrences: ${grand}`);
