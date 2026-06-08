export type SuppressionReason = "unsubscribe" | "bounce" | "complaint" | "manual";
export type SuppressionType  = "email" | "phone";

export interface Suppression {
  id: string;
  value: string;
  type: SuppressionType;
  reason: SuppressionReason;
  created_at: Date;
}

/** Bahasa + English opt-out phrases that auto-trigger suppression */
export const OPT_OUT_PHRASES = [
  "berhenti", "unsubscribe", "stop", "hapus", "jangan kirim",
  "tidak mau", "tidak berminat", "terima kasih tidak", "opt out",
];

export function detectOptOut(text: string): boolean {
  const lower = text.toLowerCase();
  return OPT_OUT_PHRASES.some((phrase) => lower.includes(phrase));
}
