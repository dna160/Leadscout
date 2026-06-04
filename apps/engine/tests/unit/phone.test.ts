import { describe, it, expect } from "vitest";
import { normalisePhone, toWhatsApp } from "../../src/lib/phone";

describe("normalisePhone", () => {
  it("handles +62 prefix", () => {
    expect(normalisePhone("+62812-3456-7890")).toBe("+6281234567890");
    expect(normalisePhone("+6221-7179-2255")).toBe("+622171792255");
  });

  it("handles 62 prefix without +", () => {
    expect(normalisePhone("6281234567890")).toBe("+6281234567890");
  });

  it("handles leading 0 (local format)", () => {
    expect(normalisePhone("081234567890")).toBe("+6281234567890");
    expect(normalisePhone("021-5790-3344")).toBe("+622157903344");
  });

  it("handles leading 8 (short local)", () => {
    expect(normalisePhone("8123456789")).toBe("+628123456789");
  });

  it("handles area code formats", () => {
    expect(normalisePhone("0361-755-221")).toBe("+62361755221");
    expect(normalisePhone("024-845-5566")).toBe("+62248455566");
  });

  it("returns null for null/undefined input", () => {
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone(undefined)).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });

  it("returns null for numbers that are too short", () => {
    expect(normalisePhone("123")).toBeNull();
  });
});

describe("toWhatsApp", () => {
  it("builds wa.me URL", () => {
    expect(toWhatsApp("+6281234567890")).toBe("https://wa.me/6281234567890");
  });

  it("builds from raw number with 0 prefix", () => {
    expect(toWhatsApp("081234567890")).toBe("https://wa.me/6281234567890");
  });

  it("returns null for null input", () => {
    expect(toWhatsApp(null)).toBeNull();
  });
});
