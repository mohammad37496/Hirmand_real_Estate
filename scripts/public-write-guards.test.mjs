import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const leadsRoute = await readFile(
  new URL("../server/routes/api/leads.post.ts", import.meta.url),
  "utf8",
);
const reportsRoute = await readFile(
  new URL("../server/routes/api/property-reports.post.ts", import.meta.url),
  "utf8",
);
const shortlistRoute = await readFile(
  new URL("../server/routes/api/shared-shortlist.post.ts", import.meta.url),
  "utf8",
);
const publicLeadActionsRoute = await readFile(
  new URL("../server/routes/api/public-lead-actions.post.ts", import.meta.url),
  "utf8",
);

test("public lead intake checks origin and applies a rate limit before parsing or writing", () => {
  assert.match(leadsRoute, /assertSameOrigin\(event\)/);
  assert.match(leadsRoute, /consumeAdminAttempt\(["']public-lead:["']\s*\+\s*clientFingerprint\(event\)\)/);

  const throttleIndex = leadsRoute.indexOf('consumeAdminAttempt("public-lead:"');
  const bodyParseIndex = leadsRoute.indexOf("schema.safeParse(await readBody(event))");
  assert.ok(throttleIndex >= 0 && bodyParseIndex > throttleIndex);
});

test("public property reports check origin and apply a rate limit before database writes", () => {
  assert.match(reportsRoute, /assertSameOrigin\(event\)/);
  assert.match(reportsRoute, /consumeAdminAttempt\(["']property-report:["']\s*\+\s*clientFingerprint\(event\)\)/);

  const publicBranchIndex = reportsRoute.indexOf("if (!wantsAdmin)");
  const throttleIndex = reportsRoute.indexOf('consumeAdminAttempt("property-report:"');
  const payloadParseIndex = reportsRoute.indexOf("publicSchema.safeParse(body)");
  assert.ok(publicBranchIndex >= 0 && throttleIndex > publicBranchIndex);
  assert.ok(payloadParseIndex > throttleIndex);
});

test("shared-shortlist creation checks origin and rate-limits writes before database access", () => {
  assert.match(shortlistRoute, /assertSameOrigin\\(event\\)/);
  assert.match(shortlistRoute, /consumeAdminAttempt\\(["']shared-shortlist:["']\\s*\\+\\s*clientFingerprint\\(event\\)\\)/);
  const throttleIndex = shortlistRoute.indexOf('consumeAdminAttempt("shared-shortlist:"');
  const parseIndex = shortlistRoute.indexOf("schema.safeParse(await readBody(event))");
  assert.ok(throttleIndex >= 0 && parseIndex > throttleIndex);
});

test("public lead actions check origin and rate-limit capability-token operations", () => {
  assert.match(publicLeadActionsRoute, /assertSameOrigin\\(event\\)/);
  assert.match(publicLeadActionsRoute, /consumeAdminAttempt\\(["']public-lead-action:["']\\s*\\+\\s*clientFingerprint\\(event\\)\\)/);
  const throttleIndex = publicLeadActionsRoute.indexOf('consumeAdminAttempt("public-lead-action:"');
  const databaseCheckIndex = publicLeadActionsRoute.indexOf('dbSource === "unconfigured"');
  assert.ok(throttleIndex >= 0 && databaseCheckIndex > throttleIndex);
});
