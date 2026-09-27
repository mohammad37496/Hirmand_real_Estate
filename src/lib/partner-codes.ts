export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function normalizePartnerCode(value: string) {
  return normalizeDigits(value)
    .trim()
    .toUpperCase()
    .replace(/[\s\u200B\u200C\u200D\u200E\u200F]+/g, "");
}

export function normalizeTrackingCode(value: string) {
  return normalizeDigits(value)
    .trim()
    .toUpperCase()
    .replace(/[–—−]/g, "-")
    .replace(/[\s\u200B\u200C\u200D\u200E\u200F]+/g, "");
}

export function isValidTrackingCode(value: string) {
  return /^HIR-\d{2}-[A-Z0-9]{8}$/.test(normalizeTrackingCode(value));
}
