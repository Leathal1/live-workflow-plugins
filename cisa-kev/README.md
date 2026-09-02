# cisa-kev (v1)

Community client for the public CISA Known Exploited Vulnerabilities catalog and optional OSV queries. Not affiliated with CISA.

## Tools

| Tool | Args | Behavior |
| --- | --- | --- |
| `list_kev` | `vendor?`, `product?`, `cve?` | Fetch catalog (process-lifetime cache), filter, return count, dateReleased, items (cap 50) |
| `kev_lookup` | `cve_id` | Exact catalog lookup; not-found if missing |
| `osv_query` | `package`, `version`, `ecosystem?` | POST api.osv.dev/v1/query; pass-through id, summary, affected (cap 50) |

## Env

- None required. Public feed; no token.
- `CISA_KEV_FEED_URL` — optional override of the default CISA JSON feed.
- `CISA_KEV_FIXTURE` — optional path to a local JSON file (used by prove when the live feed is unreachable).

## Limits (v1)

- Items capped at 50 per list/query.
- Catalog cached for the MCP process lifetime.
- Does not wrap NVD. Never invent catalog rows.
- Stdio MCP only (`node server.mjs`).
