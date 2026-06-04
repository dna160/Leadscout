# ── LeadScout Dashboard ───────────────────────────────────────────
# Railway config: Root Directory = apps/dashboard
# Build context is apps/dashboard/ — no workspace files present
# ──────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN pnpm install

# ── Builder ───────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ENGINE_URL must be set as a Railway build variable
# so it is baked into the static bundle at build time
ARG NEXT_PUBLIC_ENGINE_URL=http://localhost:4000
ENV NEXT_PUBLIC_ENGINE_URL=${NEXT_PUBLIC_ENGINE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone output (next.config.ts: output: "standalone")
COPY --from=builder /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
