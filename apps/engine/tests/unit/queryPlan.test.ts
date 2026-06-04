import { describe, it, expect } from "vitest";
import { buildQueryPlan } from "../../src/services/scrape.service";

const HOT_SET = { segment: "hot" as const, label: "Hot", keywords: ["fine dining", "steakhouse"] };
const WARM_SET = { segment: "warm" as const, label: "Warm", keywords: ["japanese restaurant"] };
const CITIES = [
  { name: "Jakarta", query: "Jakarta" },
  { name: "Bali", query: "Bali" },
];

describe("buildQueryPlan", () => {
  it("produces keyword × city cartesian product", () => {
    const plan = buildQueryPlan([HOT_SET], CITIES);
    expect(plan).toHaveLength(4); // 2 keywords × 2 cities
    expect(plan.map((p) => p.query)).toContain("fine dining Jakarta");
    expect(plan.map((p) => p.query)).toContain("steakhouse Bali");
  });

  it("includes segment and keyword metadata", () => {
    const plan = buildQueryPlan([HOT_SET, WARM_SET], [CITIES[0]]);
    const hotEntry = plan.find((p) => p.query === "fine dining Jakarta");
    expect(hotEntry?.segment).toBe("hot");
    expect(hotEntry?.keyword).toBe("fine dining");
    expect(hotEntry?.city).toBe("Jakarta");
  });

  it("deduplicates identical queries", () => {
    const duplicateSet = {
      segment: "hot" as const,
      label: "Dup",
      keywords: ["fine dining"],
    };
    const plan = buildQueryPlan([HOT_SET, duplicateSet], [CITIES[0]]);
    const fineDiningJakarta = plan.filter((p) => p.query === "fine dining Jakarta");
    expect(fineDiningJakarta).toHaveLength(1);
  });

  it("returns empty array for empty keywords", () => {
    const plan = buildQueryPlan([], CITIES);
    expect(plan).toHaveLength(0);
  });

  it("returns empty array for empty cities", () => {
    const plan = buildQueryPlan([HOT_SET], []);
    expect(plan).toHaveLength(0);
  });

  it("uses city.query not city.name in the query string", () => {
    const plan = buildQueryPlan([HOT_SET], [{ name: "Bali", query: "Bali Island, Indonesia" }]);
    expect(plan[0].query).toBe("fine dining Bali Island, Indonesia");
  });
});
