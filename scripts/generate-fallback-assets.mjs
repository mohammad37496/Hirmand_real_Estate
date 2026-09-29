#!/usr/bin/env node

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "public", "images", "fallback");
const manifestPath = join(root, "scripts", "fallback-source-images.json");
const sources = JSON.parse(await readFile(manifestPath, "utf8"));
const forceRefresh = process.env.FORCE_FALLBACK_IMAGE_REFRESH === "1";

async function download(url, output) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Hirmand-Real-Estate-fallback-assets/2.0",
      accept: "image/jpeg,image/*;q=0.8",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  }

  await pipeline(response.body, createWriteStream(output));
}

async function main() {
  mkdirSync(outputDir, { recursive: true });

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const [type, urls] of Object.entries(sources)) {
    for (let index = 0; index < urls.length; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      const output = join(outputDir, `${type}-${number}.jpg`);

      if (!forceRefresh && existsSync(output)) {
        skipped += 1;
        continue;
      }

      try {
        console.log(`[fallback-assets] downloading ${type}-${number}`);
        await download(urls[index], output);
        success += 1;
      } catch (error) {
        failed += 1;
        console.warn(
          `[fallback-assets] skipped ${type}-${number}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  console.log(
    `[fallback-assets] ready: ${success} downloaded, ${skipped} cached, ${failed} unavailable.`,
  );
}

main().catch((error) => {
  console.error("[fallback-assets] generator failed:", error);
  process.exitCode = 0;
});
