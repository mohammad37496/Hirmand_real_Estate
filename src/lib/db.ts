import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type DbSource = "neon" | "pglite" | "unconfigured";

/** Prefer pooled Neon/Vercel URLs for runtime queries. */
function resolveDatabaseUrlFromEnv(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const pooled = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "NEON_DATABASE_URL",
  ] as const;
  const unpooled = ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"] as const;
  for (const key of pooled) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  for (const key of unpooled) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

const databaseUrl = resolveDatabaseUrlFromEnv();

const isVercelRuntime =
  typeof process !== "undefined" &&
  (process.env.VERCEL === "1" || process.env.VERCEL === "true");

export const dbSource: DbSource = databaseUrl
  ? "neon"
  : isVercelRuntime
    ? "unconfigured"
    : "pglite";

export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

function toSql(run: Run): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) {
      text += "$" + String(i + 1) + strings[i + 1];
    }
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  return sql;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({
      connectionString: databaseUrl!,
      // Keep the timeout client-side so Neon pooled connections receive no unsupported startup parameters.
      query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 8_000),
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS ?? 10_000),
      connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECT_MS ?? 8_000),
      allowExitOnIdle: true,
      application_name: "hirmand-real-estate",
    });
    pool.on("error", (err) => {
      console.error("[db] idle client error", err.message);
    });
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite, MemoryFS } = await import("@electric-sql/pglite");
    const configuredDataDir = process.env.PGLITE_DATA_DIR?.trim();
    const dataDir =
      configuredDataDir ||
      (process.env.CI === "true" || process.env.NODE_ENV === "production"
        ? "memory://"
        : ".grok/pglite.data");

    if (!dataDir.startsWith("memory://") && !dataDir.startsWith("idb://")) {
      mkdirSync(dirname(resolve(process.cwd(), dataDir)), { recursive: true });
    }

    const pg =
      dataDir === "memory://"
        ? new PGlite({
            fs: new MemoryFS(),
            parsers: {
              [OID_INT8]: Number,
              [OID_DATE]: identity,
              [OID_INTERVAL]: identity,
            },
          })
        : new PGlite({
            dataDir,
            parsers: {
              [OID_INT8]: Number,
              [OID_DATE]: identity,
              [OID_INTERVAL]: identity,
            },
          });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>("select name from _migrations");
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined)
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(async <T>(text: string, params: unknown[]) => {
    const result = await pg.query<T>(text, params);
    return result.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler or a server route loader, never from client code.",
    );
  }
  if (dbSource === "neon") return createNeonSql();
  if (dbSource === "pglite") return createPgliteSql();
  throw new Error(
    "DATABASE_URL تنظیم نشده است. برای اجرای نسخه Vercel باید یک PostgreSQL/Neon DATABASE_URL در Environment Variables پروژه تنظیم شود.",
  );
}

export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}

export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}
