/**
 * Sanitize / format IPv4 text as the user types.
 * - Digits and periods only
 * - Max 4 octets, 3 digits each, clamped to 255
 * - Auto-inserts a trailing period after a completed 3-digit octet
 */
export function formatIpv4Typing(next: string, prev: string): string {
  const inserting = next.length >= prev.length;
  let cleaned = next.replace(/[^\d.]/g, "").replace(/\.{2,}/g, ".");

  // No leading period
  if (cleaned.startsWith(".")) {
    cleaned = cleaned.slice(1);
  }

  const rawParts = cleaned.split(".").slice(0, 4);
  const parts = rawParts.map((part) => {
    const digits = part.replace(/\D/g, "").slice(0, 3);
    if (digits === "") {
      return "";
    }
    const value = parseInt(digits, 10);
    if (Number.isNaN(value)) {
      return "";
    }
    if (value > 255) {
      return "255";
    }
    return digits;
  });

  let result = parts.join(".");

  // After typing the 3rd digit of an octet, advance with a period
  // (except on the final octet).
  const last = parts[parts.length - 1] ?? "";
  if (
    inserting &&
    parts.length < 4 &&
    last.length === 3 &&
    !cleaned.endsWith(".")
  ) {
    result += ".";
  }

  return result;
}

/** True when the string is a complete IPv4 address. */
export function isValidIpv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}
