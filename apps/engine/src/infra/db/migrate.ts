import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { DEFAULT_KEYWORD_SETS, DEFAULT_CITIES } from "../../domain/segment";

const DEFAULT_FILTER_RULES: Array<{ type: string; value: string; action: string }> = [
  ...[
    "convenience store",
    "supermarket",
    "grocery store",
    "fast food restaurant",
    "minimarket",
    "gas station",
    "pharmacy",
    "atm",
    "bank",
  ].map((value) => ({ type: "category_block", value, action: "block" })),
  ...[
    "Lawson",
    "Indomaret",
    "Alfamart",
    "FamilyMart",
    "Circle K",
    "McDonald's",
    "KFC",
    "Burger King",
    "Subway",
    "Pizza Hut",
    "Domino's",
  ].map((value) => ({ type: "name_block", value, action: "block" })),
  { type: "price_min", value: "2", action: "min" },
  { type: "rating_min", value: "3.5", action: "min" },
  { type: "reviews_min", value: "5", action: "min" },
];

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log("[migrate] Running schema...");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schemaSql);
    console.log("[migrate] Schema applied.");

    // ── Additive column migrations (idempotent) ──
    // schema.sql uses CREATE TABLE IF NOT EXISTS which won't add new columns to
    // existing tables, so apply ALTER TABLE ... ADD COLUMN IF NOT EXISTS here.
    console.log("[migrate] Applying additive column migrations...");
    await client.query(`
      ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,4);
      ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,4);
      ALTER TABLE scrape_runs ADD COLUMN IF NOT EXISTS enrichment BOOLEAN NOT NULL DEFAULT false;

      ALTER TABLE leads ADD COLUMN IF NOT EXISTS price_level INTEGER;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS reject_layer TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS reject_reason TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS triage_verdict TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS matched_keywords JSONB NOT NULL DEFAULT '[]';
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_seen_run UUID REFERENCES scrape_runs(id);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_seen_run UUID REFERENCES scrape_runs(id);
    `);
    console.log("[migrate] Column migrations applied.");

    const kwCount = await client.query("SELECT COUNT(*) FROM keyword_sets");
    if (parseInt(kwCount.rows[0].count) === 0) {
      for (const kw of DEFAULT_KEYWORD_SETS) {
        await client.query(
          `INSERT INTO keyword_sets (segment, label, keywords)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [kw.segment, kw.label, JSON.stringify(kw.keywords)],
        );
      }
      console.log(`[migrate] Seeded ${DEFAULT_KEYWORD_SETS.length} keyword sets.`);
    }

    const cityCount = await client.query("SELECT COUNT(*) FROM target_cities");
    if (parseInt(cityCount.rows[0].count) === 0) {
      for (const city of DEFAULT_CITIES) {
        await client.query(
          `INSERT INTO target_cities (name, query)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [city.name, city.query],
        );
      }
      console.log(`[migrate] Seeded ${DEFAULT_CITIES.length} cities.`);
    }

    const frCount = await client.query("SELECT COUNT(*) FROM filter_rules");
    if (parseInt(frCount.rows[0].count) === 0) {
      for (const rule of DEFAULT_FILTER_RULES) {
        await client.query(
          `INSERT INTO filter_rules (type, value, action)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [rule.type, rule.value, rule.action],
        );
      }
      console.log(`[migrate] Seeded ${DEFAULT_FILTER_RULES.length} filter rules.`);
    }

    console.log("[migrate] Complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow running as standalone script: tsx src/infra/db/migrate.ts
if (require.main === module) {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://leadscout:leadscout@localhost:5432/leadscout";

  runMigrations(connectionString).catch((err) => {
    console.error("[migrate] Failed:", err);
    process.exit(1);
  });
}
