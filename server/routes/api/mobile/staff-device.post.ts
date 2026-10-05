import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { randomUUID } from "node:crypto";
import { dbSource, getSql } from "@/lib/db";
import { generateStaffMobileToken, hashStaffMobileToken } from "@/lib/staff-mobile-auth.server";

type Body = {
  deviceId?: unknown;
  staffId?: unknown;
  appVersionName?: unknown;
  appVersionCode?: unknown;
  authTokenPresent?: unknown;
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");

  if (dbSource === "unconfigured") {
    throw createError({ statusCode: 503, statusMessage: "سامانه ثبت دستگاه موقتاً در دسترس نیست." });
  }

  const body = (await readBody(event).catch(() => ({}))) as Body;
  const deviceId = cleanText(body.deviceId, 80);
  const staffId = cleanText(body.staffId, 80);
  const appVersionName = cleanText(body.appVersionName, 30);
  const rawVersionCode = Number(body.appVersionCode);
  const appVersionCode = Number.isInteger(rawVersionCode) && rawVersionCode >= 0 ? rawVersionCode : 0;
  const authTokenPresent = body.authTokenPresent === true;

  if (!isUuid(deviceId)) {
    throw createError({ statusCode: 400, statusMessage: "شناسه دستگاه نامعتبر است." });
  }
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(staffId)) {
    throw createError({ statusCode: 400, statusMessage: "شناسه کارمند نامعتبر است." });
  }

  const sql = await getSql();
  const staffRows = await sql.query<{ id: string; name: string; role: string }>(
    "select id,name,role from consultants where id=$1 and is_active=true limit 1",
    [staffId],
  );
  const staff = staffRows[0];
  if (!staff) {
    throw createError({ statusCode: 404, statusMessage: "این کارمند فعال در سامانه پیدا نشد." });
  }

  const existingRows = await sql.query<{
    id: string;
    status: "pending" | "active" | "revoked";
    staff_id: string;
    auth_token_hash: string | null;
  }>(
    "select id,status,staff_id,auth_token_hash from staff_mobile_devices where device_id=$1 limit 1",
    [deviceId],
  );
  const existing = existingRows[0];

  let issuedToken: string | null = null;

  if (existing) {
    const sameStaff = existing.staff_id === staff.id;
    const keepActive = sameStaff && existing.status === "active" && authTokenPresent && Boolean(existing.auth_token_hash);
    const nextStatus = keepActive ? "active" : "pending";
    const shouldIssueToken = !authTokenPresent || !existing.auth_token_hash || !sameStaff || existing.status === "revoked";

    if (shouldIssueToken) {
      issuedToken = generateStaffMobileToken();
    }

    const rows = await sql.query<{ status: string }>(
      "update staff_mobile_devices set staff_id=$1,status=$2,app_version_name=$3,app_version_code=$4," +
        "auth_token_hash=coalesce($5,auth_token_hash),auth_token_created_at=case when $5 is not null then current_timestamp else auth_token_created_at end," +
        "updated_at=current_timestamp,last_seen_at=current_timestamp," +
        "approved_at=case when $2='active' then approved_at else null end," +
        "revoked_at=null where id=$6 returning status",
      [staff.id, nextStatus, appVersionName, appVersionCode, issuedToken ? hashStaffMobileToken(issuedToken) : null, existing.id],
    );

    return {
      success: true,
      deviceId,
      staff: { id: staff.id, name: staff.name, role: staff.role },
      status: rows[0]?.status ?? nextStatus,
      needsAdminApproval: nextStatus !== "active",
      authToken: issuedToken,
    };
  }

  issuedToken = generateStaffMobileToken();
  const id = randomUUID();

  await sql.query(
    "insert into staff_mobile_devices " +
      "(id,device_id,staff_id,status,app_version_name,app_version_code,last_seen_at,auth_token_hash,auth_token_created_at) " +
      "values ($1,$2,$3,'pending',$4,$5,current_timestamp,$6,current_timestamp)",
    [id, deviceId, staff.id, appVersionName, appVersionCode, hashStaffMobileToken(issuedToken)],
  );

  return {
    success: true,
    deviceId,
    staff: { id: staff.id, name: staff.name, role: staff.role },
    status: "pending",
    needsAdminApproval: true,
    authToken: issuedToken,
  };
});
