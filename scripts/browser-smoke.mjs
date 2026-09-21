#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";
import { computeBrandWarnings } from "./brand-check.mjs";
import {
  authInvariantWarnings,
  buildAuthEnabled,
  compareAuthInvariant,
  probeDevAuthEnabled,
} from "./check-auth-invariant.mjs";
import {
  baselineComparison,
  bodyTextPrefix,
  derivedPaths,
  exitCodeFor,
  normalizeBodyText,
  normalizedBodyTextHash,
  parseSmokeArgs,
} from "./browser-smoke-verdict.mjs";

const args = parseSmokeArgs(process.argv.slice(2), process.env);
if (args.error) {
  console.error(JSON.stringify({ ok: false, error: args.error }, null, 2));
  process.exit(1);
}

const url = checkedUrl(args.url);
const outPng = checkedOutputPath(args.outPng, ["/workspace"]);
const derived = derivedPaths(outPng);
const mobilePng = checkedOutputPath(derived.mobilePng, ["/workspace"]);
const outJson = checkedOutputPath(derived.verdictJson, ["/workspace"], "verdict JSON");

const MAX_BASELINE_BYTES = 1024 * 1024;
const baselineRequested = Boolean(args.baseline);
let baselinePath = null;
let baselineResolveError = null;
if (baselineRequested) {
  try {
    baselinePath = checkedOutputPath(realpathSync(args.baseline), ["/workspace"], "baseline");
  } catch (err) {
    baselineResolveError = err?.code ?? "unresolvable path";
  }
  if (baselinePath === outJson) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error:
            `--baseline ${args.baseline} is this run's own verdict output; ` +
            "pass a distinct output PNG (e.g. app-builder-built.png) so the baseline is not overwritten",
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800, screenshot: outPng },
  { name: "mobile", width: 390, height: 844, screenshot: mobilePng },
];

mkdirSync(dirname(outPng), { recursive: true });

function compareAgainstBaseline(verdict) {
  if (!baselinePath) {
    return {
      divergesFromBaseline: true,
      reasons: [`baseline unreadable: ${baselineResolveError ?? "unresolvable path"}`],
    };
  }
  try {
    if (statSync(baselinePath).size > MAX_BASELINE_BYTES) {
      return { divergesFromBaseline: true, reasons: ["baseline unreadable: too large"] };
    }
    return baselineComparison(verdict, readFileSync(baselinePath, "utf8"));
  } catch (err) {
    return {
      divergesFromBaseline: true,
      reasons: [`baseline unreadable: ${err?.code ?? "read error"}`],
    };
  }
}

let browser = null;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const viewports = {};
  for (const vp of VIEWPORTS) {
    const errors = { consoleErrors: [], pageErrors: [] };
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.pageErrors.push(String(err?.message || err)));
    // `domcontentloaded`, not `networkidle`: Vite keeps an HMR websocket open, so
    // networkidle never settles and would burn the whole timeout.
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const status = resp?.status() ?? 0;
    await page.waitForTimeout(1000);

    const title = await page.title();
    const hasCanvas = (await page.locator("canvas").count()) > 0;
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const horizontalOverflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 1;
    });
    await page.screenshot({ path: vp.screenshot, fullPage: false });

    // Isolate the finance tools section for a focused visual regression check.
    const financeTools = page.locator(".tools-wrap").first();
    if (await financeTools.count()) {
      await financeTools.scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(250);
      const financePath = vp.screenshot.replace(/\.png$/i, "-finance.png");
      await page.screenshot({ path: financePath, fullPage: false });
    }

    await page.close();

    viewports[vp.name] = {
      width: vp.width,
      height: vp.height,
      status,
      title,
      hasCanvas,
      bodyTextLen: normalizeBodyText(bodyText).length,
      bodyTextHash: normalizedBodyTextHash(bodyText),
      bodyTextPrefix: bodyTextPrefix(bodyText),
      horizontalOverflow,
      consoleErrors: errors.consoleErrors,
      pageErrors: errors.pageErrors,
      screenshot: vp.screenshot,
    };
  }


  // Exercise the key public routes as part of the same Chromium session.
  // This catches client-side navigation regressions that a homepage-only smoke
  // test cannot see, especially the property-detail route reported by users.
  const routeChecks = [];
  const publicRoutes = [
    new URL("/properties", url).toString(),
  ];
  for (const routeUrl of publicRoutes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const routeErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") routeErrors.push(`console: ${msg.text()}`);
    });
    page.on("pageerror", (err) => routeErrors.push(`page: ${String(err?.message || err)}`));
    let routeStatus = 0;
    let routeBodyTextLen = 0;
    let routeHorizontalOverflow = false;
    try {
      const response = await page.goto(routeUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      routeStatus = response?.status() ?? 0;
      await page.waitForTimeout(500);
      routeBodyTextLen = normalizeBodyText(await page.locator("body").innerText().catch(() => "")).length;
      routeHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    } finally {
      await page.close();
    }
    routeChecks.push({
      url: routeUrl,
      status: routeStatus,
      bodyTextLen: routeBodyTextLen,
      consoleErrors: routeErrors.filter((item) => item.startsWith("console:")),
      pageErrors: routeErrors.filter((item) => item.startsWith("page:")),
      horizontalOverflow: routeHorizontalOverflow,
      ok:
        routeStatus >= 200 &&
        routeStatus < 400 &&
        routeBodyTextLen > 0 &&
        !routeHorizontalOverflow &&
        routeErrors.length === 0,
    });
  }

  const apiPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let musicApiCheck;
  try {
    const response = await apiPage.request.get(new URL("/api/music", url).toString(), { timeout: timeoutMs });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // A non-JSON response should be reported through the structured smoke result below.
    }
    musicApiCheck = {
      status: response.status(),
      hasTracksArray: Array.isArray(payload?.tracks),
      ok: response.ok() && Array.isArray(payload?.tracks),
    };
  } catch (error) {
    musicApiCheck = { status: 0, hasTracksArray: false, ok: false, error: String(error?.message || error) };
  } finally {
    await apiPage.close();
  }

  // When published listings exist, exercise a real card-to-detail navigation.
  // This is the regression test for the recurring "clicking a file does nothing" bug.
  const propertyNavigationCheck = { attempted: false, ok: true, href: null, status: null, bodyTextLen: 0, error: null };
  const propertyPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    const propertiesUrl = new URL("/properties", url).toString();
    await propertyPage.goto(propertiesUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await propertyPage.waitForTimeout(500);
    const cards = propertyPage.locator('[data-property-link="true"]');
    if (await cards.count()) {
      const link = cards.first();
      const href = await link.getAttribute("href").catch(() => null);
      propertyNavigationCheck.href = href;
      if (href) {
        propertyNavigationCheck.attempted = true;
        await link.click();
      await propertyPage.waitForLoadState("domcontentloaded").catch(() => undefined);
      await propertyPage.waitForTimeout(500);
      propertyNavigationCheck.status = await propertyPage.evaluate(() => window.location.pathname);
      const textValue = await propertyPage.locator("body").innerText().catch(() => "");
      propertyNavigationCheck.bodyTextLen = normalizeBodyText(textValue).length;
        propertyNavigationCheck.ok =
          (propertyNavigationCheck.status.startsWith("/file/") ||
            propertyNavigationCheck.status.startsWith("/properties/")) &&
          propertyNavigationCheck.bodyTextLen > 80 &&
          propertyNavigationCheck.status !== "/properties/";
      }
    }
  } catch (error) {
    propertyNavigationCheck.error = String(error?.message || error);
    propertyNavigationCheck.ok = false;
  } finally {
    await propertyPage.close();
  }

  const routeFailures = routeChecks.filter((item) => !item.ok);
  if (routeFailures.length) {
    viewports.desktop.pageErrors.push(
      ...routeFailures.map((item) => `route smoke failed: ${item.url} [${item.status}]`),
    );
  }
  if (!musicApiCheck.ok) {
    viewports.desktop.pageErrors.push(`music API smoke failed: [${musicApiCheck.status}]`);
  }
  if (!propertyNavigationCheck.ok) {
    viewports.desktop.pageErrors.push(
      propertyNavigationCheck.attempted
        ? `property detail navigation smoke failed: ${propertyNavigationCheck.status || propertyNavigationCheck.error || "unknown"}`
        : "property detail navigation smoke skipped: no published property card is available in this environment",
    );
  }

  const brandWarnings = computeBrandWarnings({
    hasCanvas: viewports.desktop.hasCanvas,
    workspaceRoot: process.env.GITHUB_WORKSPACE ?? process.cwd(),
  });
  // Only a dev server answers /__app-env, so smoking the built output reads as
  // indeterminate — report a divergence, never the absence of an observation.
  const authWarnings = authInvariantWarnings(
    compareAuthInvariant({
      devAuthEnabled: await probeDevAuthEnabled(url),
      buildAuthEnabled: buildAuthEnabled(),
    }),
  );
  const verdict = { url, viewports, routeChecks, propertyNavigationCheck, musicApiCheck, brandWarnings, authWarnings, verdictFile: outJson };
  if (baselineRequested) {
    const { divergesFromBaseline, reasons } = compareAgainstBaseline(verdict);
    verdict.divergesFromBaseline = divergesFromBaseline;
    verdict.baselineReasons = reasons;
  }

  writeFileSync(outJson, JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  for (const w of [...brandWarnings, ...authWarnings]) console.error(w);
  // Set the code rather than aborting the process so the `finally` browser
  // teardown always runs (agents typically smoke twice per turn; leaking
  // Chromium accumulates across retries).
  process.exitCode = exitCodeFor(viewports);
} catch (err) {
  const failure = { ok: false, url, error: String(err?.message || err) };
  try {
    writeFileSync(outJson, JSON.stringify(failure, null, 2));
  } catch (writeErr) {
    failure.verdictWriteError = String(writeErr?.message || writeErr);
  }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
