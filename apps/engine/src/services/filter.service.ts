import type { Lead } from "../domain/lead";
import type { FilterRule, FilterResult } from "../domain/filtering";

type LeadInput = Omit<Lead, "id" | "created_at">;

/**
 * Apply the deterministic L2 filter. Returns the first matching drop rule, or
 * a keep verdict. Block rules use case-insensitive substring matching; floor
 * rules drop leads whose value falls below the threshold.
 */
export function applyL2Filter(lead: LeadInput, rules: FilterRule[]): FilterResult {
  const name = (lead.name ?? "").toLowerCase();
  const category = (lead.category ?? "").toLowerCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    switch (rule.type) {
      case "category_block": {
        const needle = rule.value.toLowerCase();
        if (needle && category.includes(needle)) {
          return { verdict: "drop", reason: `category matches blocked term "${rule.value}"`, layer: "L2" };
        }
        break;
      }
      case "name_block": {
        const needle = rule.value.toLowerCase();
        if (needle && name.includes(needle)) {
          return { verdict: "drop", reason: `name matches blocked term "${rule.value}"`, layer: "L2" };
        }
        break;
      }
      case "price_min": {
        const floor = parseFloat(rule.value);
        if (!Number.isNaN(floor) && lead.price_level != null && lead.price_level < floor) {
          return { verdict: "drop", reason: `price_level ${lead.price_level} below minimum ${floor}`, layer: "L2" };
        }
        break;
      }
      case "rating_min": {
        const floor = parseFloat(rule.value);
        if (!Number.isNaN(floor) && lead.rating != null && lead.rating < floor) {
          return { verdict: "drop", reason: `rating ${lead.rating} below minimum ${floor}`, layer: "L2" };
        }
        break;
      }
      case "reviews_min": {
        const floor = parseFloat(rule.value);
        if (!Number.isNaN(floor) && lead.reviews != null && lead.reviews < floor) {
          return { verdict: "drop", reason: `reviews ${lead.reviews} below minimum ${floor}`, layer: "L2" };
        }
        break;
      }
    }
  }

  return { verdict: "keep", reason: null, layer: null };
}
