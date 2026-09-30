/**
 * Visual + accessibility audit for the admin panel.
 *
 * Screenshots cannot be eyeballed here, so the checks that matter are
 * measured in the browser: text contrast against the real painted background,
 * accessible names on every control, touch-target sizes, and whether the fixed
 * chrome (topbar / sticky save bar / mobile nav) overlaps content.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { installAdminApiStubs } from "./admin-fixtures.mjs";

const BASE = process.env.QA_BASE_URL || "http://127.0.0.1:8080";
const KEY = process.env.HIRMAND_ADMIN_KEY || "";
const OUT = "screenshots/admin";

const VIEWS = [
  { id: "dashboard", label: "داشبورد" },
  { id: "list", label: "فایل‌های ملک" },
  { id: "leads", label: "درخواست‌ها" },
  { id: "consultants", label: "مشاوران" },
  { id: "partners", label: "همکاران" },
  { id: "music", label: "موسیقی" },
];

const ALIASES = {
  dashboard: ["داشبورد"],
  list: ["فایل‌های ملک", "فهرست"],
  leads: ["درخواست‌ها"],
  consultants: ["مشاوران"],
  partners: ["همکاران"],
  music: ["موسیقی"],
};

const AUDIT = () => {
  const parse = (value) => {
    const match = String(value).match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((part) => Number(part.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };

  const luminance = ({ r, g, b }) => {
    const channel = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };

  // Alpha compositing must keep the residual opacity: collapsing `a` to 1 on
  // every layer turns two stacked 3% overlays into near-black.
  const blend = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };

  const contrast = (fg, bg) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * Resolves the colour actually painted behind an element.
   *
   * Gradients matter: the admin sidebar and topbar paint their background
   * through `background-image`, so `backgroundColor` is transparent and a naive
   * walk up the tree reports the light page background instead. Use the first
   * opaque gradient stop as the surface colour.
   */
  const gradientStop = (image) => {
    if (!image || image === "none") return null;
    if (!/gradient/i.test(image)) return null;
    const matches = image.match(/rgba?\([^)]+\)/g);
    if (!matches) return null;
    for (const candidate of matches) {
      const color = parse(candidate);
      if (color && color.a > 0.05) return color;
    }
    return null;
  };

  const effectiveBackground = (element) => {
    let node = element;
    let acc = null;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const color = parse(style.backgroundColor);
      const gradient = gradientStop(style.backgroundImage);
      if ((color && color.a > 0) || gradient) {
        acc = acc ? blend(acc, gradient ?? color) : (gradient ?? color);
        if (acc.a >= 0.99) return acc;
      }
      node = node.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor) || {
      r: 255, g: 255, b: 255, a: 1,
    };
    return acc ? blend(acc, body) : body;
  };

  const issues = { contrast: [], unnamed: [], smallTargets: [], overlaps: [] };

  // --- text contrast ------------------------------------------------------
  const textNodes = Array.from(
    document.querySelectorAll(
      "body *:not(script):not(style):not(svg):not(path)",
    ),
  ).filter((el) => {
    if (!el.textContent?.trim()) return false;
    const hasElementChild = Array.from(el.children).some((child) =>
      child.textContent?.trim(),
    );
    return !hasElementChild;
  });

  for (const element of textNodes.slice(0, 900)) {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    if (Number(style.opacity) === 0) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const fgRaw = parse(style.color);
    if (!fgRaw || fgRaw.a === 0) continue;
    const bg = effectiveBackground(element);
    const fg = blend(fgRaw, bg);
    const ratio = contrast(fg, bg);

    const size = parseFloat(style.fontSize) || 14;
    const weight = Number(style.fontWeight) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = isLarge ? 3 : 4.5;

    if (ratio + 0.02 < min) {
      issues.contrast.push({
        selector: `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 70)}`,
        text: element.textContent.trim().slice(0, 40),
        ratio: Math.round(ratio * 100) / 100,
        min,
        color: style.color,
        background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      });
    }
  }

  // --- accessible names ---------------------------------------------------
  /**
   * The area a finger can actually hit.
   *
   * A small control often reaches 44px without being 44px: an absolutely
   * positioned `::after` overlay, or a `<label>` wrapped around it that toggles
   * it on tap. `getBoundingClientRect` on the element knows nothing about
   * either, so measuring the bare box reports a 18px checkbox as a failure
   * when its real target is 44px. Union in whatever genuinely enlarges it.
   */
  const hitArea = (element) => {
    const rect = element.getBoundingClientRect();
    const area = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    let grew = false;

    if (getComputedStyle(element).position !== "static") {
      for (const pseudo of ["::after", "::before"]) {
        const style = getComputedStyle(element, pseudo);
        if (style.content === "none" || style.position !== "absolute") continue;
        const inset = (value) => {
          const n = parseFloat(value);
          return Number.isFinite(n) ? n : 0;
        };
        area.left = Math.min(area.left, rect.left + inset(style.left));
        area.top = Math.min(area.top, rect.top + inset(style.top));
        area.right = Math.max(area.right, rect.right - inset(style.right));
        area.bottom = Math.max(area.bottom, rect.bottom - inset(style.bottom));
        grew = true;
      }
    }

    // A wrapping <label> forwards the tap to its control, so its box counts.
    const label = element.closest("label");
    if (label && label !== element) {
      const labelRect = label.getBoundingClientRect();
      if (labelRect.width > rect.width || labelRect.height > rect.height) {
        area.left = Math.min(area.left, labelRect.left);
        area.top = Math.min(area.top, labelRect.top);
        area.right = Math.max(area.right, labelRect.right);
        area.bottom = Math.max(area.bottom, labelRect.bottom);
        grew = true;
      }
    }

    return grew
      ? { width: area.right - area.left, height: area.bottom - area.top }
      : rect;
  };

  for (const element of Array.from(
    document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]"),
  )) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const name =
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent?.trim() ||
      (element.labels && element.labels.length ? element.labels[0].textContent?.trim() : "") ||
      "";
    if (!name) {
      issues.unnamed.push({
        selector: `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}`,
        type: element.getAttribute("type") || "",
      });
    }

    // Touch targets: WCAG 2.2 asks for 24x24; the project brand asks 44px.
    const area = hitArea(element);
    if (window.innerWidth <= 640 && (area.width < 32 || area.height < 32)) {
      issues.smallTargets.push({
        selector: `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`,
        width: Math.round(area.width),
        height: Math.round(area.height),
        name: name.slice(0, 30),
      });
    }
  }

  // --- fixed chrome overlap ----------------------------------------------
  const fixedBars = Array.from(
    document.querySelectorAll(
      ".admin-topbar, .admin-sticky-bar, .admin-mobile-nav, .admin-sidebar, .admin-drawer",
    ),
  )
    .filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .map((el) => ({
      name: String(el.className).split(" ")[0],
      rect: el.getBoundingClientRect(),
    }))
    .filter((item) => item.rect.width > 2 && item.rect.height > 2);

  for (let i = 0; i < fixedBars.length; i += 1) {
    for (let j = i + 1; j < fixedBars.length; j += 1) {
      const a = fixedBars[i];
      const b = fixedBars[j];
      const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (overlapX > 4 && overlapY > 4) {
        issues.overlaps.push({ a: a.name, b: b.name, overlapX: Math.round(overlapX), overlapY: Math.round(overlapY) });
      }
    }
  }

  return issues;
};

async function clickByLabel(page, selector, viewId) {
  const candidates = await page.locator(selector).all();
  for (const candidate of candidates) {
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const text = (await candidate.innerText().catch(() => "")) || "";
    if (ALIASES[viewId].some((alias) => text.includes(alias))) {
      await candidate.click();
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

const report = { base: BASE, at: new Date().toISOString(), views: [] };

const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });

for (const viewport of [
  { id: "desktop", width: 1440, height: 900 },
  { id: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "fa-IR",
  });
  const page = await context.newPage();
  await installAdminApiStubs(page, BASE);

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(500);
  if (await page.locator('input[type="password"]').count()) {
    await page.locator('input[type="password"]').fill(KEY);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
  }

  for (const view of VIEWS) {
    const mobile = viewport.width <= 900;
    if (mobile) {
      const trigger = page.locator(".admin-drawer-trigger");
      if (await trigger.isVisible().catch(() => false)) {
        await trigger.click();
        await page.waitForTimeout(300);
      }
    }
    await clickByLabel(page, mobile ? ".admin-drawer .admin-nav-btn" : ".admin-sidebar-nav .admin-nav-btn", view.id);
    await page.waitForTimeout(900);

    const issues = await page.evaluate(AUDIT);
    report.views.push({ viewport: viewport.id, view: view.id, issues });
    await page.screenshot({ path: `${OUT}/audit-${viewport.id}-${view.id}.png` });
  }

  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
