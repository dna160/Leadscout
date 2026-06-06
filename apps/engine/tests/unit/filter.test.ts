import { describe, it, expect } from "vitest";
import { applyL2Filter } from "../../src/services/filter.service";
import type { FilterRule } from "../../src/domain/filtering";

function rule(partial: Partial<FilterRule> & Pick<FilterRule, "type" | "value">): FilterRule {
  return {
    id: "r",
    action: partial.type.endsWith("_block") ? "block" : "min",
    enabled: true,
    created_at: new Date(),
    ...partial,
  };
}

const baseLead = {
  place_key: "k",
  place_id: null,
  name: "Wagyu Premium Steakhouse",
  category: "steak house",
  segment: "hot" as const,
  matched_keyword: "steakhouse",
  matched_keywords: ["steakhouse"],
  city: "Jakarta",
  address: null,
  phone: null,
  whatsapp: null,
  website: null,
  email: null,
  instagram: null,
  maps_url: null,
  rating: 4.5,
  reviews: 120,
  price_level: 3,
  status: "active" as const,
  reject_layer: null,
  reject_reason: null,
  triage_verdict: null,
  first_seen_run: null,
  last_seen_run: null,
  source_run_id: null,
};

describe("applyL2Filter", () => {
  it("keeps a clean premium lead", () => {
    const res = applyL2Filter(baseLead, [
      rule({ type: "rating_min", value: "3.5" }),
      rule({ type: "reviews_min", value: "5" }),
      rule({ type: "price_min", value: "2" }),
    ]);
    expect(res.verdict).toBe("keep");
  });

  it("drops on blocked category (case-insensitive substring)", () => {
    const res = applyL2Filter(
      { ...baseLead, category: "Convenience Store" },
      [rule({ type: "category_block", value: "convenience store" })],
    );
    expect(res.verdict).toBe("drop");
    expect(res.layer).toBe("L2");
  });

  it("drops on blocked name", () => {
    const res = applyL2Filter(
      { ...baseLead, name: "Indomaret Point" },
      [rule({ type: "name_block", value: "Indomaret" })],
    );
    expect(res.verdict).toBe("drop");
  });

  it("drops below price floor", () => {
    const res = applyL2Filter({ ...baseLead, price_level: 1 }, [rule({ type: "price_min", value: "2" })]);
    expect(res.verdict).toBe("drop");
  });

  it("drops below rating floor", () => {
    const res = applyL2Filter({ ...baseLead, rating: 3.0 }, [rule({ type: "rating_min", value: "3.5" })]);
    expect(res.verdict).toBe("drop");
  });

  it("drops below reviews floor", () => {
    const res = applyL2Filter({ ...baseLead, reviews: 2 }, [rule({ type: "reviews_min", value: "5" })]);
    expect(res.verdict).toBe("drop");
  });

  it("ignores disabled rules", () => {
    const res = applyL2Filter({ ...baseLead, rating: 1.0 }, [
      rule({ type: "rating_min", value: "3.5", enabled: false }),
    ]);
    expect(res.verdict).toBe("keep");
  });

  it("does not drop when value is null", () => {
    const res = applyL2Filter({ ...baseLead, price_level: null }, [rule({ type: "price_min", value: "2" })]);
    expect(res.verdict).toBe("keep");
  });
});
