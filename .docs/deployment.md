# Impulse Billiards — Deployment

> Last updated: August 2026
> Status: Planned

What gets deployed, where, and how. See [architecture.md](architecture.md) for the high-level overview.

---

## Static Next.js App (`apps/web`)

The site is a **build-time snapshot of CMS content**: `next build` fetches published documents from the Payload REST API and renders them to static HTML. The repo is the template; the CMS is the data.

1. `next build` (with `output: 'export'`) fetches published content (`where: { _status: { equals: "published" } }`) and emits static HTML/CSS/JS to `apps/web/out/`
2. Deployed to **Cloudflare Pages** via `wrangler pages deploy` — atomic deploys with automatic rollback to the previous version on failure
3. Cloudflare Pages serves from the global edge with automatic SSL; the custom domain (`impulse-billiards.com`) is attached to the Pages project
4. Cache strategy (Pages applies automatically):
   - HTML: cache for 5 minutes (stale-while-revalidate)
   - JS/CSS/assets (`_next/static/*`, fingerprinted by Next.js): immutable, cache for 1 year
   - CMS media: 5-minute `max-age` — see [storage.md](storage.md#media-serving--caching)

Media URLs are prefixed at build time with `MEDIA_BASE_URL` (e.g. `https://media.impulse-billiards.com`), so the exported site points at the correct media bucket for its environment (prod vs staging).

---

## Content Sync — Payload → Static Site

Content changes reach the site through a **debounced, batched publish** flow:

```
Admin edits in Payload (drafts)
   │ publish (per-document)
   ▼
Payload publish hook → debounce timer (~2 min of quiet)
   │ timer fires once
   ▼
POST GitHub workflow_dispatch → `deploy-static.yml`
   │
   ▼
build fetches published content → wrangler pages deploy (atomic)
```

- **Drafts**: content collections enable Payload drafts (`versions: { drafts: true }`); the build fetches _published_ docs only, so half-finished edits never leak into a deploy.
- **Debounce**: each publish resets a ~2-minute quiet-period timer; the build fires once after the last publish. Ten publishes in five minutes → one build.
- **Cancel backstop**: `concurrency: cancel-in-progress` on `deploy-static.yml` kills a stale in-flight build if a new one starts.
- **Manual override**: a "Deploy now" button bypasses the debounce for instant feedback.
- **Media rule**: rebuild only when generated HTML changes — adding/removing media (or any metadata change) rebuilds; swapping an image at the same URL does not.
- **No content preview in v1**: rendering unpublished drafts on the site is out of scope — it needs a server (ISR/Live Preview) or client-side draft fetching with real CDN-poisoning risk. Code previews on `dev` (Pages preview deployments fetching from staging CMS) still apply.

---

## Payload CMS — Production (`apps/cms`)

1. Docker image built in CI, pushed to GHCR with `{sha}` and `latest` tags
2. Deployed via `compose.prod.yml` on VPS #1
3. Caddy reverse proxy handles:
   - SSL termination via Cloudflare Origin Certificate (admin is proxied through Cloudflare)
   - Routing: `admin.impulse-billiards.com` → Payload CMS container on port 3000
4. Database: PostgreSQL on VPS #2 (private VLAN)
5. Environment variables injected at deploy time (never committed):
   - `DATABASE_URL` — PostgreSQL connection string (private IP)
   - `PAYLOAD_SECRET` — CMS encryption key
   - `GCS_BUCKET` (= `media.impulse-billiards.com`), `GCS_ACCESS_KEY_ID`, `GCS_SECRET_ACCESS_KEY` — GCP Cloud Storage (S3 interoperability HMAC keys)
6. Health check endpoint: `GET /api/health` returns 200 only when the CMS is ready **and** the DB schema is current (applied migrations match the bundled migration files) — see [ci-cd.md](ci-cd.md#migration-failure-detection)

---

## Payload CMS — Staging (`apps/cms`)

1. Same Docker image as production, deployed on VPS #3
2. Runs via `compose.staging.yml` — CMS + Caddy + PostgreSQL all on one VPS
3. Caddy handles SSL for `staging.admin.impulse-billiards.com`
4. Database is self-contained on the same VPS (no separate DB VPS for staging)
5. Staging Object Storage bucket: `media.staging.impulse-billiards.com` (isolated from prod media)
6. Used only for verifying deployments work before promoting to production

---

## Deployment Safety

- Docker Compose has no `--rollback` flag (that's Swarm-only), so rollback = re-point the image to the last-known-good `{sha}` tag and run `docker compose up -d` — the previous image stays in GHCR
- Health check with retries ensures the new container is actually serving before marking success
- **Migrations are preceded by a pgBackRest backup**; on migration failure, restore the DB from that backup _and_ roll back the container — Docker alone cannot undo a schema change. The exact failure signals that trigger the restore are defined in [ci-cd.md](ci-cd.md#migration-failure-detection).
- Cloudflare Pages deploys are atomic: the new static site goes live only after a successful build, with automatic rollback to the previous version on failure

---

## Staging Environment

Staging runs on **VPS #3** (CX22, ~€8/mo) — a single VPS with everything bundled together.

### Staging vs Production

| Aspect         | Staging (VPS #3)                             | Production (VPS #1 + #2)             |
| -------------- | -------------------------------------------- | ------------------------------------ |
| CMS + Caddy    | ✅ Docker Compose                            | ✅ Docker Compose                    |
| PostgreSQL     | ✅ Same VPS (bundled)                        | ✅ Separate VPS #2                   |
| Object Storage | `media.staging.impulse-billiards.com` bucket | `media.impulse-billiards.com` bucket |
| Domain         | `staging.admin.impulse-billiards.com`        | `admin.impulse-billiards.com`        |
| Deploy trigger | Auto on push to `main`                       | Manual (`workflow_dispatch`)         |
| Purpose        | Verify deployment works                      | Live site                            |

### Staging Workflow

1. Push to `main` → CI passes → auto-deploy to staging
2. Verify on staging: check admin panel, test API, confirm migrations ran
3. If staging looks good → manually trigger production deploy via `workflow_dispatch`
4. If staging has issues → fix on a branch, merge, re-deploy to staging

### Why Bundled on Staging?

Staging only needs to validate deployments — it doesn't need the same isolation as production. Bundling CMS + DB on one CX22 (~€8/mo) keeps costs low while providing enough RAM to run Payload, Caddy, and PostgreSQL without OOM kills.
