# Impulse Billiards

A [Turborepo](https://turborepo.dev) monorepo for the Impulse Billiards website
and its content management system.

## Overview

Impulse Billiards is a billiards website managed through a headless CMS. The
project is a pnpm + Turborepo monorepo with two applications:

| App        | Type                                                          | Purpose                                             |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `apps/web` | Static [Next.js](https://nextjs.org/) export                  | Public website, served via CDN                      |
| `apps/cms` | [Payload CMS](https://payloadcms.com/) (Node.js + PostgreSQL) | Headless CMS: content management, admin panel & API |

Shared configuration lives in [`packages/`](packages):

- `@repo/eslint-config` — shared ESLint configuration
- `@repo/typescript-config` — shared TypeScript configuration

## Goals

- **Simple and low-cost** — a static site on Cloudflare Pages, compute on
  affordable Hetzner VPSes, and minimal third-party dependencies.
- **Content-managed** — editors publish through Payload CMS, and publishes
  trigger automatic site rebuilds.
- **Operationally clear** — Docker Compose instead of Kubernetes, a small
  provider footprint, and documented, repeatable deployments.

## Tech stack

- [Next.js](https://nextjs.org/) (static export) — `apps/web`
- [Payload CMS](https://payloadcms.com/) + [PostgreSQL](https://www.postgresql.org/) — `apps/cms`
- [Turborepo](https://turborepo.dev) + [pnpm](https://pnpm.io) — monorepo tooling
- [Docker Compose](https://docs.docker.com/compose/) — local Postgres (server deployment to be added)

## Repository structure

```
├── apps/
│   ├── web/   # Static Next.js — public website
│   └── cms/   # Payload CMS — admin + API
├── packages/
│   ├── eslint-config/     # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── .docs/                 # Architecture & operational documentation
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.9
- [pnpm](https://pnpm.io/) 9 (pinned to `pnpm@9.0.0` via `packageManager`)

### Install

```sh
pnpm install
```

### Environment variables

Each app reads its own `.env` (Next.js loads it from the app's directory):

- `apps/web/.env` — `PORT` (default `3000`).
- `apps/cms/.env` — `PORT` (default `3001`), `DATABASE_URL`, `PAYLOAD_SECRET`.
- `apps/cms/.env.test` — test config (isolated `cms_test` database) for `test:int` / `test:e2e`.

### Develop

```sh
pnpm dev
```

Starts both apps: `apps/web` on `http://localhost:3000` and `apps/cms` on
`http://localhost:3001`. The CMS provisions the local Postgres database first
(via its `predev` hook), so Docker must be running.

### Build, lint & type-check

```sh
pnpm build        # build all apps and packages
pnpm lint         # lint all apps and packages
pnpm check-types  # type-check all apps and packages
pnpm test         # run tests
```

### CMS — local database & tests

A root `docker-compose.yml` provides local PostgreSQL:

```sh
docker compose up -d postgres   # or: pnpm --filter cms db:provision
```

The `db:provision` script starts Postgres and waits for it to be ready. Payload
creates the `cms` (dev) and `cms_test` (test) databases and their schema
automatically on first connect.

Tests are separate commands, isolated from dev data via the `cms_test` database:

```sh
pnpm --filter cms test:int   # integration tests (Vitest)
pnpm --filter cms test:e2e   # end-to-end tests (Playwright)
```

> `pnpm test` is reserved for unit tests; integration and e2e tests are separate
> because they need the local database.

## Documentation

Architecture and operational details live in [`.docs/`](.docs):

- [Architecture](.docs/architecture.md)
- [Deployment](.docs/deployment.md)
- [CI/CD](.docs/ci-cd.md)
- [Database & backups](.docs/database.md)
- [Storage](.docs/storage.md)
- [Security](.docs/security.md)
- [Operations](.docs/operations.md)
