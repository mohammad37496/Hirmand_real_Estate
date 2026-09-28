#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, "public", "images", "fallback");
const tmpDir = join(root, ".fallback-image-tmp");

const manifestPath = join(root, "scripts", "fallback-source-images.json");
const sources = JSON.parse(readFileSync(manifestPath, "utf8"));

const generatedFiles = [];

async function run(command, args) {
  await execFileAsync(command, args, { cwd: root, maxBuffer: 1024 * 1024 * 2 });
}

async function assertCodecs() {
  try {
    await run("magick", ["-version"]);
  } catch {
    throw new Error("ImageMagick is required to generate fallback assets.");
  }

  const { stdout } = await execFileAsync("magick", ["-list", "format"]);
  if (!/AVIF.*RW/i.test(stdout)) {
    throw new Error("The installed ImageMagick build does not provide AVIF read/write support.");
  }
  if (!/WEBP.*RW/i.test(stdout)) {
    throw new Error("The installed ImageMagick build does not provide WebP read/write support.");
  }
}

async function download(url, output) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Hirmand-Real-Estate-fallback-assets/1.0",
      accept: "image/avif,image/webp,image/jpeg,image/*;q=0.8",
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Image download failed (${response.status}): ${url}`);
  }
  await pipeline(response.body, createWriteStream(output));
}

async function main() {
  const forceRefresh = process.env.FORCE_FALLBACK_IMAGE_REFRESH === "1";
  const expectedFiles = Object.entries(sources).flatMap(([type, urls]) =>
    urls.flatMap((_, index) => {
      const number = String(index + 1).padStart(2, "0");
      const base = `${type}-${number}`;
      return [
        join(outputDir, `${base}.webp`),
        join(outputDir, `${base}.avif`),
      ];
    }),
  );

  if (!forceRefresh && expectedFiles.every((file) => existsSync(file))) {
    console.log("Self-hosted fallback assets are already present; skipping regeneration.");
    return;
  }

  await assertCodecs();
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  for (const [type, urls] of Object.entries(sources)) {
    for (let index = 0; index < urls.length; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      const base = `${type}-${number}`;
      const source = join(tmpDir, `${base}.jpg`);
      const webp = join(outputDir, `${base}.webp`);
      const avif = join(outputDir, `${base}.avif`);

      console.log(`Preparing ${base}`);
      await download(urls[index], source);

      await run("magick", [
        source,
        "-auto-orient",
        "-resize",
        "1600x1600>",
        "-strip",
        "-quality",
        "82",
        webp,
      ]);

      await run("magick", [
        source,
        "-auto-orient",
        "-resize",
        "1600x1600>",
        "-strip",
        "-quality",
        "55",
        "-define",
        "heic:speed=6",
        avif,
      ]);

      generatedFiles.push(webp, avif);
      rmSync(source, { force: true });
    }
  }

  rmSync(tmpDir, { recursive: true, force: true });

  for (const file of generatedFiles) {
    if (!existsSync(file)) throw new Error(`Expected generated asset is missing: ${file}`);
  }

  console.log(`Generated ${generatedFiles.length} self-hosted fallback assets.`);
}

main().catch((error) => {
  console.error(error);
  rmSync(tmpDir, { recursive: true, force: true });
  process.exitCode = 1;
});
