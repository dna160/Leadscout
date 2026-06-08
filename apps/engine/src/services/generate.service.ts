/**
 * Phase 2 I5 — Outreach generation (Bahasa, cut-aware, grounded)
 * Phase 2 I6 — PDF deck generation (pdfkit, placeholder template)
 *
 * I5 grounding contract:
 *  - Extract the set of cut/dish tokens present in the context bundle
 *  - After generation: verify each referenced_cut exists in context OR in the
 *    category-level fallback set for that segment
 *  - Violation → regenerate once with stricter prompt
 *  - Still fails → use category-level fallback copy (no invented items), flag_for_review
 */

import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";
import { ok, err, type Result } from "../lib/result";
import { env } from "../lib/env";
import type { Lead, Segment } from "../domain/lead";
import {
  MESSAGE_SYSTEM_PROMPT,
  buildMessageUserMessage,
  type MessageOutput,
} from "../infra/llm/prompts/message.v1";
import { SEGMENT_OFFERS, ALL_CUT_TOKENS } from "../domain/outreach";
import { getLeadContext } from "../repositories/context.repository";
import { replaceAsset } from "../repositories/asset.repository";

export type GenerateError = { message: string };

const PROMPT_VERSION = "message.v1";
const MAX_RETRIES = 2; // first attempt + one regenerate on grounding fail

// ── Grounding helpers ──────────────────────────────────────────────────────

/** Extract cut/dish tokens from a context bundle (signals + raw_text) */
function extractContextCuts(signals: string[], rawText: string | null): Set<string> {
  const found = new Set<string>();
  const haystack = [...signals, rawText ?? ""].join(" ").toLowerCase();
  for (const token of ALL_CUT_TOKENS) {
    if (haystack.includes(token.toLowerCase())) {
      found.add(token.toLowerCase());
    }
  }
  return found;
}

/** Validate that every referenced_cut in LLM output exists in the allowed set */
function validateGrounding(referencedCuts: string[], allowedCuts: Set<string>): string[] {
  return referencedCuts.filter(cut => !allowedCuts.has(cut.toLowerCase()));
}

// ── DeepSeek call ──────────────────────────────────────────────────────────

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callDeepSeekGenerate(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
  signals: string[],
  rawText: string | null,
  availableCuts: string[],
  strictGrounding: boolean,
): Promise<Result<MessageOutput, GenerateError>> {
  if (!env.DEEPSEEK_API_KEY) {
    return err({ message: "DEEPSEEK_API_KEY not set" });
  }

  const offer = SEGMENT_OFFERS[segment];
  const emailSubject = offer.emailSubject.replace("{venue}", lead.name);

  const userMessage = buildMessageUserMessage({
    venueName: lead.name,
    city: lead.city,
    segment,
    cutFit: lead.cut_fit,
    offerHook: offer.whatsappHook,
    offerCta: offer.cta,
    emailSubject,
    contextSnippets: signals.slice(0, 10),
    contactPerson: lead.contact_person,
    contactRole: lead.contact_role,
    availableCuts,
  });

  const systemPrompt = strictGrounding
    ? MESSAGE_SYSTEM_PROMPT +
      "\n\nPERINGATAN KETAT: Upaya sebelumnya mengandung potongan daging yang tidak ada dalam konteks. " +
      "Hanya gunakan potongan dari daftar YANG DIIZINKAN atau istilah kategori umum jika daftar kosong."
    : MESSAGE_SYSTEM_PROMPT;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        if (attempt < 2 && response.status >= 500) {
          await sleep(2000 * attempt);
          continue;
        }
        return err({ message: `DeepSeek HTTP ${response.status}: ${text}` });
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(content) as Partial<MessageOutput>;

      if (!parsed.whatsapp || !parsed.email_subject || !parsed.email_body) {
        if (attempt < 2) { await sleep(2000); continue; }
        return err({ message: "LLM returned incomplete output" });
      }

      return ok({
        whatsapp: parsed.whatsapp,
        email_subject: parsed.email_subject,
        email_body: parsed.email_body,
        referenced_cuts: Array.isArray(parsed.referenced_cuts) ? parsed.referenced_cuts : [],
        offer_tier: parsed.offer_tier ?? "primary",
        notes: parsed.notes,
      });
    } catch (e) {
      const error = e as Error;
      if (attempt < 2) { await sleep(2000); continue; }
      return err({ message: error.message });
    }
  }
  return err({ message: "Max retries exceeded" });
}

// ── Category-level fallback copy (no invented items) ──────────────────────

function buildFallbackCopy(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
): MessageOutput {
  const venueName = lead.name;
  const city = lead.city ?? "Indonesia";

  const fallbacks: Record<"hot" | "warm" | "cold", MessageOutput> = {
    hot: {
      whatsapp: `Selamat siang Bapak/Ibu, saya dari tim A5 Wagyu kami. Kami mengetahui ${venueName} menyajikan menu premium berkualitas tinggi. Kami ingin mengundang Bapak/Ibu untuk sesi tasting A5 Wagyu eksklusif secara gratis beserta daftar harga lengkap. Mohon konfirmasi kesediaan Bapak/Ibu. Terima kasih.`,
      email_subject: `Undangan Eksklusif: Sesi Tasting A5 Wagyu Gratis untuk ${venueName}`,
      email_body: `Yth. Bapak/Ibu Manajemen ${venueName},\n\nSemoga Bapak/Ibu dalam keadaan sehat. Perkenalkan, kami dari distributor A5 Wagyu Jepang premium untuk pasar Indonesia.\n\nKami sangat mengagumi komitmen ${venueName} dalam menyajikan pengalaman kuliner berkelas. Sebagai langkah awal kerja sama, kami ingin mengundang Bapak/Ibu untuk sesi tasting A5 Wagyu pilihan kami secara gratis, sekaligus menyampaikan daftar harga dan program distribusi.\n\nMohon konfirmasi ketersediaan waktu Bapak/Ibu agar kami dapat mengatur pertemuan yang sesuai.\n\nHormat kami,\nTim A5 Wagyu Indonesia`,
      referenced_cuts: [],
      offer_tier: "primary",
      notes: "fallback copy — no context available",
    },
    warm: {
      whatsapp: `Selamat siang Bapak/Ibu, kami dari tim distribusi A5 Wagyu Jepang. ${venueName} sangat cocok untuk menghadirkan A5 Wagyu sebagai andalan menu premium. Kami siap menawarkan sesi tasting gratis dan daftar harga. Mohon konfirmasi ketersediaan Bapak/Ibu. Terima kasih.`,
      email_subject: `Peluang Premium: A5 Wagyu untuk Menu ${venueName}`,
      email_body: `Yth. Bapak/Ibu Manajemen ${venueName},\n\nSemoga Bapak/Ibu selalu sehat. Kami dari distributor A5 Wagyu Jepang terpercaya di Indonesia.\n\nMelihat kualitas dan konsep ${venueName} di ${city}, kami yakin A5 Wagyu kami akan menjadi nilai tambah yang signifikan bagi menu premium Bapak/Ibu. A5 Wagyu dikenal dengan kelembutan dan marbling yang tak tertandingi, sangat sesuai untuk venue kelas atas.\n\nKami mengundang Bapak/Ibu untuk sesi tasting gratis beserta daftar harga kompetitif. Silakan konfirmasi waktu yang tersedia.\n\nHormat kami,\nTim A5 Wagyu Indonesia`,
      referenced_cuts: [],
      offer_tier: "primary",
      notes: "fallback copy — no context available",
    },
    cold: {
      whatsapp: `Selamat siang Bapak/Ibu, kami dari tim distribusi A5 Wagyu. Kami memiliki program khusus untuk venue seperti ${venueName}: sample box gyutan dan harami A5 Wagyu secara gratis beserta daftar harga potongan kami. Berminat? Mohon konfirmasi Bapak/Ibu. Terima kasih.`,
      email_subject: `Sample Box Wagyu Premium untuk ${venueName} — Tanpa Biaya`,
      email_body: `Yth. Bapak/Ibu Manajemen ${venueName},\n\nSemoga Bapak/Ibu dalam keadaan baik. Perkenalkan, kami dari distributor A5 Wagyu Jepang premium.\n\nKami memiliki program khusus untuk mitra kuliner seperti ${venueName}: sample box potongan premium kami (gyutan dan harami A5 Wagyu) tanpa biaya, dilengkapi daftar harga untuk program distribusi jangka panjang.\n\nPotongan-potongan ini sangat cocok untuk menu izakaya, hidangan khas Jepang, maupun menu donburi premium. Kami yakin ini akan menjadi nilai tambah menarik bagi ${venueName}.\n\nMohon konfirmasi ketersediaan Bapak/Ibu untuk pengiriman sample box.\n\nHormat kami,\nTim A5 Wagyu Indonesia`,
      referenced_cuts: ["gyutan", "harami"],
      offer_tier: "tertiary",
      notes: "fallback copy — no context available",
    },
  };

  return fallbacks[segment];
}

// ── PDF deck (I6) ──────────────────────────────────────────────────────────

const DECKS_DIR = path.join(process.cwd(), "decks");

async function generateDeck(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
  contextSnippets: string[],
): Promise<Result<string, GenerateError>> {
  try {
    // Ensure decks directory exists
    if (!fs.existsSync(DECKS_DIR)) fs.mkdirSync(DECKS_DIR, { recursive: true });

    // Try to load pdfkit dynamically (optional dep — graceful if missing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let PDFDocument: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PDFDocument = require("pdfkit");
    } catch {
      return err({ message: "pdfkit not installed — deck generation skipped" });
    }

    const filePath = path.join(DECKS_DIR, `${lead.id}-deck.pdf`);

    const offer = SEGMENT_OFFERS[segment];
    const segmentLabel: Record<string, string> = {
      hot: "HOT — A5 Wagyu Showcase Partner",
      warm: "WARM — Premium Upgrade Opportunity",
      cold: "COLD — Premium Cut Supply Partner",
    };

    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Cover
      doc.fontSize(28).font("Helvetica-Bold").text("A5 Wagyu Indonesia", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(18).font("Helvetica").text(lead.name, { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(12).fillColor("#666").text(lead.city ?? "Indonesia", { align: "center" });
      doc.moveDown(2);
      doc.fontSize(14).fillColor("#000").text(segmentLabel[segment] ?? segment, { align: "center" });
      doc.addPage();

      // Why A5
      doc.fontSize(20).font("Helvetica-Bold").text("Mengapa A5 Wagyu?");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").text(
        "A5 adalah grade tertinggi dalam sistem penilaian Wagyu Jepang — marbling sempurna (BMS 8-12), " +
        "tekstur yang meleleh di mulut, dan rasa umami yang tak tertandingi. " +
        "Produk ini menjadi daya tarik utama di restoran premium dan hotel berbintang.",
        { lineGap: 4 },
      );
      doc.moveDown(1);

      // Cut fit
      doc.fontSize(16).font("Helvetica-Bold").text("Potongan yang Kami Rekomendasikan");
      doc.moveDown(0.5);
      const cutLines = offer.sampleCuts.map(c => `• ${c.charAt(0).toUpperCase() + c.slice(1)}`);
      doc.fontSize(11).font("Helvetica").text(cutLines.join("\n"), { lineGap: 6 });
      doc.moveDown(1);

      // Context excerpt (if available)
      if (contextSnippets.length > 0) {
        doc.fontSize(13).font("Helvetica-Bold").text("Yang Kami Ketahui Tentang " + lead.name);
        doc.moveDown(0.4);
        doc.fontSize(10).font("Helvetica").fillColor("#444").text(
          contextSnippets.slice(0, 3).join(" ").slice(0, 400),
          { lineGap: 3 },
        );
        doc.moveDown(1);
      }
      doc.fillColor("#000");
      doc.addPage();

      // Offer & CTA
      doc.fontSize(20).font("Helvetica-Bold").text("Penawaran untuk " + lead.name);
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica").text(offer.whatsappHook, { lineGap: 4 });
      doc.moveDown(1);
      doc.fontSize(14).font("Helvetica-Bold").text("Langkah Selanjutnya:");
      doc.moveDown(0.3);
      doc.fontSize(12).font("Helvetica").text(offer.cta, { lineGap: 4 });
      doc.moveDown(2);

      // Contact
      doc.fontSize(12).text("Hubungi kami:");
      doc.fontSize(11).fillColor("#555").text("Tim A5 Wagyu Indonesia\nWhatsApp / Email: [contact details]");

      doc.end();
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    return ok(filePath);
  } catch (e) {
    const error = e as Error;
    return err({ message: `Deck generation failed: ${error.message}` });
  }
}

// ── Main generate function ─────────────────────────────────────────────────

export async function generateLeadAssets(
  lead: Lead,
  segment: "hot" | "warm" | "cold",
): Promise<Result<{ whatsappId: string; emailId: string; deckId?: string }, GenerateError>> {
  // Fetch context
  const ctxResult = await getLeadContext(lead.id);
  const context = ctxResult.ok ? ctxResult.value : null;
  const signals = context?.signals ?? [];
  const rawText = context?.raw_text ?? null;

  // Build grounding set
  const allowedCuts = extractContextCuts(signals, rawText);
  const availableCutsArr = [...allowedCuts];

  // First generation attempt
  let messageOutput: MessageOutput | null = null;
  let flagForReview = false;

  const firstAttempt = await callDeepSeekGenerate(lead, segment, signals, rawText, availableCutsArr, false);

  if (firstAttempt.ok) {
    const violations = validateGrounding(firstAttempt.value.referenced_cuts, allowedCuts);
    if (violations.length === 0) {
      messageOutput = firstAttempt.value;
    } else {
      logger.warn(
        { leadId: lead.id, violations },
        "I5 grounding violation — regenerating with strict prompt",
      );
      // Regenerate once with stricter prompt
      const secondAttempt = await callDeepSeekGenerate(lead, segment, signals, rawText, availableCutsArr, true);
      if (secondAttempt.ok) {
        const v2 = validateGrounding(secondAttempt.value.referenced_cuts, allowedCuts);
        if (v2.length === 0) {
          messageOutput = secondAttempt.value;
        } else {
          logger.warn({ leadId: lead.id, v2 }, "I5 grounding still violated after retry → fallback copy");
          messageOutput = buildFallbackCopy(lead, segment);
          flagForReview = true;
        }
      } else {
        messageOutput = buildFallbackCopy(lead, segment);
        flagForReview = true;
      }
    }
  } else {
    logger.warn({ leadId: lead.id, error: firstAttempt.error }, "Generation failed → fallback copy");
    messageOutput = buildFallbackCopy(lead, segment);
    flagForReview = true;
  }

  const notes = flagForReview
    ? "⚠️ Fallback copy — grounding violation detected. Please review before sending."
    : messageOutput.notes;

  // Persist WhatsApp asset
  const waResult = await replaceAsset(lead.id, {
    type: "whatsapp",
    content: messageOutput.whatsapp + (notes ? `\n\n[Note: ${notes}]` : ""),
    model: "deepseek-chat",
    prompt_version: PROMPT_VERSION,
  });
  if (!waResult.ok) return err({ message: waResult.error.message });

  // Persist email asset
  const emailContent = `Subject: ${messageOutput.email_subject}\n\n${messageOutput.email_body}`;
  const emailResult = await replaceAsset(lead.id, {
    type: "email",
    content: emailContent + (notes ? `\n\n[Note: ${notes}]` : ""),
    model: "deepseek-chat",
    prompt_version: PROMPT_VERSION,
  });
  if (!emailResult.ok) return err({ message: emailResult.error.message });

  // Generate PDF deck (I6)
  const contextSnippets = signals.slice(0, 5);
  const deckResult = await generateDeck(lead, segment, contextSnippets);
  let deckId: string | undefined;

  if (deckResult.ok) {
    const deckAsset = await replaceAsset(lead.id, {
      type: "deck",
      file_path: deckResult.value,
      model: "pdfkit",
      prompt_version: "deck.v1",
    });
    if (deckAsset.ok) deckId = deckAsset.value.id;
  } else {
    logger.warn({ leadId: lead.id, error: deckResult.error }, "Deck generation failed — continuing");
  }

  logger.info(
    { leadId: lead.id, segment, flagForReview, deckId },
    "Lead assets generated",
  );

  return ok({
    whatsappId: waResult.value.id,
    emailId: emailResult.value.id,
    deckId,
  });
}

/** Batch generate for a set of classified (non-drop) leads */
export async function generateLeadsBatch(
  leads: Lead[],
): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(l => {
        const seg = (l.segment ?? "warm") as "hot" | "warm" | "cold";
        const safeSegment: "hot" | "warm" | "cold" = ["hot", "warm", "cold"].includes(seg) ? seg : "warm";
        return generateLeadAssets(l, safeSegment);
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) generated++;
      else failed++;
    }
  }

  return { generated, failed };
}
