import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { pendingMigrations } from "../scripts/migration-plan.mjs";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function runMigrations({ connectionString }) {
  const entries = await readdir(MIGRATIONS_DIR);
  const appliedRows = await (async () => {
    const pool = new pg.Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: Number(process.env.DB_MIGRATION_CONNECT_TIMEOUT_MS ?? 5000),
    });
    const client = await pool.connect();
    try {
      await client.query(
        "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
      );
      const { rows } = await client.query("SELECT name FROM _migrations");
      return rows.map((row) => String(row.name));
    } finally {
      client.release();
      await pool.end();
    }
  })();

  const pending = pendingMigrations(entries, appliedRows);
  if (pending.length === 0) {
    console.log("[migrate] database is up to date.");
    return;
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: Number(process.env.DB_MIGRATION_CONNECT_TIMEOUT_MS ?? 5000),
  });
  const client = await pool.connect();

  try {
    for (const { name } of pending) {
      let source;
      try {
        source = await readFile(join(MIGRATIONS_DIR, name), "utf8");
      } catch {
        console.error(`[migrate] migration file not found: ${name}`);
        continue;
      }

      console.log(`[migrate] applying ${name}`);
      await client.query("BEGIN");
      try {
        await client.query(source);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`[migrate] failed ${name}`);
        if (error && typeof error === "object") {
          for (const key of ["code", "detail", "hint", "position", "routine", "severity"]) {
            const value = error[key];
            if (value != null) console.error(`[migrate]   ${key}: ${value}`);
          }
        }
        throw error;
      }
    }
    console.log("[migrate] database is up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}
