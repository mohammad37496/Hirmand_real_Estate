#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync } from "node:fs";
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

const sources = {
  "apartment": [
    "https://images.unsplash.com/photo-1781344334903-f33d8b76e292?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1771888703723-01d85da1dae1?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1774429076579-d90d43bffd3b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1766245456897-5c86726d084d?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ],
  "villa": [
    "https://images.unsplash.com/photo-1771371428960-35a50c2d4e7c?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783125127024-3f3eda015db4?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786204685672-e344095e5b49?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783125127199-860da9744dcc?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ],
  "office": [
    "https://images.unsplash.com/photo-1774953037913-af0cf688491a?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1767786330387-5cef0327b6c1?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1765371512971-9d4da531d004?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1782080163196-26ed8ea266d7?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ],
  "heritage": [
    "https://images.unsplash.com/photo-1780245989984-a178d6c54a7b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1782414720823-5966c6c24446?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783195269540-37d9a87b270b?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1783066232761-b68438c0d9a6?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ],
  "land": [
    "https://images.unsplash.com/photo-1781816927578-ec36210fede0?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1769961332176-3e88f410857d?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1779275397165-f8b00cc64818?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1779275397168-6f6fdf4fa8d6?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ],
  "commercial": [
    "https://images.unsplash.com/photo-1778034758869-75d25cd6e737?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786114604377-43f9636c3414?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1786456629213-d087d121044f?auto=format&fit=crop&fm=jpg&q=84&w=1600",
    "https://images.unsplash.com/photo-1778069982088-eb6605730a30?auto=format&fit=crop&fm=jpg&q=84&w=1600"
  ]
};

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
