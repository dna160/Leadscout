import { describe, it, expect } from "vitest";
import { ok, err, isOk } from "@/lib/result";

describe("Result<T,E>", () => {
  it("ok() creates a success result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
  });

  it("err() creates a failure result", () => {
    const r = err(new Error("fail"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toBe("fail");
  });

  it("isOk narrows the type", () => {
    const r = ok("hello");
    expect(isOk(r)).toBe(true);
    const e = err("bad");
    expect(isOk(e)).toBe(false);
  });

  it("supports complex value types", () => {
    const r = ok({ name: "Saka", rating: 4.6 });
    if (r.ok) {
      expect(r.value.name).toBe("Saka");
      expect(r.value.rating).toBe(4.6);
    }
  });
});
