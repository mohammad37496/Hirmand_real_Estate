#!/usr/bin/env node

import { resolveDatabaseUrl, listDbRelatedEnvKeys } from "./resolve-database-url.mjs";

const isVercel =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";

const { key, url: databaseUrl } = resolveDatabaseUrl();

if (databaseUrl) {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = databaseUrl;
  }
  console.log(`[deploy] Database URL found via ${key}.`);
} else if (isVercel) {
  const related = listDbRelatedEnvKeys();
  console.warn(
    "[deploy] WARNING: No database URL found. Checked DATABASE_URL, POSTGRES_URL, POSTGRES_PRISMA_URL, …",
  );
  console.warn(
    related.length
      ? `[deploy] Related env keys present: ${related.join(", ")}`
      : "[deploy] No DATABASE/POSTGRES/NEON env keys found on this build at all.",
  );
  console.warn(
    "[deploy] Site will build, but property listings /admin need a DB. Add DATABASE_URL in Vercel → Settings → Environment Variables (Production) and Redeploy.",
  );
} else {
  console.log("[deploy] Local build: no DATABASE_URL (PGLite fallback OK).");
}

if (isVercel && !process.env.HIRMAND_ADMIN_KEY?.trim()) {
  console.warn(
    "[deploy] WARNING: HIRMAND_ADMIN_KEY not set — /admin will reject all keys until you add it.",
  );
}

console.log(
  isVercel
    ? "[deploy] Vercel environment check finished."
    : "[deploy] Local build: Vercel-only environment checks skipped.",
);
