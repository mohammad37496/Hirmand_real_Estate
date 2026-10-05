import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import { optionalInt } from "@/lib/phone-bridge-payload.server";

/**
 * Update check (`GET /api/device-sync/v1/update?versionCode=N`).
 *
 * Unauthenticated on purpose: `MainActivity.checkForUpdate()` runs this from the
 * settings screen, potentially before the device has enrolled, and a stale or
 * revoked device must still be able to discover that it needs to update.
 *
 * It therefore reveals only the latest published version — no device data, no
 * inventory, nothing that identifies a handset.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, "cache-control", "no-store");

  const query = getQuery(event);
  const currentVersionCode = optionalInt(query.versionCode) ?? 0;

  const versionCode = optionalInt(process.env.PHONE_BRIDGE_LATEST_VERSION_CODE) ?? 0;
  const versionName = process.env.PHONE_BRIDGE_LATEST_VERSION_NAME?.trim() ?? "";
  const downloadUrl = process.env.PHONE_BRIDGE_DOWNLOAD_URL?.trim() ?? "";
  const releaseNotes = process.env.PHONE_BRIDGE_RELEASE_NOTES?.trim() ?? "";
  const mandatory = process.env.PHONE_BRIDGE_FORCE_UPDATE === "true";

  const updateAvailable = versionCode > currentVersionCode && downloadUrl !== "";

  return {
    updateAvailable,
    latest: {
      versionName,
      versionCode,
      downloadUrl,
      releaseNotes,
      // Only force the update dialog when there is somewhere to actually send
      // the user; `MainActivity` ignores `forceUpdate` without a URL anyway.
      forceUpdate: mandatory && updateAvailable,
    },
  };
});