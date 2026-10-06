import { createError, defineEventHandler, getCookie, setResponseHeader, type H3Event } from "h3";
import { dbSource, getSql } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionClaims,
  verifyAdminSessionToken,
} from "@/lib/admin-session.server";
import { hasAdminPermission, normalizeAdminRole } from "@/lib/admin-roles";
import { assertSameOrigin } from "@/lib/admin-rate-limit.server";

async function requireSecurityAdmin(event: H3Event) {
  const token = getCookie(event, ADMIN_SESSION_COOKIE);
  if (!(await verifyAdminSessionToken(token))) {
    throw createError({ statusCode: 401, statusMessage: "نشست مدیریت معتبر نیست." });
  }
  assertSameOrigin(event);
  const claims = await getAdminSessionClaims(token);
  if (!hasAdminPermission(normalizeAdminRole(claims?.role), "security.manage")) {
    throw createError({
      statusCode: 403,
      statusMessage: "دسترسی مشاهده موقعیت کارکنان برای این حساب فعال نیست.",
    });
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function iso(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasLocationConsent(
  consentVersion: unknown,
  acceptedAt: unknown,
  scopes: unknown,
): boolean {
  const version = Number(consentVersion ?? 0);
  const accepted = typeof acceptedAt === "string" && Number.isFinite(Date.parse(acceptedAt));
  const scopeList = Array.isArray(scopes)
    ? scopes.filter((scope): scope is string => typeof scope === "string")
    : [];
  return version >= 1 && accepted && scopeList.includes("device_status") && scopeList.includes("location");
}

type LiveLocationRow = {
  deviceId: string;
  employee: string;
  deviceName: string;
  manufacturer: string;
  model: string;
  enabled: boolean;
  trackingEnabled: boolean;
  locationPolicyAllowed: boolean;
  consented: boolean;
  staffId: string | null;
  staffName: string | null;
  staffRole: string | null;
  lastSeenAt: string | null;
  latestLocationAt: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  speedMps: number | null;
  bearingDegrees: number | null;
  provider: string | null;
  observedAt: string | null;
  receivedAt: string | null;
};

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "private, no-store");
  await requireSecurityAdmin(event);

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "پایگاه داده آماده نیست." });
  }

  const sql = await getSql();
  const rows = await sql.query<Record<string, unknown>>(
    `select
       d.id as device_id,
       d.employee,
       d.name as device_name,
       d.manufacturer,
       d.model,
       d.enabled,
       d.location_tracking_enabled,
       d.allowed_modules,
       d.last_seen_at,
       d.consent_version,
       d.consent_accepted_at,
       d.consent_scopes,
       c.id as staff_id,
       c.name as staff_name,
       c.role as staff_role,
       p.recorded_at,
       p.received_at,
       p.latitude,
       p.longitude,
       p.accuracy_meters,
       p.altitude_meters,
       p.speed_mps,
       p.bearing_degrees,
       p.provider
     from phone_bridge_devices d
     left join consultants c
       on lower(trim(c.name)) = lower(trim(d.employee))
     left join lateral (
       select recorded_at,received_at,latitude,longitude,accuracy_meters,
              altitude_meters,speed_mps,bearing_degrees,provider
       from phone_bridge_location_points
       where device_id=d.id
       order by recorded_at desc
       limit 1
     ) p on true
     order by
       case when p.recorded_at is null then 1 else 0 end,
       p.recorded_at desc nulls last,
       d.updated_at desc`,
  );

  const locations: LiveLocationRow[] = rows.map((row) => {
    const modules = object(row.allowed_modules);
    const policyAllowed = modules.location !== false;
    const consented = hasLocationConsent(
      row.consent_version,
      row.consent_accepted_at,
      row.consent_scopes,
    );
    const latestLocationAt = iso(row.recorded_at);
    const canExposeLocation =
      row.enabled === true &&
      row.location_tracking_enabled === true &&
      policyAllowed &&
      consented &&
      row.latitude != null &&
      row.longitude != null;

    return {
      deviceId: String(row.device_id),
      employee: String(row.employee ?? "").trim(),
      deviceName: String(row.device_name ?? "").trim(),
      manufacturer: String(row.manufacturer ?? "").trim(),
      model: String(row.model ?? "").trim(),
      enabled: row.enabled === true,
      trackingEnabled: row.location_tracking_enabled === true,
      locationPolicyAllowed: policyAllowed,
      consented,
      staffId: row.staff_id ? String(row.staff_id) : null,
      staffName: row.staff_name ? String(row.staff_name) : null,
      staffRole: row.staff_role ? String(row.staff_role) : null,
      lastSeenAt: iso(row.last_seen_at),
      latestLocationAt: canExposeLocation ? latestLocationAt : null,
      latitude: canExposeLocation && row.latitude != null ? Number(row.latitude) : null,
      longitude: canExposeLocation && row.longitude != null ? Number(row.longitude) : null,
      accuracyMeters: canExposeLocation && row.accuracy_meters != null ? Number(row.accuracy_meters) : null,
      altitudeMeters: canExposeLocation && row.altitude_meters != null ? Number(row.altitude_meters) : null,
      speedMps: canExposeLocation && row.speed_mps != null ? Number(row.speed_mps) : null,
      bearingDegrees: canExposeLocation && row.bearing_degrees != null ? Number(row.bearing_degrees) : null,
      provider: canExposeLocation && row.provider ? String(row.provider) : null,
      observedAt: canExposeLocation ? latestLocationAt : null,
      receivedAt: canExposeLocation ? iso(row.received_at) : null,
    };
  });

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    refreshIntervalSeconds: 15,
    source: "phone_bridge_location_points",
    locations,
    counts: {
      devices: locations.length,
      withLocation: locations.filter((item) => item.latitude != null && item.longitude != null).length,
      trackingEnabled: locations.filter((item) => item.trackingEnabled).length,
      consented: locations.filter((item) => item.consented).length,
    },
  };
});
