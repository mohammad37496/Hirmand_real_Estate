/**
 * Resolve Postgres URLs from Neon / Vercel env names.
 * Runtime prefers pooled endpoints; migrations prefer direct/unpooled.
 */

const POOLED_KEYS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
];

/**
 * @param {string[]} keys
 * @param {Record<string, string | undefined>} env
 * @returns {{ key: string | null, url: string | undefined }}
 */
function firstEnv(keys, env) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, url: value };
  }
  return { key: null, url: undefined };
}

/** Best URL for app queries (connection pooling). */
export function resolveDatabaseUrl(env = process.env) {
  const pooled = firstEnv(POOLED_KEYS, env);
  if (pooled.url) return pooled;
  return firstEnv(
    ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"],
    env,
  );
}

/** Best URL for DDL / migrations (direct connection). */
export function resolveMigrationDatabaseUrl(env = process.env) {
  const unpooled = firstEnv(
    ["DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"],
    env,
  );
  if (unpooled.url) return unpooled;
  return resolveDatabaseUrl(env);
}

export function listDbRelatedEnvKeys(env = process.env) {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k))
    .sort();
}
