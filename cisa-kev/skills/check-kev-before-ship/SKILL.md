---
name: check-kev-before-ship
description: Before merge or ship, query the public CISA KEV catalog and optional OSV. Never invent catalog entries.
---

# Check KEV before ship

Use before merge/ship. Call list_kev, kev_lookup, optional osv_query. Never invent catalog rows.

## Tools

1. list_kev with optional vendor, product, or cve filters. Returns count, dateReleased, items (cap 50).
2. kev_lookup with required cve_id (exact). Returns the item or not-found. Never invent an entry.
3. osv_query with required package and version, optional ecosystem. Pass-through of id, summary, affected.

## Workflow

- Known id: kev_lookup. Missing means not in KEV, not "safe".
- Browse: list_kev then quote fields from the response only.
- Dependency: optional osv_query; report API fields only.
- Do not invent catalog rows. Report tool errors as-is.
