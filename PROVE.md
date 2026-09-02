# PROVE

Ran 2026-09-02 ~11:31 AM PT on this box. No git push, no marketplace submit, no real tokens, no private Mattermost/Obsidian URLs.

Repeat: `./scripts/prove.sh` (syntax + manifests + local copy + `./scripts/mcp-prove.sh`).

## Schema

| Check | Result |
| --- | --- |
| JSON.parse all plugin.json / mcp.json / marketplace.json | PASS |
| marketplace.json name/owner/plugins/source | PASS (matches required document) |
| kebab-case plugin names | PASS |
| python jsonschema | SKIP — not installed |
| root plugin.json | none (multi-plugin repo; `.cursor-plugin/marketplace.json` only) |

## Syntax

`node --check` PASS on mattermost, cisa-kev, obsidian-local-rest servers plus dummy and mcp-smoke scripts.

## mattermost (dummy HTTP 127.0.0.1, token placeholder dummy)

| Tool | Result | Snippet |
| --- | --- | --- |
| initialize | PASS | serverInfo name=mattermost version=0.1.0 |
| tools/list | PASS | list_teams, list_channels, get_channel_posts, create_post |
| list_teams | PASS | [{id:t1,name:engineering,display_name:Engineering}] |
| list_channels | PASS | [{id:c1,name:town-square,team_id:t1,type:O}] |
| get_channel_posts | PASS | [{id:p1,channel_id:c1,user_id:u1,message:hello team}] |
| create_post | PASS | {id:p-new,channel_id:c1,message:prove ping} |

Live Mattermost not used.

## cisa-kev

LIVE public catalog + LIVE OSV. Fixture not used.
dateReleased=2026-09-02T16:54:39.8321Z (9:54 AM PT).

- tools/list PASS (list_kev, kev_lookup, osv_query)
- list_kev PASS count=386 (vendor filter Microsoft)
- kev_lookup PASS (known catalog row, dateAdded=2021-12-10)
- osv_query PASS count=2 first id=GHSA-qw6h-vgh9-j6wx

## obsidian-local-rest (dummy HTTP 127.0.0.1, key placeholder dummy)

| Tool | Result | Snippet |
| --- | --- | --- |
| tools/list | PASS | list_notes, get_note, search_vault, append_note |
| list_notes | PASS | [{path:Welcome.md},{path:Projects/}] |
| get_note | PASS | {path:Welcome.md, content sample Welcome note} |
| search_vault | PASS | [{filename:Welcome.md, score:1}] |
| append_note | PASS | {path:Welcome.md, content includes appended-by-prove} |

Dummy is HTTP not HTTPS. Live Local REST not running here.
Local HTTPS uses rejectUnauthorized false only for 127.0.0.1/localhost (README).

## Local install (real dirs, not symlinks)

- /home/box/.cursor/plugins/local/mattermost
- /home/box/.cursor/plugins/local/cisa-kev
- /home/box/.cursor/plugins/local/obsidian-local-rest

## Loader

SKIP: @anysphere/cursor-plugins not installed. loadUserLocalPlugins did not run.

## Cannot prove here

Cursor Customize UI, org policy, Grok Bot loading ~/.cursor/plugins/local, live Mattermost, live Obsidian vault.

## Secrets

rg for token/api_key/tailscale hits placeholders, env names, dummy prove values, and README "do not commit Tailscale IPs". No live secrets, no private hosts.
