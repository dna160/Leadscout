import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://leadscout:leadscout@localhost:5432/leadscout",
      APIFY_MOCK: "true",
    },
  },
});
