# syntax=docker/dockerfile:1

# Impulse Billiards — Payload CMS images.
#
# Built from the monorepo root (build context = repo root). Uses Turborepo
# `prune` to derive a lockfile-consistent subset so any current/future @repo/*
# package is picked up automatically (no frozen-lockfile mismatch when a new
# workspace package is added).
#
# Two final images (built from the same stages):
#   runner   (default)  — standalone Next.js server (`node server.js`), no source
#   migrator (--target) — `payload` CLI + config + migrations for `payload migrate`

FROM node:22-alpine AS base
# libc6-compat required by native addons (sharp) on musl/Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
# Point pnpm's store at the BuildKit cache mount. PNPM_HOME only relocates the
# pnpm binary; the store dir is independent, so set it explicitly.
RUN pnpm config set store-dir /pnpm/store

# --- Pruner: lockfile-consistent subset of the monorepo for apps/cms. ---
FROM base AS pruner
WORKDIR /app
# Pin to the repo's Turbo version (root package.json -> turbo ^2.10.9).
RUN npm install --global turbo@2.10.9
COPY . .
# Emits out/json (pruned manifests), out/pnpm-lock.yaml (pruned lockfile),
# out/full (pruned source).
RUN turbo prune cms --docker

# --- Deps: full dependency graph (build needs dev deps too). ---
FROM base AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- Builder: build via Turborepo's task graph, then strip dev deps. ---
FROM base AS builder
WORKDIR /app

# Build-time env scaffolding. payload.config.ts is imported during `next build`,
# but every value it reads has a `|| ""` fallback, so the build passes with no
# env vars at all. Secrets are deliberately NOT declared here (ARG/ENV for
# PAYLOAD_SECRET is a security anti-pattern and is flagged by linters) — supply
# them at RUNTIME via compose `environment` (compose.prod.yml).
#   DATABASE_URL   — imported at build (postgresAdapter pool), but the adapter
#                    does not connect during build; "" is fine. Real value: runtime.
#   PAYLOAD_SECRET — imported at build (buildConfig secret), "" is fine at build;
#                    real value: runtime. Never pass via --build-arg.
ARG DATABASE_URL=""
ENV DATABASE_URL=$DATABASE_URL
# If a future change makes a secret REQUIRED at build time, use BuildKit secrets:
#   docker build --secret id=secret,src=... ; RUN --mount=type=secret,id=secret ...

ENV NEXT_TELEMETRY_DISABLED=1

# Full node_modules tree (root store + per-package symlinks/.bin). pnpm creates
# apps/cms/node_modules and packages/*/node_modules, which `next build`/
# `cross-env` need — copying only the root store is not enough.
COPY --from=deps /app ./
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
# Respect upstream @repo/* builds and Turborepo's cache. `turbo` is installed as
# a root devDependency (available in node_modules/.bin), so run it via pnpm.
RUN pnpm exec turbo run build --filter=cms

# --- Migrator: runs `payload migrate` in CI (single-phase, before deploy). ---
FROM base AS migrator
ENV NODE_ENV=production
ENV PAYLOAD_CONFIG_PATH="/app/apps/cms/src/payload.config.ts"
ENV PATH="/app/apps/cms/node_modules/.bin:${PATH}"
WORKDIR /app
# Reuse the same frozen-lockfile install as the builder (no second install).
# `payload` is a prod dep so `payload migrate` works; the extra dev deps are
# harmless in this transient `run --rm` image.
COPY --from=deps /app ./
# Config + collections + migrations source (only what the CLI needs).
COPY --from=pruner /app/out/full/ .
WORKDIR /app/apps/cms
CMD ["payload", "migrate"]

# --- Runner: minimal standalone runtime (no source, no full node_modules). ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

WORKDIR /app
# Standalone traced server (nested under apps/cms due to outputFileTracingRoot).
COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/cms/.next/static ./apps/cms/.next/static

USER nextjs
EXPOSE 3000

# /api/health already exists (GET -> 200 with DB ping; 503 on failure).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "apps/cms/server.js"]
