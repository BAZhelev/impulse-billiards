# syntax=docker/dockerfile:1

# Impulse Billiards — Payload CMS image.
#
# Built from the monorepo root (build context = repo root) so the workspace
# packages (`@repo/*`) resolve during `next build`. Runs `next start`; Payload
# applies pending migrations on startup via `prodMigrations` (src/payload.config.ts).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm

# 1. Install dependencies — layer is cached on the lockfile + workspace manifests.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/cms/package.json ./apps/cms/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile

# 2. Build the CMS app.
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter cms build

# 3. Runtime image.
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app ./
USER nextjs
EXPOSE 3000
WORKDIR /app/apps/cms
CMD ["node", "node_modules/next/dist/bin/next", "start"]
