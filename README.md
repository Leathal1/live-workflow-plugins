# live-workflow-plugins

Four **free** Cursor plugins for Mattermost, the CISA Known Exploited Vulnerabilities catalog, Obsidian Local REST, and Fly.io. Published by **greymattr**. Not affiliated with Mattermost, CISA, Obsidian, or Fly.io.

Logotype: [assets/logo.png](assets/logo.png) (1:1 plate).

| Plugin | What it does |
| --- | --- |
| `mattermost/` | REST API v4: list teams/channels, read posts, create posts |
| `cisa-kev/` | Public CISA Known Exploited Vulnerabilities catalog + optional OSV query |
| `obsidian-local-rest/` | Obsidian Local REST API: list, read, search, append notes |
| `fly-io/` | Official `flyctl mcp server`: apps, machines, logs, certs, secrets, volumes |

Catalog: [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json).

## Variables

Set in the Cursor plugin UI (or the process environment). **Do not commit secrets.**

| Variable | Plugin | Notes |
| --- | --- | --- |
| `MATTERMOST_URL` | mattermost | Origin only (`https://chat.example.com`). No trailing slash, no `/api` path. |
| `MATTERMOST_TOKEN` | mattermost | Bot or personal access token. Sent as `Authorization: Bearer`. |
| `OBSIDIAN_API_URL` | obsidian-local-rest | Origin of Local REST (docs default `https://127.0.0.1:27124`, or HTTP on `27123`). No trailing slash. |
| `OBSIDIAN_API_KEY` | obsidian-local-rest | Key from Obsidian → Settings → Local REST API. |
| `CISA_KEV_FEED_URL` | cisa-kev | Optional. Defaults to the public CISA feed. |
| `CISA_KEV_FIXTURE` | cisa-kev | Optional. Path to a local JSON catalog for offline / prove. |
| `FLY_ACCESS_TOKEN` | fly-io | Fly deploy token. Requires `flyctl` on PATH. |

`cisa-kev` uses public feeds and does not require a token.

## Local install (not the marketplace)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a mattermost cisa-kev obsidian-local-rest fly-io ~/.cursor/plugins/local/
```

Each plugin is a real directory (not a symlink): `plugin.json`, `mcp.json`, and `skills/`. `fly-io` wraps `flyctl mcp server` (no `server.mjs`).

## Affiliation

Community clients only. **Not affiliated with** Mattermost, Inc., CISA, Obsidian, the Obsidian Local REST API plugin author, or Fly.io Inc.

## Secrets

- No tokens, API keys, or Tailscale IPs belong in this repo.
- `.env` is gitignored. Placeholders in `mcp.json` use `${VAR}` substitution only.
