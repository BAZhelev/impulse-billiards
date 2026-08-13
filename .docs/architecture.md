# Impulse Billiards — Architecture

> Last updated: August 2026 (revised after grilling review)
> Status: Planned

High-level overview of the system. For details, see the linked documents below.

---

## Overview

Impulse Billiards is a Turborepo monorepo with two primary applications:

| App        | Type                               | Purpose                                               |
| ---------- | ---------------------------------- | ----------------------------------------------------- |
| `apps/web` | Static Next.js (exported)          | Public-facing website, served via CDN                 |
| `apps/cms` | Payload CMS (Node.js + PostgreSQL) | Headless CMS for content management, admin panel, API |

Compute and databases run on **Hetzner** VPSes; the static website runs on **Cloudflare Pages**; media and database backups are stored on **GCP Cloud Storage** — media is served to users through the **Cloudflare CDN**; DNS and CDN run on **Cloudflare**. The design prioritises simplicity, low cost, and operational clarity with minimal third-party dependencies.

---

## Document Map

| Topic                        | Document                       |
| ---------------------------- | ------------------------------ |
| CI/CD pipelines & triggers   | [ci-cd.md](ci-cd.md)           |
| Deployments (what/where/how) | [deployment.md](deployment.md) |
| Storage (what/where)         | [storage.md](storage.md)       |
| Database & backups           | [database.md](database.md)     |
| Security                     | [security.md](security.md)     |
| Monitoring & maintenance     | [operations.md](operations.md) |

---

## Architecture Diagram

```
                         ┌──────────────────────────────────┐
                         │     Cloudflare (DNS + CDN)       │
                         │                                  │
                         │  impulse-billiards.com           │
                         │  → Cloudflare Pages              │
                         │  → static Next.js export         │
                         │  → SSL: Cloudflare edge cert     │
                         │                                  │
                         │  admin.impulse-billiards.com     │
                         │  → Proxied (DDoS + IP hide)      │
                         │  → VPS #1 public IP              │
                         │  → SSL: Cloudflare origin cert   │
                         │                                  │
                         │  staging.admin.impulse-...com    │
                         │  → Proxied (DDoS + IP hide)      │
                         │  → VPS #3 public IP              │
                         │  → SSL: Cloudflare origin cert   │
                         │                                  │
                         │  media.impulse-billiards.com     │
                         │  → CNAME c.storage.googleapis.com│
                         │  → GCS domain-named bucket       │
                         └──────────┬───────────────────────┘
                                    │
         ┌──────────────────────────┼───────────────────────────┐
         │              HETZNER (compute + DB)                  │
         │                                                      │
         │  ┌──────────────────────────┐  ┌──────────────────┐  │
         │  │  VPS #1 — Prod App       │  │  VPS #3 — Staging│  │
         │  │  CX22, ~€8/mo            │  │  CX22, ~€8/mo    │  │
         │  │                          │  │                  │  │
         │  │  ┌────────────────────┐  │  │  ┌────────────┐  │  │
         │  │  │  Caddy             │  │  │  │Caddy + CMS │  │  │
         │  │  │  (reverse proxy)   │  │  │  │+ PostgreSQL│  │  │
         │  │  └────────┬───────────┘  │  │  │(all-in-one)│  │  │
         │  │           │              │  │  └────────────┘  │  │
         │  │  ┌────────▼───────────┐  │  └──────────────────┘  │
         │  │  │  Payload CMS       │  │                        │
         │  │  │  Docker container  │  │                        │
         │  │  │  Node.js           │  │                        │
         │  │  │  /api/health       │  │                        │
         │  │  └────────────────────┘  │                        │
         │  └──────────┬───────────────┘                        │
         │             │ private VLAN                           │
         │  ┌──────────▼───────────────┐                        │
         │  │  VPS #2 — Prod DB        │                        │
         │  │  CX22, ~€8/mo            │                        │
         │  │                          │                        │
         │  │  ┌────────────────────┐  │                        │
         │  │  │  PostgreSQL 16     │  │                        │
         │  │  │  Docker container  │  │                        │
         │  │  └────────────────────┘  │                        │
         │  │                          │                        │
         │  │  ┌────────────────────┐  │                        │
         │  │  │  pgBackRest        │  │                        │
         │  │  │  (backups → GCS)   │  │                        │
         │  │  └────────────────────┘  │                        │
         │  └──────────────────────────┘                        │
         └──────────────────────────────────────────────────────┘

  External services (outside Hetzner):
  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────┐
  │  GCP Cloud Storage │  │  Resend (email)  │  │ Better Stack │
  │  media via CDN     │  │  transactional   │  │ monitoring → │
  │  backups (S3)      │  │  from Payload    │  │ Discord      │
  └────────────────────┘  └──────────────────┘  └──────────────┘
       Media: browser → Cloudflare CDN → GCS domain-named bucket
       Backups: pgBackRest → GCS (private HMAC keys)
       Dev = local machine, no remote env
```

---

## Provider Landscape

| Provider            | Service                                    | Cost                |
| ------------------- | ------------------------------------------ | ------------------- |
| **Hetzner**         | 3× CX22 VPS (prod app, prod DB, staging)   | ~€24/mo             |
| **GCP**             | Cloud Storage (media origin + backups)     | ~€3/mo              |
| **Cloudflare**      | Pages + DNS + CDN (site + media) + DDoS    | Free                |
| **Resend**          | Transactional email (100/day)              | Free                |
| **Better Stack**    | External uptime monitoring + alerts        | Free                |
| **GitHub**          | CI/CD (Actions), Container Registry (GHCR) | Free (public repos) |
| **Total estimated** |                                            | **~€27/mo**         |

Compute on Hetzner for cost; static site on Cloudflare Pages (free); media + backups on GCP for reliability. No AWS, no Azure. Minimal provider sprawl.

---

## Repository Structure (Planned)

```

impulse-billards/
├── apps/
│ ├── web/ # Static Next.js — public website
│ │ ├── package.json
│ │ └── ...
│ └── cms/ # Payload CMS — admin + API (to be scaffolded)
│ ├── Dockerfile
│ ├── package.json
│ └── ...
├── packages/
│ ├── eslint-config/ # Shared ESLint config
│ └── typescript-config/ # Shared TS config
├── infra/                    # Infrastructure configs
│   ├── compose.prod.yml      # Docker Compose for prod Payload CMS + Caddy
│   ├── compose.staging.yml   # Docker Compose for staging (CMS + Caddy + DB)
│   ├── Caddyfile             # Reverse proxy config
├── scripts/
│ ├── deploy.sh # Deployment script
│ ├── backup.sh # pgBackRest setup + nightly cron
│ └── restore.sh # Disaster recovery restore script
├── .github/
│ ├── workflows/
│ │ ├── ci.yml # Lint, type-check, test, Docker build, Trivy scan
│ │ ├── deploy-staging.yml    # CD — auto-deploy CMS to staging
│ │ ├── deploy-prod.yml       # CD — manual deploy CMS to production
│ │ ├── deploy-static.yml     # CD — build + deploy static site to Pages
│ └── dependabot.yml # Grouped dependency updates
├── .docs/
│ ├── architecture.md # This document
│ └── runbooks/
│ └── disaster-recovery.md
└── turbo.json

```

---

## DNS & Domains

All DNS managed in **Cloudflare** (free tier).

| Record                                | Type  | Value                      | Proxy      | Notes                                   |
| ------------------------------------- | ----- | -------------------------- | ---------- | --------------------------------------- |
| `impulse-billiards.com`               | CNAME | (Cloudflare Pages)         | 🟠 Proxied | Served by Cloudflare Pages              |
| `www.impulse-billiards.com`           | CNAME | `impulse-billiards.com`    | 🟠 Proxied | Redirect to root                        |
| `admin.impulse-billiards.com`         | A     | VPS #1 public IP           | 🟠 Proxied | Caddy uses Cloudflare Origin Cert       |
| `api.impulse-billiards.com`           | A     | VPS #1 public IP           | 🟠 Proxied | (optional) same as admin                |
| `staging.admin.impulse-billiards.com` | A     | VPS #3 public IP           | 🟠 Proxied | Caddy uses Cloudflare Origin Cert       |
| `media.impulse-billiards.com`         | CNAME | `c.storage.googleapis.com` | 🟠 Proxied | GCS domain-named bucket (media CDN)     |
| `media.staging.impulse-billiards.com` | CNAME | `c.storage.googleapis.com` | 🟠 Proxied | GCS domain-named bucket (staging media) |

> **Why proxy everything?** Proxying hides the VPS public IPs and applies DDoS protection, bot management, and WAF to _all_ services — not just the static site. Caddy terminates SSL using a Cloudflare Origin Certificate, so SSL is still automatic; the "double-SSL" concern is solved by the origin cert rather than avoiding the proxy.

> **Static site note:** `impulse-billiards.com` is served by Cloudflare Pages. Its DNS entry is created automatically when the custom domain is attached to the Pages project — it does not need a manual A record like the VPS-backed domains.

> **Media note:** `media.*` uses a GCS _domain-named bucket_ — the bucket name must exactly equal the domain, and GCS requires one-time ownership verification (a Cloudflare TXT/CNAME record) before it serves traffic. See [storage.md](storage.md#media-serving--caching).

---

## Email

**Resend** (resend.com) for all transactional emails from Payload CMS:

- Password resets
- Admin user invitations
- Form submission notifications
- Free tier: 100 emails/day (sufficient for low-to-medium volume)

DNS setup in Cloudflare:

| Record              | Type | Value                                                            |
| ------------------- | ---- | ---------------------------------------------------------------- |
| `resend._domainkey` | TXT  | (Resend DKIM value)                                              |
| `@`                 | TXT  | `v=spf1 include:spf.resend.com -all`                             |
| `_dmarc`            | TXT  | `v=DMARC1; p=quarantine; rua=mailto:dmarc@impulse-billiards.com` |

---

## Implementation Phases

| Phase                       | Duration | Deliverables                                                                                                         |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| **Phase 1: Foundation**     | 1–2 days | Scaffold `apps/cms` (Payload CMS), `Dockerfile`, `compose.prod.yml`, `compose.staging.yml`, Caddyfile                |
| **Phase 2: CI/CD**          | 2–3 days | Enhanced CI (Docker build + scan), staging deploy (auto), production deploy (manual), rollback                       |
| **Phase 3: Infrastructure** | 1–2 days | Provision 3 VPSes, private VLAN, GCP Cloud Storage buckets (media + backups), Cloudflare Pages + DNS + CDN (proxied) |
| **Phase 4: Monitoring**     | 1 day    | Better Stack monitors, Discord alerts, status page                                                                   |
| **Phase 5: Backups**        | 1 day    | pgBackRest on VPS #2, nightly cron, restore script, disaster recovery runbook                                        |
| **Phase 6: Hardening**      | 1 day    | Rate limiting, WAF rules, security headers, firewall audit                                                           |

---

## Key Decisions Log

| Decision                                   | Rationale                                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Pages for static site           | Zero-config static hosting, atomic deploys + auto-rollback, free; no origin server to manage                                             |
| Debounced publish → build trigger          | Payload publishes debounced ~2 min + cancel-in-progress → one build per burst, not one per save                                          |
| Stable media paths + short TTL             | Swapping media doesn't rebuild; 5-min `max-age` bounds staleness to minutes at ~$0 cost                                                  |
| GCS domain-named bucket for media          | Branded `media.*` URL + Cloudflare CDN/WAF with no Worker/proxy code; GCS custom domains require a bucket named exactly after the domain |
| No content preview in v1                   | Draft preview needs a server or client-side fetch; both carry risk not worth it yet                                                      |
| Hetzner for compute, GCP for media/backups | Cheap reliable VPS compute; GCP Cloud Storage for irreplaceable assets (media + backups)                                                 |
| Docker Compose over Kubernetes             | Simple, predictable, easy to reason about; migrate to k3s later if needed                                                                |
| Separate DB VPS for production             | Security (DB not on same host as public-facing app), resource isolation                                                                  |
| Bundled CMS + DB on staging (CX22)         | Cost-saving while still having enough RAM; staging validates deployments                                                                 |
| External monitoring (Better Stack)         | Lives outside Hetzner failure domain; self-hosted monitor would die with the infra it watches                                            |
| Cloudflare proxy for all domains           | Hides VPS IPs, DDoS protection + WAF everywhere; origin cert avoids double-SSL complexity                                                |
| Staging auto-deploy, prod manual           | Fast feedback on main merge; manual gate prevents accidental production deploys                                                          |
| Pre-migration DB backup rollback           | pgBackRest backup before migrations; restore DB + old container on failure                                                               |
| Resend for email                           | Simple API, generous free tier, good DX, no need for SMTP server management                                                              |
| Dependabot grouped by concern              | Separate PRs for runtime vs dev deps so each group can be reviewed with appropriate scrutiny                                             |

---

## Future Considerations

- **Scaling**: If traffic grows, add more app VPS instances behind a load balancer (HAProxy) and use PgBouncer for DB connection pooling
- **Multi-region**: Add a second region with read replicas and GeoDNS failover
- **Kubernetes migration**: Move from Docker Compose to k3s for auto-scaling and self-healing
- **OpenTelemetry**: Add distributed tracing for deeper observability
- **Authentication**: Add SSO (Google/GitHub OAuth) for Payload CMS admin
