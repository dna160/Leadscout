import { env } from "../../lib/env";
import { logger } from "../../lib/logger";
import { ok, err, type Result } from "../../lib/result";

export type TriageVerdict = "keep" | "maybe" | "drop";
export interface TriageResult {
  verdict: TriageVerdict;
  reason: string;
}

export async function triageLead(lead: {
  name: string;
  category: string | null;
  price_level: number | null;
  rating: number | null;
  reviews: number | null;
  address: string | null;
}): Promise<Result<TriageResult, { message: string }>> {
  if (!env.DEEPSEEK_API_KEY) {
    return ok({ verdict: "keep", reason: "triage disabled — no API key" });
  }

  const prompt = `You are evaluating whether a venue is a genuine premium restaurant target for a Japanese wagyu/steakhouse outreach campaign in Indonesia.

Venue details:
- Name: ${lead.name}
- Category: ${lead.category ?? "unknown"}
- Price level: ${lead.price_level ?? "unknown"} (1=cheap, 4=luxury)
- Rating: ${lead.rating ?? "unknown"}
- Reviews: ${lead.reviews ?? "unknown"}
- Address: ${lead.address ?? "unknown"}

Respond with ONLY valid JSON: {"verdict": "keep"|"maybe"|"drop", "reason": "one sentence"}

keep = clearly premium restaurant (fine dining, steakhouse, wagyu specialist, upscale Japanese)
maybe = plausibly on-target but uncertain (mid-range, limited info)
drop = clearly off-target (fast food, convenience, budget, irrelevant)`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 100,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return err({ message: `DeepSeek API error ${response.status}: ${text}` });
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as { verdict?: string; reason?: string };

    const verdict: TriageVerdict = ["keep", "maybe", "drop"].includes(parsed.verdict ?? "")
      ? (parsed.verdict as TriageVerdict)
      : "maybe";

    return ok({ verdict, reason: parsed.reason ?? "no reason given" });
  } catch (e) {
    const error = e as Error;
    logger.warn({ error: error.message }, "DeepSeek triage failed — defaulting to keep");
    return ok({ verdict: "keep", reason: `triage error: ${error.message}` });
  }
}
