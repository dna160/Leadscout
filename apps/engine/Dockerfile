# ── LeadScout Engine ──────────────────────────────────────────────
# Railway config: Root Directory = apps/engine
# Build context is apps/engine/ — no workspace files present
# ──────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN pnpm install

# ── Runner ────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY tests/fixtures ./tests/fixtures

EXPOSE 4000
CMD ["pnpm", "start"]
