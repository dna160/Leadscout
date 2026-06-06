import { describe, it, expect } from "vitest";
import { normalizeName, computePlaceKey } from "../../src/domain/identity";

describe("normalizeName", () => {
  it("lowercases, strips punctuation and noise words", () => {
    expect(normalizeName("The Wagyu House Restaurant")).toBe("wagyu");
  });

  it("strips diacritics", () => {
    expect(normalizeName("Café Niçoise")).toBe("nicoise");
  });
});

describe("computePlaceKey", () => {
  it("prefers Google placeId when present and long enough", () => {
    expect(computePlaceKey({ placeId: "ChIJabc12345" })).toBe("ChIJabc12345");
  });

  it("falls back to name + coords hash", () => {
    const a = computePlaceKey({ title: "Sushi Tei", location: { lat: -6.2001, lng: 106.8166 } });
    const b = computePlaceKey({ title: "Sushi Tei", location: { lat: -6.2002, lng: 106.8167 } });
    expect(a).toBe(b); // same 3dp grid cell
    expect(a).toHaveLength(24);
  });

  it("falls back to name + city when no coords", () => {
    const key = computePlaceKey({ title: "Some Place", city: "Jakarta" });
    expect(key).toHaveLength(24);
  });
});
