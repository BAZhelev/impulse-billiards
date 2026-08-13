# Impulse Billiards — Storage

> Last updated: August 2026
> Status: Planned

What we store, where, and how it's served. See [architecture.md](architecture.md) for the high-level overview.

---

## GCP Cloud Storage

Payload CMS media uploads and database backups are stored in **GCP Cloud Storage** via its S3-compatible interoperability API (HMAC keys). Payload's S3 adapter and pgBackRest both work against this without changes. (The static website itself lives on Cloudflare Pages, not GCP.)

```
User upload → Payload CMS → S3 adapter → GCP Cloud Storage (media.impulse-billiards.com)
│
Cloudflare CDN serves files (pull from bucket origin)
media.impulse-billiards.com ──CNAME──► c.storage.googleapis.com
```

| Bucket                                | Purpose                       | Environment | Lifecycle                                  |
| ------------------------------------- | ----------------------------- | ----------- | ------------------------------------------ |
| `media.impulse-billiards.com`         | CMS media uploads             | Production  | Never auto-deleted; manual audit quarterly |
| `media.staging.impulse-billiards.com` | CMS media uploads             | Staging     | Never auto-deleted; manual audit quarterly |
| `impulse-backups`                     | Database backups (pgBackRest) | Production  | Auto-delete after 30 days                  |

> **Why GCP for storage?** Hetzner Object Storage has mixed reliability reports. GCP Cloud Storage (99.95% SLA, 11 9s durability) is used for anything we can't afford to lose — media and backups — while compute stays on cheap Hetzner VPSes.

---

## Media Serving & Caching

Media is served from a **dedicated custom domain** via a GCS **domain-named bucket** — no Worker or proxy code, just DNS. GCS does not support arbitrary custom domains via CNAME; the supported mechanism is a _domain-named bucket_, whose name must exactly equal the domain, with the domain CNAME'd to GCS.

```text
browser ──► https://media.impulse-billiards.com/<key>
                │
                ▼
        Cloudflare (proxied: CDN + WAF + cache rule)
                │
                ▼  CNAME → c.storage.googleapis.com (Host: media.impulse-billiards.com)
        GCS domain-named bucket `media.impulse-billiards.com`
```

- **DNS** (Cloudflare): `media.impulse-billiards.com` and `media.staging.impulse-billiards.com` → CNAME `c.storage.googleapis.com`, both 🟠 Proxied — see [architecture.md](architecture.md#dns--domains).
- **Ownership**: GCS requires one-time domain-ownership verification (a Cloudflare TXT/CNAME record) before a domain-named bucket serves traffic.
- **Access**: uniform bucket-level access with `allUsers: objectViewer`, so Cloudflare can pull objects. ⚠️ _Every object written to the media bucket is publicly readable by design_ — never store anything non-public in it.

### Caching (hard requirement: 5-minute TTL)

Media is served over **stable, predictable paths** (not content-hashed), so swapping an image at the same URL does _not_ trigger a site rebuild — the new bytes are picked up automatically by short-lived caching.

The `max-age=300` (5 min) TTL is enforced **two ways**, so a mis-configured upload can never serve stale media for hours:

1. **At upload** — every object is written with `Cache-Control: public, max-age=300` (via the Payload S3 adapter's `cacheControl` option; if the adapter does not expose it, set it in a post-upload hook).
2. **At the edge** — a Cloudflare **Cache Rule** on `media.*` pins the Edge Cache TTL to 300s ("Respect origin"), overriding any accidental long-lived header.

- **Never `immutable`**: stable paths reuse the same URL, so long/immutable TTLs would serve stale images for days.
- `immutable` + 1-year caching is reserved for `_next/static/*` (JS/CSS), which Next.js content-hashes itself.
- **Cost**: the 5-min revalidation is demand-driven and costs ~$0 — GCS → Cloudflare egress is free (Bandwidth Alliance) and revalidation hits are 304s billed at ~$0.004/10k ops.
- **Purge**: optional — only needed for instant invalidation of a swapped image (Cloudflare API purge by URL); otherwise the 5-min TTL self-heals.

### URL scheme

Media URLs are **stable and human-readable**: `https://media.impulse-billiards.com/<collection>/<filename>` — the original filename is preserved (never content-hashed), so the same asset always lives at the same URL. The static site prefixes media URLs with a `MEDIA_BASE_URL` env var at build time (prod vs staging).

Media uploads from the CMS are written via Payload's S3 adapter using `GCS_ACCESS_KEY_ID` / `GCS_SECRET_ACCESS_KEY` (HMAC). The trigger rules for _when_ a media change causes a site rebuild are documented in [deployment.md](deployment.md#content-sync--payload--static-site).
