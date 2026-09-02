# live-workflow-plugins

Three **free**, local Cursor plugins for live workflows, published by **greymattr**. No Stripe, no paid skills.

| Plugin | What it does |
| --- | --- |
| `mattermost/` | REST API v4: list teams/channels, read posts, create posts |
| `cisa-kev/` | Public CISA Known Exploited Vulnerabilities catalog + optional OSV query |
| `obsidian-local-rest/` | Obsidian Local REST API: list, read, search, append notes |

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

`cisa-kev` uses public feeds and does not require a token.

## Local install (not the marketplace)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a mattermost cisa-kev obsidian-local-rest ~/.cursor/plugins/local/
```

Each plugin is a real directory (not a symlink): `plugin.json`, `mcp.json`, `server.mjs`, and `skills/`.

## Affiliation

Community clients only. **Not affiliated with** Mattermost, Inc., CISA, Obsidian, or the Obsidian Local REST API plugin author.

## Secrets

- No tokens, API keys, or Tailscale IPs belong in this repo.
- `.env` is gitignored. Placeholders in `mcp.json` use `${VAR}` substitution only.
