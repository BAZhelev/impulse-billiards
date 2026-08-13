# Impulse Billiards — Operations

> Last updated: August 2026
> Status: Planned

Monitoring, alerting, and routine maintenance. See [architecture.md](architecture.md) for the high-level overview.

---

## Monitoring & Observability

Monitoring uses an **external SaaS** (**Better Stack** free tier) rather than a self-hosted tool on a Hetzner VPS. A self-hosted monitor on Hetzner shares the same failure domain as the infrastructure it watches — a Hetzner-wide outage would take both down. External monitoring lives outside Hetzner and catches those failures.

### What Better Stack Monitors

| Target                                                   | Type        | Interval | Alert   |
| -------------------------------------------------------- | ----------- | -------- | ------- |
| `https://impulse-billiards.com`                          | HTTP(s)     | 5 min    | Discord |
| `https://admin.impulse-billiards.com/api/health`         | HTTP(s)     | 5 min    | Discord |
| `https://staging.admin.impulse-billiards.com/api/health` | HTTP(s)     | 5 min    | Discord |
| SSL expiry (all domains)                                 | Certificate | 24 hours | Discord |

> Free tier covers 3 monitors. If more monitors are needed later, revisit a self-hosted Uptime Kuma on an existing VPS.

### Alert Thresholds

| Condition                             | Severity | Channel |
| ------------------------------------- | -------- | ------- |
| Any health check fails 3× consecutive | Critical | Discord |
| SSL certificate expiring < 14 days    | Warning  | Discord |

### Logs

- Docker containers log to stdout/stderr (json-file driver)
- Logs available via `docker compose logs` on each VPS when debugging
- For persistent log storage later: add Loki + Promtail if needed

---

## Maintenance Tasks

| Task                                      | Frequency                       | Owner                 |
| ----------------------------------------- | ------------------------------- | --------------------- |
| OS security patches (unattended-upgrades) | Automatic (daily)               | System                |
| Docker base image updates                 | Triggered by Dependabot + CI    | DevOps                |
| Database backups                          | Nightly (automated)             | pgBackRest            |
| Backup restore drill                      | Quarterly                       | DevOps                |
| SSL certificate renewal                   | Automatic (Caddy)               | System                |
| Log rotation / cleanup                    | Loki retention policy (30 days) | System                |
| Unreferenced media audit                  | Quarterly                       | Content team + DevOps |
| Firewall rule audit                       | Quarterly                       | DevOps                |
| SSH key rotation                          | Quarterly                       | DevOps                |
| Dependency vulnerability audit            | Weekly (Dependabot)             | DevOps                |
