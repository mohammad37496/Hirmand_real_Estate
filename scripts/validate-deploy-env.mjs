#!/usr/bin/env node

const isVercel =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";

const databaseUrl = process.env.DATABASE_URL?.trim();

if (isVercel && !databaseUrl) {
  console.error(
    "[deploy] DATABASE_URL is required on Vercel. Add a PostgreSQL/Neon connection string in Project Settings > Environment Variables, then redeploy.",
  );
  process.exit(1);
}

if (isVercel && !process.env.HIRMAND_ADMIN_KEY?.trim()) {
  console.error(
    "[deploy] HIRMAND_ADMIN_KEY is required on Vercel so the /admin property manager can be used safely.",
  );
  process.exit(1);
}

console.log(
  isVercel
    ? "[deploy] Vercel environment validated: persistent database + admin key configured."
    : "[deploy] Local build: Vercel-only environment checks skipped.",
);
