# Impulse Billiards — Database

> Last updated: August 2026
> Status: Planned

How PostgreSQL is run, migrated, and recovered. See [architecture.md](architecture.md) for the high-level overview.

---

## PostgreSQL

- **PostgreSQL 16** running in Docker on VPS #2
- Connection: VPS #1 → VPS #2 over private VLAN (`10.0.0.2:5432`), never exposed publicly
- Authentication: strong password, limited user (app user cannot create/drop tables except during migrations)
- TLS enforced for all connections
- Connection pooling via `pg-pool` (Payload's built-in) or PgBouncer if needed

---

## Migrations & Rollback

Database migrations run as part of the CMS deploy pipelines (see [ci-cd.md](ci-cd.md)). The safety model:

- **Pre-migration backup**: a pgBackRest backup is taken before every migration.
- **On failure**: restore the DB from that backup _and_ roll back the container — Docker alone cannot undo a schema change.
- **Not transactional**: drizzle/Payload migrations are not wrapped in a single transaction, so a migration can apply _halfway_ and exit non-zero. A non-zero exit is treated as a definitive failure and the DB is restored.
- **Failure signals**: the exact signals that trigger a restore (migration exit code, health check, smoke test) are defined in [ci-cd.md](ci-cd.md#migration-failure-detection).
- Staging migrations run automatically on every deploy to `main`, so failures surface before production.

---

## Backups & Disaster Recovery

### Backup Strategy

**Tool**: pgBackRest running on VPS #2

| Backup Type       | Frequency                         | Destination                           | Retention |
| ----------------- | --------------------------------- | ------------------------------------- | --------- |
| Full backup       | Nightly (3 AM UTC)                | GCP Cloud Storage (`impulse-backups`) | 30 days   |
| WAL archiving     | Continuous (every 5 min)          | GCP Cloud Storage (`impulse-backups`) | 7 days    |
| Pre-deploy manual | Before every production migration | GCP Cloud Storage                     | 90 days   |

### RPO / RTO

- **RPO** (Recovery Point Objective): 5 minutes (last WAL shipment)
- **RTO** (Recovery Time Objective): ~20 minutes (spin up fresh VPS + restore + start)

### Restore Process

```bash
# 1. Spin up a fresh VPS with Docker
# 2. Install pgBackRest, configure to point at GCP Cloud Storage backup repo
# 3. Restore to point-in-time or latest
pgbackrest --stanza=impulse --type=time --target="2026-08-12 14:30:00+00" restore
# 4. Start PostgreSQL
docker compose up -d postgres
# 5. Point Payload CMS at the new DB IP
# 6. Verify: curl https://admin.impulse-billiards.com/api/health

```

### Recovery Testing

A full restore drill is performed **quarterly** to a temporary VPS to verify:

- Backup integrity
- Restore procedure works
- RTO estimate is accurate
- Team knows how to execute the runbook
