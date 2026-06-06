import crypto from "crypto";

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|a|an|and|or|of|in|at|by|for|with|restaurant|cafe|bar|grill|kitchen|house|place)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function computePlaceKey(raw: Record<string, unknown>): string {
  // Priority 1: Google's own stable IDs
  const placeId = (raw.placeId ?? raw.place_id ?? null) as string | null;
  if (placeId && placeId.length > 4) return placeId;

  // Priority 2: normalize(name) + rough coords (truncate to 3dp ≈ 111m grid)
  const name = (raw.title ?? raw.name ?? "") as string;
  const lat = raw.location ? (raw.location as { lat?: number }).lat : (raw.lat as number | undefined);
  const lng = raw.location ? (raw.location as { lng?: number }).lng : (raw.lng as number | undefined);

  if (name && lat != null && lng != null) {
    const normalized = normalizeName(name);
    const geo = `${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`;
    return crypto.createHash("sha1").update(`${normalized}::${geo}`).digest("hex").slice(0, 24);
  }

  // Fallback: name + city
  const city = (raw.city ?? "") as string;
  const normalized = normalizeName(name);
  return crypto.createHash("sha1").update(`${normalized}::${city}`).digest("hex").slice(0, 24);
}
