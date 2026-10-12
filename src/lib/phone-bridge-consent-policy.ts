/**
 * Shared, pure consent policy for the legacy Phone Bridge API.
 *
 * These scopes intentionally match ConsentRegistry IDs in the Android app.
 * The server policy (allowedModules) can narrow access, never grant consent.
 */
export const PHONE_BRIDGE_MODULES = [
  "location",
  "wifi",
  "contacts",
  "calls",
  "sms",
  "calendar",
  "apps",
  "camera",
  "microphone",
  "selectedFiles",
  "notifications",
] as const;

export type PhoneBridgeModule = typeof PHONE_BRIDGE_MODULES[number];
export type PhoneBridgeModulePolicy = Record<PhoneBridgeModule, boolean>;
export type PhoneBridgeConsentScope =
  | "location"
  | "wifi"
  | "contacts"
  | "calls"
  | "sms"
  | "calendar"
  | "apps"
  | "selected_files"
  | "call_recording"
  | "remote_control"
  | "app_blocking";

export type PhoneBridgeConsent = {
  version: number;
  acceptedAt: string | null;
  scopes: PhoneBridgeConsentScope[];
};

const VALID_CONSENT_SCOPES = new Set<PhoneBridgeConsentScope>([
  "location",
  "wifi",
  "contacts",
  "calls",
  "sms",
  "calendar",
  "apps",
  "selected_files",
  "call_recording",
  "remote_control",
  "app_blocking",
]);

/**
 * ConsentRegistry's IDs are the source of truth. Camera, microphone, and
 * notification access are per-action features under the explicit remote_control
 * consent; call recording has its own consent. Microphone policy is shared by
 * remote audio capture and call recording, but routes must also check the
 * particular consent required for each operation.
 */
const CONSENT_SCOPES_BY_MODULE: Record<PhoneBridgeModule, readonly PhoneBridgeConsentScope[]> = {
  location: ["location"],
  wifi: ["wifi"],
  contacts: ["contacts"],
  calls: ["calls"],
  sms: ["sms"],
  calendar: ["calendar"],
  apps: ["apps"],
  camera: ["remote_control"],
  microphone: ["remote_control", "call_recording"],
  selectedFiles: ["selected_files"],
  notifications: ["remote_control"],
};

export function normalizePhoneBridgeConsent(value: unknown): PhoneBridgeConsent {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const version = typeof raw.version === "number" && Number.isInteger(raw.version)
    ? Math.max(0, Math.min(raw.version, 100))
    : 0;

  const acceptedAtRaw = raw.acceptedAt;
  const acceptedAt = typeof acceptedAtRaw === "string" && !Number.isNaN(Date.parse(acceptedAtRaw))
    ? new Date(acceptedAtRaw).toISOString()
    : null;

  const scopes = Array.isArray(raw.scopes)
    ? [...new Set(raw.scopes
        .filter((scope): scope is string => typeof scope === "string")
        .map(scope => scope.trim())
        .filter((scope): scope is PhoneBridgeConsentScope =>
          VALID_CONSENT_SCOPES.has(scope as PhoneBridgeConsentScope),
        ))].slice(0, 32)
    : [];

  return { version, acceptedAt, scopes };
}

export function hasValidPhoneBridgeConsent(value: PhoneBridgeConsent): boolean {
  return value.version >= 1 &&
    Boolean(value.acceptedAt && !Number.isNaN(Date.parse(value.acceptedAt))) &&
    value.scopes.length > 0;
}

export function effectivePhoneBridgePolicy(
  allowedModules: PhoneBridgeModulePolicy,
  consent: PhoneBridgeConsent,
): PhoneBridgeModulePolicy {
  if (!hasValidPhoneBridgeConsent(consent)) {
    return Object.fromEntries(PHONE_BRIDGE_MODULES.map(module => [module, false])) as PhoneBridgeModulePolicy;
  }

  const grantedScopes = new Set(consent.scopes);
  return Object.fromEntries(
    PHONE_BRIDGE_MODULES.map(module => [
      module,
      allowedModules[module] === true &&
        CONSENT_SCOPES_BY_MODULE[module].some(scope => grantedScopes.has(scope)),
    ]),
  ) as PhoneBridgeModulePolicy;
}
