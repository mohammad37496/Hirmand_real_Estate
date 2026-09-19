#!/usr/bin/env node

import {
  resolveDatabaseUrl,
  resolveMigrationDatabaseUrl,
  listDbRelatedEnvKeys,
} from "./resolve-database-url.mjs";

const isVercel =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";

const runtime = resolveDatabaseUrl();
const migration = resolveMigrationDatabaseUrl();

if (runtime.url) {
  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = runtime.url;
  }
  console.log(`[deploy] Runtime DB via ${runtime.key}.`);
  if (migration.key && migration.key !== runtime.key) {
    console.log(`[deploy] Migrations will use ${migration.key} (direct/unpooled).`);
  }
  if (runtime.key && /UNPOOLED|NON_POOLING/i.test(runtime.key)) {
    console.warn(
      "[deploy] Only an unpooled URL is set. For better performance on Vercel, also add the Neon *pooled* connection as DATABASE_URL.",
    );
  }
} else if (isVercel) {
  const related = listDbRelatedEnvKeys();
  console.warn(
    "[deploy] WARNING: No database URL found (DATABASE_URL / POSTGRES_URL / …).",
  );
  console.warn(
    related.length
      ? `[deploy] Related env keys: ${related.join(", ")}`
      : "[deploy] No DATABASE/POSTGRES/NEON env keys on this build.",
  );
} else {
  console.log("[deploy] Local build: no DATABASE_URL (PGLite fallback OK).");
}

if (isVercel && !process.env.HIRMAND_ADMIN_KEY?.trim()) {
  console.warn(
    "[deploy] WARNING: HIRMAND_ADMIN_KEY not set — /admin will reject keys.",
  );
}

console.log(
  isVercel
    ? "[deploy] Vercel environment check finished."
    : "[deploy] Local build checks skipped.",
);
