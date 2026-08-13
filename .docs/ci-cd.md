# Impulse Billiards — CI/CD

> Last updated: August 2026
> Status: Planned

How code and content move from the repository to production. See [architecture.md](architecture.md) for the high-level overview.

---

## Environments

| Environment    | Purpose                   | Where             | Deploy Trigger                |
| -------------- | ------------------------- | ----------------- | ----------------------------- |
| **Dev**        | Local development         | Developer machine | `pnpm dev` (manual)           |
| **Staging**    | Pre-production validation | VPS #3            | Auto on push to `main`        |
| **Production** | Live site                 | VPS #1 + VPS #2   | Manual promotion from staging |

> **Branches**: `dev` is the active development branch; `main` is integration/production. CI runs on both. Feature branches merge into `dev`; `dev` merges into `main`.

---

## CI Pipeline (`ci.yml`)

Triggers: PR and push to `dev` + `main`

| Step                   | Description                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Checkout               | `actions/checkout@v7`                                                                               |
| Setup                  | pnpm + Node.js 20                                                                                   |
| Install                | `pnpm install --frozen-lockfile`                                                                    |
| Lint                   | `turbo run lint`                                                                                    |
| Type-check             | `turbo run check-types`                                                                             |
| Test                   | `turbo run test`                                                                                    |
| Build CMS Docker image | `docker build -t impulse-cms:${{ github.sha }} apps/cms` (BuildKit `--secret`, never `--build-arg`) |
| Container scan         | Trivy scan the CMS Docker image                                                                     |
| Static export check    | `next build` (`output: 'export'`) for `apps/web`                                                    |
| Push image             | Tag and push to `ghcr.io/<org>/impulse-cms:${{ github.sha }}`                                       |

---

## CD Pipeline — Staging (`deploy-staging.yml`)

Trigger: Push to `main` (auto-deploy to staging)

| Step                 | Description                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Pre-migration backup | pgBackRest backup before any schema change (signal S4)                                           |
| Deploy to staging    | SSH to VPS #3 → `docker compose -f compose.staging.yml pull && up -d`                            |
| Run migrations       | `docker compose -f compose.staging.yml exec cms payload migrate` (signal S1)                     |
| Health check         | `curl /api/health` (signal S2) — see [Migration Failure Detection](#migration-failure-detection) |
| Smoke tests          | `curl` key routes (staging admin, API health) (signal S3)                                        |
| **On failure**       | Restore DB from pre-migration backup + rollback container, alert to Discord                      |

---

## CD Pipeline — Production (`deploy-prod.yml`)

Trigger: Manual (`workflow_dispatch`) — run after staging is verified

| Step                 | Description                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Pre-migration backup | pgBackRest backup before any schema change (signal S4)                                                    |
| Deploy CMS           | SSH to VPS #1 → `docker compose -f compose.prod.yml pull && up -d`                                        |
| Run migrations       | `docker compose -f compose.prod.yml exec cms payload migrate` (signal S1)                                 |
| Health check         | `curl /api/health` (signal S2) — see [Migration Failure Detection](#migration-failure-detection)          |
| Smoke tests          | `curl` key routes (admin, API health) (signal S3)                                                         |
| **On failure**       | Restore DB from pre-migration backup + redeploy previous image (`docker compose up -d`), alert to Discord |

---

## Migration Failure Detection

Deploy pipelines that run migrations detect failure through an explicit, ordered set of signals — the restore/rollback action fires only when one of them triggers. Because drizzle/Payload migrations are **not** wrapped in a single transaction, a migration can apply _halfway_ and exit non-zero; a non-zero exit is therefore treated as a definitive failure and the DB is restored.

| #   | Signal                       | Detection                                          | Action                                                       |
| --- | ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| S4  | Pre-migration backup fails   | pgBackRest exit code ≠ 0                           | Abort the deploy (fail closed) — do not touch code or schema |
| S1  | Migration fails              | `payload migrate` exit code ≠ 0                    | Restore DB from pre-migration backup + rollback container    |
| S2  | App not healthy after deploy | `GET /api/health` ≠ 200 within 12 tries × 5s (60s) | Restore DB + rollback container                              |
| S3  | Smoke test fails             | Key routes return non-200                          | Restore DB + rollback container                              |

### Ordering

1. **S4** — take the pgBackRest backup. If it fails, abort before deploying anything.
2. Deploy the new image (`pull && up -d`).
3. Run `payload migrate`, capture the exit code (**S1**).
4. Health-check loop with a fixed budget of 12 × 5s = 60s (**S2**).
5. Smoke-test key routes (**S3**).
6. Only if 1–5 all pass is the deploy marked successful (pre-migration backup retained 90 days; Discord confirmation).

### `/api/health` contract

`GET /api/health` returns 200 **only** when the CMS is ready **and** the database schema is current — the set of applied migrations matches the bundled migration files. A health check that merely pings DB connectivity would not catch a "migrated but broken" schema, so the endpoint must compare applied migrations (drizzle `migrations` table) against the migration files shipped in the image.

### Rollback scope

- **Migration-related failure** (S1, or S2 after migrations ran) → restore the DB from the pre-migration backup _and_ roll back the container. Docker alone cannot undo a schema change.
- **Pure deploy/startup failure** (S2 before migrations ran) → roll back the container only; the schema was never touched, so the DB restore is skipped. Pipelines track a `migrationsRan` flag to decide.
- **Restore verification** → after restoring, the pipeline re-runs the health check against the rolled-back image before declaring recovery complete.

> **How the rollback works**: Docker Compose has no `--rollback` flag (that's a Swarm feature). "Roll back the container" = re-point the image to the last-known-good `{sha}` tag and run `docker compose up -d` again — the previous image is still in GHCR, so no rebuild is needed.

---

## CD Pipeline — Static Site (`deploy-static.yml`)

Trigger: `workflow_dispatch` (fired by Payload on publish) and push to `main` (code changes to `apps/web`)

| Step              | Description                                                           |
| ----------------- | --------------------------------------------------------------------- |
| Build static site | `turbo run build --filter=web` — fetches published content from CMS   |
| Deploy to Pages   | `wrangler pages deploy apps/web/out --project-name=impulse-billiards` |
| Smoke tests       | `curl` homepage + a content page                                      |
| **On failure**    | Pages auto-rolls back to the previous deployment; alert to Discord    |

**Concurrency**: `concurrency: { group: deploy-static, cancel-in-progress: true }` — overlapping builds cancel, keeping only the latest.

**Preview deployments**: pushes to `dev` produce a preview URL (fetching from the staging CMS) to validate code changes before they reach `main`.

The content-sync trigger that fires this pipeline is described in [deployment.md](deployment.md#content-sync--payload--static-site).

---

## Dependency Management

### Dependabot (weekly, Monday)

| Group             | Contents                                                                                           | Review Policy                        |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `production-deps` | `next`, `react`, `react-dom`, `payload`, `@payloadcms/*`, `pg`, `zod`                              | Review carefully — test before merge |
| `dev-deps`        | `eslint`, `prettier`, `typescript`, `@types/*`, `turbo`, `husky`, `@changesets/*`, `@commitlint/*` | Can merge more freely if CI passes   |
| `ci-actions`      | GitHub Actions dependencies (`actions/*`, `docker/*`, `pnpm/*`)                                    | Review, merge if CI passes           |

### Versioning

- Changesets for changelog generation and version bumps
- Conventional commits enforced via commitlint + husky
