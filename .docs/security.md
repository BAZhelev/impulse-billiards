# Impulse Billiards — Security

> Last updated: August 2026
> Status: Planned

Network, secrets, and application hardening. See [architecture.md](architecture.md) for the high-level overview.

---

## Network

| Layer              | Configuration                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Firewall (ufw)** | VPS #1: allow 80/tcp, 443/tcp from Cloudflare IPs only; allow SSH from trusted IP only       |
|                    | VPS #2: allow 5432/tcp only from VPS #1 private IP; allow SSH from trusted IP only           |
| **Private VLAN**   | Hetzner private network between VPS #1 and VPS #2 — DB traffic never touches public internet |
| **Cloudflare**     | DDoS protection, bot management, WAF rules for all public-facing services (all proxied)      |

---

## Secrets Management

- Secrets are **never committed** to the repository
- Secrets are **never stored** in plain CI/CD variables
- **GitHub Environment Secrets** — encrypted at rest, injected at deploy time
- `.env` files are `.gitignore`d; example `.env.example` provided with dummy values
- Secrets include: `PAYLOAD_SECRET`, `DATABASE_URL`, `GCS_ACCESS_KEY_ID`, `GCS_SECRET_ACCESS_KEY`, `RESEND_API_KEY`
- Docker build secrets are passed via BuildKit `--secret` (never `--build-arg`), so they never persist in image layers

---

## Application Security

| Concern                | Measure                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| **CMS Admin**          | Strong password policy, rate limiting on `/admin/login`, CSRF protection (Payload default) |
| **API**                | Rate limiting on `/api/*` routes, CORS restricted to known origins                         |
| **Docker**             | Non-root user in container, read-only rootfs where possible, no privileged mode            |
| **Container scanning** | Trivy scans every Docker image in CI before push (block on CRITICAL CVEs)                  |
| **Dependencies**       | Dependabot weekly updates; `pnpm audit` in CI                                              |
| **SSL/TLS**            | Cloudflare proxies all domains; Caddy uses a Cloudflare Origin Cert; edge certs at the CDN |
| **Database**           | TLS connections, limited user permissions, strong password                                 |

---

## Headers & Hardening

Caddy applies security headers automatically (configurable):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
