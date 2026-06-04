import type { Segment } from "./lead";
export const SEGMENT_LABELS: Record<Segment, string> = { hot:"Hot", warm:"Warm", cold:"Cold", drop:"Drop" };
export const SEGMENT_COLOURS: Record<Segment, string> = {
  hot: "bg-red-100 text-red-800 border-red-200",
  warm: "bg-amber-100 text-amber-800 border-amber-200",
  cold: "bg-blue-100 text-blue-800 border-blue-200",
  drop: "bg-gray-100 text-gray-600 border-gray-200",
};
