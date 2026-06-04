import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { DEFAULT_KEYWORD_SETS, DEFAULT_CITIES } from "../../domain/segment";

async function migrate() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://leadscout:leadscout@localhost:5432/leadscout";

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log("Running migrations...");

    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await client.query(schemaSql);
    console.log("Schema applied.");

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
      console.log(`Seeded ${DEFAULT_KEYWORD_SETS.length} keyword sets.`);
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
      console.log(`Seeded ${DEFAULT_CITIES.length} cities.`);
    }

    console.log("Migration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
