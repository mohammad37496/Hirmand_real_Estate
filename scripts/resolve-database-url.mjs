/**
 * Resolve a Postgres connection string from common env names used by
 * Neon, Vercel Storage, and manual setup.
 */
export function resolveDatabaseUrl(env = process.env) {
  const keys = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "NEON_DATABASE_URL",
  ];
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return { key, url: value };
  }
  return { key: null, url: undefined };
}

export function listDbRelatedEnvKeys(env = process.env) {
  return Object.keys(env)
    .filter((k) => /DATABASE|POSTGRES|NEON|PG/i.test(k))
    .sort();
}
