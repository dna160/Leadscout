import { Pool } from "pg";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export const pool: Pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (global._pgPool ?? (global._pgPool = createPool()));
