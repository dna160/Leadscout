import type { Segment } from "./lead";

export const DEFAULT_KEYWORD_SETS: Array<{
  segment: Segment;
  label: string;
  keywords: string[];
}> = [
  {
    segment: "hot",
    label: "Hot Prospects",
    keywords: ["fine dining", "steakhouse", "yakiniku"],
  },
  {
    segment: "warm",
    label: "Warm Prospects",
    keywords: ["japanese restaurant", "korean bbq", "teppanyaki"],
  },
  {
    segment: "cold",
    label: "Cold Prospects",
    keywords: ["casual dining"],
  },
];

export const DEFAULT_CITIES: Array<{ name: string; query: string }> = [
  { name: "Jakarta", query: "Jakarta" },
  { name: "Bali", query: "Bali" },
  { name: "Bandung", query: "Bandung" },
  { name: "Surabaya", query: "Surabaya" },
  { name: "Semarang", query: "Semarang" },
];
