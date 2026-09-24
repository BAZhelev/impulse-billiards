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

| Step                | Description                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| Checkout            | `actions/checkout@v7`                                                           |
| Setup               | pnpm + Node.js 22                                                               |
| Install             | `pnpm install --frozen-lockfile`                                                |
| Lint                | `turbo run lint`                                                                |
| Type-check          | `turbo run check-types`                                                         |
| Test                | `turbo run test`                                                                |
| Audit               | `pnpm audit --audit-level=high`                                                 |
| Static export check | `next build` (`output: 'export'`) for `apps/web`                                |
| Build Docker images | Build `runner` + `migrator` targets (no push) — validates the Dockerfile builds |

---

## CD Pipeline — Staging (`deploy-staging.yml`)

Trigger: Push to `main` (auto-deploy to staging)

| Step                   | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Build & push images    | `runner` → `…-cms:{sha}` + `latest`; `migrator` → `…-cms-migrate:{sha}` + `latest`  |
| Container scan         | Trivy scan the runner image (CRITICAL/HIGH → fail)                                  |
| Sync config            | `scp` `compose.staging.yml` + `Caddyfile` to VPS #3                                 |
| Migrate (single-phase) | `docker compose --profile migrate run --rm migrate` — before deploy, additive       |
| Deploy                 | `docker compose up -d` (caddy + cms + postgres)                                     |
| Health check           | `curl /api/health`, 12 × 5s = 60s budget                                            |
| **On failure**         | Pipeline exits non-zero; re-point `CMS_IMAGE_TAG` to the last-good sha to roll back |

---

## CD Pipeline — Production (`deploy-prod.yml`)

Trigger: Manual (`workflow_dispatch`) — run after staging is verified

| Step                   | Description                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Build & push images    | `runner` → `…-cms:{version}`; `migrator` → `…-cms-migrate:{version}`                |
| Container scan         | Trivy scan the runner image (CRITICAL/HIGH → fail)                                  |
| Sync config            | `scp` `compose.prod.yml` + `Caddyfile.prod` to VPS #1                               |
| Migrate (single-phase) | `docker compose --profile migrate run --rm migrate` — before deploy, additive       |
| Deploy                 | `docker compose up -d` (caddy + cms + postgres)                                     |
| Health check           | `curl /api/health`, 12 × 5s = 60s budget                                            |
| **On failure**         | Pipeline exits non-zero; re-point `CMS_IMAGE_TAG` to the last-good tag to roll back |

---

## Migration Failure Detection

Deploy pipelines run a **single-phase** migration (`payload migrate`) **before** `docker compose up -d`, so the schema is updated while the previous container keeps serving. Migrations must remain **additive/backward-compatible** (`CREATE TABLE`, `ADD COLUMN`, …) so the old code keeps working against the new schema.

| #   | Signal          | Detection                              | Action                                  |
| --- | --------------- | -------------------------------------- | --------------------------------------- |
| S1  | Migration fails | `payload migrate` exit code ≠ 0        | Pipeline exits non-zero — deploy aborts |
| S2  | App not healthy | `GET /api/health` ≠ 200 within 12 × 5s | Pipeline exits non-zero — deploy aborts |

### Ordering

1. Build & push the `runner` + `migrator` images.
2. Pull both images on the VPS.
3. Run `payload migrate` from the migrator image (**S1**).
4. `docker compose up -d`.
5. Health-check loop with a 12 × 5s = 60s budget (**S2**).

Each migration runs in its own transaction, so a failed migration rolls back cleanly — but a batch of migrations is not atomic, so a later migration can still fail after earlier ones committed.

### `/api/health` contract

`GET /api/health` currently pings the database (`SELECT 1`) and returns 200 on success, 503 on failure. ⚠️ It does **not** yet verify that applied migrations match the bundled files (the "schema is current" check) — a known gap to close if the health gate must catch "migrated but broken" schemas.

### Rollback scope

- **Migration failure** (`S1`) → the pipeline exits non-zero. The schema may be partially applied, so a manual restore may be required; automated pgBackRest backup/restore is **planned but not implemented**.
- **Deploy/startup failure** (`S2`) → re-point `CMS_IMAGE_TAG` to the last-known-good tag and `docker compose up -d` again (the previous image is still in GHCR; no rebuild needed).

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
