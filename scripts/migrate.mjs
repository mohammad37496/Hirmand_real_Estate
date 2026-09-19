#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { resolveDatabaseUrl } from "./resolve-database-url.mjs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "./migration-plan.mjs";

const resolved = resolveDatabaseUrl();
const databaseUrl = resolved.url;
if (databaseUrl && !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = databaseUrl;
}
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] No migrations directory — nothing to apply.");
    return;
  }

  const files = {};
  for (const name of entries) {
    if (!name.endsWith(".sql")) continue;
    files[name] = await readFile(join(migrationsDir, name), "utf8");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const done = (
      await client.query("select name from _migrations")
    ).rows.map((r) => r.name);

    const pending = pendingMigrations(Object.keys(files).map((n) => `/migrations/${n}`), done);
    if (!pending.length) {
      console.log("[migrate] Schema up to date.");
      return;
    }

    for (const { name, path } of pending) {
      const fileName = path.split("/").pop();
      const sql = files[fileName];
      if (!sql) {
        console.warn(`[migrate] Missing SQL for ${name}, skip`);
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [name]);
        await client.query("commit");
        console.log(`[migrate] Applied ${name}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
