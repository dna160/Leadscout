/**
 * Phase 2 — I5 Outreach generation prompt (Bahasa Indonesia, formal B2B)
 *
 * Generates WhatsApp message + email (subject + body) for a qualified lead.
 * Tone: formal, uses Bapak/Ibu, professional structured paragraphs.
 * Offer: segment-appropriate cut tier + free tasting (hot/warm) or sample box (cold).
 * Grounding: ONLY reference cuts/dishes explicitly present in the context bundle.
 */

export const MESSAGE_SYSTEM_PROMPT = `Anda adalah manajer penjualan profesional untuk distributor A5 Wagyu Jepang premium yang menargetkan restoran dan hotel berbintang di Indonesia.

Tugas Anda adalah menulis materi outreach B2B dalam Bahasa Indonesia yang formal dan profesional. Selalu gunakan Bapak/Ibu sebagai sapaan.

ATURAN UTAMA (wajib diikuti — pelanggaran = gagal):
1. HANYA sebutkan potongan daging / hidangan yang ADA dalam konteks yang diberikan. Jangan mengarang atau mengasumsikan menu.
2. Jika tidak ada potongan spesifik dalam konteks, gunakan kategori umum sesuai tier (contoh: "potongan premium kami", "gyutan dan harami kami").
3. Selalu sesuaikan penawaran dengan segmen: HOT/WARM → tasting gratis + daftar harga; COLD → sample box potongan tertier + daftar harga.
4. Gunakan bahasa formal, sopan, dan terstruktur. Hindari bahasa gaul atau terlalu casual.
5. WhatsApp: maksimal 160 kata, satu paragraf, langsung ke CTA.
6. Email body: 3-4 paragraf terstruktur (salam → nilai → penawaran → CTA + tanda tangan).
7. Tidak ada frase AI ("saya adalah AI", "sebagai AI", dll).
8. Tidak ada klaim palsu ("terpercaya sejak 1999", dll) kecuali ada dalam konteks.

Respond ONLY dengan JSON valid (tanpa markdown):
{
  "whatsapp": "teks pesan WhatsApp...",
  "email_subject": "Subjek email...",
  "email_body": "Badan email lengkap...",
  "referenced_cuts": ["cut1", "cut2"],
  "offer_tier": "primary" | "secondary" | "tertiary",
  "notes": "satu kalimat catatan opsional"
}`;

export interface MessageInput {
  venueName: string;
  city: string | null;
  segment: "hot" | "warm" | "cold";
  cutFit: string[];
  offerHook: string;       // from SEGMENT_OFFERS
  offerCta: string;        // from SEGMENT_OFFERS
  emailSubject: string;    // template from SEGMENT_OFFERS (venue name interpolated)
  contextSnippets: string[];
  contactPerson: string | null;
  contactRole: string | null;
  availableCuts: string[]; // cuts/dishes found in context — grounding set
}

export function buildMessageUserMessage(input: MessageInput): string {
  const salutation = input.contactPerson
    ? `${input.contactRole ? `Bapak/Ibu ${input.contactPerson} (${input.contactRole})` : `Bapak/Ibu ${input.contactPerson}`}`
    : "Bapak/Ibu";

  const segmentLabel: Record<string, string> = {
    hot: "HOT — sudah melayani A5 Wagyu, fokus showcase potongan utama + upsell",
    warm: "WARM — restoran premium, belum terlihat A5, cocok untuk upgrade",
    cold: "COLD — venue Jepang/premium adjacent, outlet potongan tertier (gyutan, harami)",
  };

  const groundingList =
    input.availableCuts.length > 0
      ? input.availableCuts.join(", ")
      : "(tidak ada potongan spesifik dalam konteks — gunakan kategori umum)";

  const contextBlock =
    input.contextSnippets.length > 0
      ? input.contextSnippets.slice(0, 10).map((s, i) => `[${i + 1}] ${s}`).join("\n\n")
      : "(tidak ada konteks web tersedia)";

  return `VENUE: ${input.venueName} — ${input.city ?? "Indonesia"}
SAPAAN: ${salutation}
SEGMEN: ${segmentLabel[input.segment] ?? input.segment}
PENAWARAN: ${input.offerHook}
CTA: ${input.offerCta}
SUBJEK EMAIL YANG DISARANKAN: ${input.emailSubject.replace("{venue}", input.venueName)}

POTONGAN/HIDANGAN YANG DIIZINKAN UNTUK DISEBUTKAN (dari konteks):
${groundingList}

KONTEKS WEB:
${contextBlock}

Tulis materi outreach sesuai instruksi sistem.`;
}

export interface MessageOutput {
  whatsapp: string;
  email_subject: string;
  email_body: string;
  referenced_cuts: string[];
  offer_tier: "primary" | "secondary" | "tertiary";
  notes?: string;
}
