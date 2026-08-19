# Impulse Billiards — CMS

[Payload CMS](https://payloadcms.com/) (Node.js + PostgreSQL) for the Impulse
Billiards site. Provides the admin panel and content API that `apps/web`
consumes at build time.

## Prerequisites

- Node.js >= 20.9, pnpm 9
- [Docker](https://www.docker.com/) (for local PostgreSQL)

## Local setup

1. Copy the env templates:

   ```sh
   cp .env.example .env
   cp .env.test.example .env.test
   ```

   - `.env` — dev config: `PORT` (default `3001`), `DATABASE_URL`, `PAYLOAD_SECRET`
   - `.env.test` — test config (uses the isolated `cms_test` database)

2. Start PostgreSQL (Payload creates the `cms` and `cms_test` databases and
   their schema automatically on first connect):

   ```sh
   pnpm db:provision
   ```

3. Start the dev server:

   ```sh
   pnpm dev
   ```

   The admin panel is at `http://localhost:3001/admin`. The `predev` hook
   provisions the database before the server starts.

## Scripts

| Command             | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `pnpm dev`          | Start the dev server (provisions Postgres first)              |
| `pnpm db:provision` | Start Postgres and wait for it to be ready                    |
| `pnpm test:int`     | Integration tests (Vitest) against the `cms_test` database    |
| `pnpm test:e2e`     | End-to-end tests (Playwright) against the `cms_test` database |
| `pnpm test`         | Unit tests (placeholder — none yet)                           |

## Collections

- **Users** — auth-enabled; has access to the admin panel.
- **Media** — upload-enabled, with alt text.

See the [Payload docs](https://payloadcms.com/docs) for extending collections.
