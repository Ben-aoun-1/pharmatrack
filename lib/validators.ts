// Input validators for the agent-facing API routes.

// UUID v4 format, e.g. "9f1c…-4xxx-[89ab]xxx-…".
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(str: string): boolean {
  return typeof str === "string" && UUID_V4_REGEX.test(str);
}

// Barcode (CODE_PCT) is exactly 7 digits.
export function isValidBarcode(str: string): boolean {
  return typeof str === "string" && /^\d{7}$/.test(str);
}

// Price must be a positive, finite number.
export function isValidPrice(val: unknown): boolean {
  return typeof val === "number" && Number.isFinite(val) && val > 0;
}
