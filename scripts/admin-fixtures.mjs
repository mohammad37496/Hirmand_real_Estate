/**
 * Fixtures for the admin UI sweep.
 *
 * The dev server (Vite) does not register the nitro `server/routes/api/*`
 * handlers, so the browser needs them stubbed to render the authenticated
 * panel. Everything else — server functions, the database, React — runs for
 * real.
 *
 * Against a production preview (`npm run preview:restart`, port 8081) those
 * routes DO exist, and stubbing them there would replace the exact thing the
 * sweep is meant to exercise. `installAdminApiStubs` probes first and only
 * fills in what is genuinely missing, so the same script can be pointed at
 * either server.
 */

/** True when the target already serves the nitro API routes. */
export async function servesNitroApi(base) {
  try {
    const response = await fetch(new URL("/api/music", base), {
      method: "GET",
      headers: { accept: "application/json" },
    });
    return response.status < 500;
  } catch {
    return false;
  }
}

/**
 * Installs only the stubs the target server is missing.
 * Returns the list of route patterns that were stubbed, for the report.
 */
export async function installAdminApiStubs(page, base) {
  if (await servesNitroApi(base)) return [];
  for (const [pattern, handler] of Object.entries(stubAdminApi)) {
    await page.route(pattern, handler);
  }
  return Object.keys(stubAdminApi);
}

/**
 * Mints the same JWT the real `/api/admin/session` route issues, so the server
 * functions (`listAdminProperties`, `listConsultants`, …) see a valid session
 * even though only the nitro route is stubbed.
 */
let cachedSessionCookie = null;
async function adminSessionCookie() {
  if (cachedSessionCookie) return cachedSessionCookie;
  const { createHash } = await import("node:crypto");
  const { SignJWT } = await import("jose");

  const key = process.env.HIRMAND_ADMIN_KEY;
  if (!key) throw new Error("HIRMAND_ADMIN_KEY is required for the admin QA sweep.");
  const secret = createHash("sha256").update(key.trim()).digest();

  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("hirmand-admin")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);

  cachedSessionCookie = `hirmand-admin=${token}; Path=/; HttpOnly; SameSite=Lax`;
  return cachedSessionCookie;
}

export const stubAdminApi = {
  "**/api/admin/session": async (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() ?? {};
    } catch {
      body = {};
    }
    if (body.action === "logout") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "set-cookie": "hirmand-admin=; Max-Age=0; Path=/" },
        body: JSON.stringify({ success: true }),
      });
    }
    if (body.action === "login" && !body.adminKey) {
      // Session probe before login.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, authenticated: false }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "set-cookie": await adminSessionCookie() },
      body: JSON.stringify({ success: true, authenticated: true }),
    });
  },

  "**/api/admin-dashboard": async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        properties: {
          total: 128,
          published: 96,
          draft: 24,
          archived: 8,
          featured: 6,
          withoutImages: 11,
          newLast7: 9,
          incomplete: 17,
        },
        consultants: { total: 7, active: 6, withFiles: 5, withLeads: 4 },
        leads: {
          total: 214,
          new: 18,
          contacted: 41,
          follow_up: 27,
          visited: 12,
          contract: 9,
          closed: 96,
          spam: 11,
          today: 5,
          last7: 22,
          last30: 71,
        },
        propertyTypes: [
          { type: "apartment", count: 72 },
          { type: "villa", count: 24 },
          { type: "office", count: 18 },
          { type: "land", count: 9 },
          { type: "heritage", count: 3 },
          { type: "commercial", count: 2 },
        ],
        leadDays: [
          { day: "2026-09-24", count: 4 },
          { day: "2026-09-25", count: 7 },
          { day: "2026-09-26", count: 3 },
          { day: "2026-09-27", count: 9 },
          { day: "2026-09-28", count: 6 },
          { day: "2026-09-29", count: 8 },
          { day: "2026-09-30", count: 5 },
        ],
        music: { total: 6, active: 4, sizeBytes: 18_400_000 },
        visitors: {
          today: 64,
          last7: 412,
          last30: 1_780,
          pageviewsToday: 190,
          pageviewsLast7: 1_240,
          pageviewsLast30: 5_310,
          activeNow: 7,
        },
        visitorDays: [
          { day: "2026-09-28", uniqueVisitors: 180, pageviews: 520 },
          { day: "2026-09-29", uniqueVisitors: 96, pageviews: 260 },
          { day: "2026-09-30", uniqueVisitors: 64, pageviews: 190 },
        ],
        topPages: [
          { path: "/properties", pageviews: 640, uniqueVisitors: 420 },
          { path: "/", pageviews: 512, uniqueVisitors: 380 },
          { path: "/properties/apartment-sale", pageviews: 210, uniqueVisitors: 150 },
        ],
        topProperties: [
          {
            slug: "sample-one",
            title: "آپارتمان ۱۲۰ متری اصفهان",
            neighborhood: "چهارباغ",
            views: 320,
            uniqueViews: 210,
            calls: 18,
            whatsapp: 24,
            favorites: 12,
          },
        ],
        eventStats: [
          { event: "property_view", count: 1240, uniqueVisitors: 430 },
          { event: "call_click", count: 86, uniqueVisitors: 70 },
          { event: "inquiry_submit", count: 41, uniqueVisitors: 39 },
        ],
        visitorSources: [
          { source: "direct", campaign: "بدون کمپین", visitors: 620 },
          { source: "instagram.com", campaign: "story", visitors: 210 },
        ],
        followUps: { due: 6, next7: 14 },
        recentLeads: [
          {
            id: "l1",
            name: "زهرا محمدی",
            phone: "09121112233",
            deal: "خرید",
            neighborhood: "مرداویج",
            status: "new",
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    }),

  "**/api/admin-sales-control-center": async (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() ?? {};
    } catch {
      body = {};
    }
    const days = [7, 30, 90].includes(Number(body.days)) ? Number(body.days) : 30;
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        days,
        pipeline: { new: 18, contacted: 41, follow_up: 27, visited: 12, contract: 9 },
        summary: {
          consultants: 3,
          activeConsultants: 3,
          activeLeads: 28,
          overdueLeads: 4,
          visitRequests: 5,
          contracts: 9,
          totalViews: 1240,
        },
        consultants: [
          {
            id: "c1",
            name: "آقای شیخ",
            phone: "09131056029",
            active: true,
            files: 24,
            leads: 42,
            periodLeads: 18,
            activeLeads: 11,
            new7d: 5,
            overdueLeads: 2,
            nextFollowUps: 4,
            visitRequests: 2,
            contracts: 12,
            periodContracts: 4,
            views: 420,
            conversionRate: 22.2,
          },
          {
            id: "c2",
            name: "آقای مرادی",
            phone: "09130000000",
            active: true,
            files: 18,
            leads: 35,
            periodLeads: 14,
            activeLeads: 9,
            new7d: 3,
            overdueLeads: 1,
            nextFollowUps: 6,
            visitRequests: 2,
            contracts: 8,
            periodContracts: 3,
            views: 330,
            conversionRate: 21.4,
          },
          {
            id: "c3",
            name: "مشاور نمونه",
            phone: "09120000000",
            active: true,
            files: 12,
            leads: 21,
            periodLeads: 9,
            activeLeads: 8,
            new7d: 2,
            overdueLeads: 1,
            nextFollowUps: 3,
            visitRequests: 1,
            contracts: 3,
            periodContracts: 2,
            views: 190,
            conversionRate: 22.2,
          },
        ],
      }),
    });
  },

  "**/api/leads-admin": async (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() ?? {};
    } catch {
      body = {};
    }
    if (body.action === "export") {
      return route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        body: "name,phone\n",
      });
    }
    if (body.action === "status" || body.action === "delete" || body.action === "note") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, note: body.note ?? "" }),
      });
    }
    const total = 214;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total, leads: buildLeads(Math.min(body.limit ?? 25, total)) }),
    });
  },

  "**/api/music-admin": async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tracks: [
          {
            id: "t1",
            title: "آرامش اصفهان",
            artist: "گروه هیرمند",
            url: "/music/sample.mp3",
            mimeType: "audio/mpeg",
            sizeBytes: 4_200_000,
            active: true,
            position: 0,
            createdAt: new Date().toISOString(),
          },
          {
            id: "t2",
            title: "باران مهر",
            artist: "",
            url: "/music/sample-2.mp3",
            mimeType: "audio/mpeg",
            sizeBytes: 3_100_000,
            active: false,
            position: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    }),

  "**/api/admin/partners": async (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() ?? {};
    } catch {
      body = {};
    }
    if (body.action === "details") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          partner: buildPartnerOverview(),
          contracts: [],
          audits: [],
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        partners: [
          buildPartnerSummary({
            id: "p1",
            partnerCode: "SPH-1042",
            agencyName: "املاک سپهر",
            contactName: "آقای سپهری",
            status: "active",
            cardStamps: 7,
            contractCount: 4,
          }),
          buildPartnerSummary({
            id: "p2",
            partnerCode: "KVR-2087",
            agencyName: "املاک کویر",
            contactName: "خانم کریمی",
            status: "suspended",
            cardStamps: 0,
            contractCount: 0,
            lastLoginAt: null,
          }),
        ],
        pendingContracts: [],
      }),
    });
  },

  "**/api/admin/properties-export": async (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/csv; charset=utf-8",
      body: "id,title\n1,نمونه\n",
    }),
};

export function buildPartnerSummary(overrides = {}) {
  return {
    id: "p1",
    partnerCode: "SPH-1042",
    agencyName: "املاک سپهر",
    contactName: "آقای سپهری",
    phone: "09120000000",
    status: "active",
    cardNumber: 1,
    cardStamps: 0,
    contractCount: 0,
    availableRewards: 0,
    claimedRewards: 0,
    pendingContracts: 0,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildPartnerOverview() {
  return {
    ...buildPartnerSummary(),
    partnerCode: "SPH-1042",
    rewardsEarned: 0,
    contracts: 0,
  };
}

export function buildLeads(count) {
  const statuses = ["new", "contacted", "follow_up", "visited", "contract", "closed", "spam"];
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    id: `lead-${index + 1}`,
    name: `مشتری نمونه ${index + 1}`,
    phone: `0912000${String(index).padStart(4, "0")}`,
    peopleCount: 3 + index,
    job: "کارمند",
    deal: index % 2 ? "رهن و اجاره" : "خرید",
    propertyType: "آپارتمان",
    neighborhood: ["چهارباغ", "مرداویج", "سپاهان‌شهر"][index % 3],
    floorPreference: "۳",
    requestedAmenities: ["parking", "elevator"],
    consultant: "آقای شیخ",
    note: index % 3 === 0 ? "تماس گرفته شد؛ منتظر تأیید بودجه." : "",
    status: statuses[index % statuses.length],
    createdAt: new Date(now - index * 3_600_000).toISOString(),
    source: "website",
    acquisitionSource: index % 2 ? "اینستاگرام" : null,
    acquisitionMedium: null,
    acquisitionCampaign: null,
    acquisitionReferrer: null,
    followUpAt: index % 3 === 0 ? new Date(now + index * 3_600_000).toISOString() : null,
    lastContactedAt: null,
    leaseDeadline: null,
    budgetDeposit: 500_000_000_000,
    budgetRent: 12_000_000,
    budgetPurchase: null,
    budgetSale: null,
    budgetDepositMin: 400_000_000_000,
    budgetDepositMax: 600_000_000_000,
    budgetRentMin: 10_000_000,
    budgetRentMax: 15_000_000,
    budgetPurchaseMin: null,
    budgetPurchaseMax: null,
    budgetSaleMin: null,
    budgetSaleMax: null,
    requestedBedrooms: 3,
    budgetEquivalent: 524_000_000_000,
    budgetBedrooms: 2,
    budgetRate: 10000000,
    matchCount: 3,
    matchedProperties: [
      {
        slug: "sample-one",
        title: "آپارتمان نمونه در چهارباغ",
        tier: "within",
        score: 90,
        suggestedDeposit: 450_000_000_000,
        suggestedRent: 11_000_000,
      },
    ],
  }));
}
