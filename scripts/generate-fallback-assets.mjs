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
let imageMagickBin = null;
let ffmpegBin = null;

async function run(command, args) {
  await execFileAsync(command, args, { cwd: root, maxBuffer: 1024 * 1024 * 2 });
}

async function assertCodecs() {
  for (const candidate of ["magick", "convert"]) {
    try {
      await run(candidate, ["-version"]);
      imageMagickBin = candidate;
      break;
    } catch {
      // Try the next executable.
    }
  }

  if (!imageMagickBin) {
    throw new Error("ImageMagick is required to generate WebP fallback assets.");
  }

  const { stdout } = await execFileAsync(imageMagickBin, ["-list", "format"]);
  if (!/WEBP.*RW/i.test(stdout)) {
    throw new Error("The installed ImageMagick build does not provide WebP read/write support.");
  }

  try {
    await run("ffmpeg", ["-version"]);
    ffmpegBin = "ffmpeg";
  } catch {
    throw new Error("FFmpeg with libaom-av1 is required to generate AVIF fallback assets.");
  }

  const { stdout: encoders } = await execFileAsync(ffmpegBin, ["-hide_banner", "-encoders"]);
  if (!/libaom-av1/.test(encoders)) {
    throw new Error("The installed FFmpeg build does not provide the libaom-av1 encoder.");
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

      await run(imageMagickBin, [
        source,
        "-auto-orient",
        "-resize",
        "1600x1600>",
        "-strip",
        "-quality",
        "82",
        webp,
      ]);

      await run(ffmpegBin, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source,
        "-frames:v",
        "1",
        "-c:v",
        "libaom-av1",
        "-crf",
        "34",
        "-b:v",
        "0",
        "-still-picture",
        "1",
        "-pix_fmt",
        "yuv420p",
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
