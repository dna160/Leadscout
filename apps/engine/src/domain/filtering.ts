export type FilterRuleType =
  | "category_block"
  | "name_block"
  | "price_min"
  | "rating_min"
  | "reviews_min";

export interface FilterRule {
  id: string;
  type: FilterRuleType;
  value: string;
  action: string;
  enabled: boolean;
  created_at: Date;
}

export type FilterVerdict = "keep" | "drop";

export interface FilterResult {
  verdict: FilterVerdict;
  reason: string | null;
  layer: "L2" | "L3" | null;
}
