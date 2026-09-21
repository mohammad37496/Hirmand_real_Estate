/**
 * Deploy-time database migrator (node-postgres, pg).
 * Prefers DATABASE_URL_UNPOOLED for DDL when available (Neon best practice).
 */
import {
  resolveMigrationDatabaseUrl,
  sanitizePostgresConnectionString,
} from "./resolve-database-url.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const resolved = resolveMigrationDatabaseUrl();
const databaseUrl = resolved.url
  ? sanitizePostgresConnectionString(resolved.url)
  : undefined;

if (databaseUrl) {
  const masked = databaseUrl.replace(/:[^:@]+@/, ":***@");
  console.log("[migrate] using " + resolved.key + " → " + masked);
}

if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const migrationFiles = Object.entries(
  import.meta.glob("../migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
).sort(([a], [b]) => a.localeCompare(b));

async function main() {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );

    const { rows: done } = await client.query("SELECT name FROM _migrations");
    const doneSet = new Set(done.map((row) => row.name));

    for (const [path, source] of migrationFiles) {
      const name = path.split("/").at(-1) ?? path;
      if (doneSet.has(name)) continue;

      console.log("[migrate] applying " + name);
      try {
        await client.query(source);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
      } catch (error) {
        console.error("[migrate] failed " + name);
        if (error && typeof error === "object") {
          const err = error;
          for (const key of [
            "code",
            "detail",
            "hint",
            "position",
            "routine",
            "severity",
          ]) {
            if (err[key] != null) console.error("[migrate]   " + key + ": " + err[key]);
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

await main();
