import { z } from "zod";

/**
 * Shared normalization for property money values.
 *
 * Contract:
 * - empty / nullish / literal "null" / literal "undefined" => null
 * - finite numeric inputs are converted to their decimal string without
 *   passing through PostgreSQL's numeric parser from an untyped "null" string
 * - Persian/Arabic digits and common grouping separators are normalized
 * - malformed values are returned unchanged so the server schema can reject
 *   them instead of silently turning invalid input into NULL.
 */
export function normalizeMoneyInput(value: unknown): unknown {
  if (value == null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? String(value) : value;
  }

  if (typeof value !== "string") return value;

  const raw = value.trim();
  if (!raw || /^(null|undefined)$/i.test(raw)) return null;

  return raw
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[,_٬،\s]/g, "");
}

/**
 * Convert a user-entered money string into a nullable exact decimal string.
 * Returns null only for empty/nullish/literal-null values; malformed non-empty
 * values remain distinguishable to callers that need strict validation.
 */
export function normalizeMoneyText(value: unknown): string {
  const normalized = normalizeMoneyInput(value);
  return typeof normalized === "string" ? normalized : normalized == null ? "" : String(normalized);
}

export function nullableMoneyValue(value: unknown): string | null {
  const normalized = normalizeMoneyText(value);
  return normalized ? normalized : null;
}

export const nullableMoneyFieldSchema = z.preprocess(
  (value) => normalizeMoneyInput(value),
  z.union([z.null(), z.string().regex(/^\d{1,20}$/)]),
);

export function isMoneyText(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,20}$/.test(value);
}

function normalizeIntegerText(value: unknown): string {
  if (value == null) return "";
  if (typeof value !== "string") return String(value);
  const raw = value.trim();
  if (!raw || /^(null|undefined)$/i.test(raw)) return "";
  return raw
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,\s]/g, "");
}

export function isInvalidIntegerInput(value: unknown, allowNegative = false): boolean {
  const normalized = normalizeIntegerText(value);
  if (!normalized) return false;
  if (!/^-?\d+$/.test(normalized)) return true;
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || !Number.isFinite(parsed)) return true;
  return !allowNegative && parsed < 0;
}

export function nullableIntegerInput(value: unknown, allowNegative = false): number | null {
  const normalized = normalizeIntegerText(value);
  if (!normalized) return null;
  if (isInvalidIntegerInput(value, allowNegative)) return null;
  return Number(normalized);
}

/**
 * Boundary normalization for legacy/imported rows that are expected to map to
 * PostgreSQL integer columns. Invalid non-null values become null only at a
 * trusted parser boundary after the source value has already been accepted;
 * request validation remains strict for admin form writes.
 */
export function nullableIntegerValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isInteger(value) && Number.isFinite(value) ? value : null;

  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read a numeric column that may arrive as a number OR as a string.
 *
 * PostgreSQL `numeric` columns are returned as strings by the default `pg` type
 * parsers (and by PGlite), while `integer` / `smallint` / `double precision`
 * arrive as numbers. A mapping helper that only accepts `typeof value ===
 * "number"` therefore drops every `numeric` column silently — which is how
 * `price_drop_percent` (numeric(7,2)) stayed permanently null and the public
 * price-drop badge never rendered.
 *
 * Money is deliberately NOT routed through here: `numeric(20,0)` values stay
 * strings so large values never lose precision (see `mapProperty`).
 */
export function nullableNumericValue(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    // Persian decimal separator; grouping separators are deliberately left in
    // place so a malformed value is rejected rather than silently reinterpreted.
    .replace(/٫/g, ".");
  if (!normalized) return null;
  // PostgreSQL renders numeric as a plain decimal; anything else (a grouped
  // "1,5" from an imported row, a unit suffix) must become null, not NaN.
  if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
