# fly-io (v1)

Wraps the official flyctl MCP server (`flyctl mcp server`, also invoked as `fly mcp server`). This plugin does not vendor flyctl or rebuild Fly's MCP server.

**Not affiliated with Fly.io Inc.** beyond wrapping the official CLI MCP.

Free. MIT. No Stripe. No license gates.

## Requirements

1. **flyctl on PATH.** Install from [https://fly.io/docs/flyctl/install/](https://fly.io/docs/flyctl/install/). `mcp.json` always uses the `flyctl` binary name. If your install only provides `fly`, install or symlink `flyctl` so that command exists. Do not vendor flyctl in this repo.
2. **`FLY_ACCESS_TOKEN`** in Cursor plugin variables (deploy token from the Fly dashboard). Cursor substitutes `${FLY_ACCESS_TOKEN}` into the MCP process env. Also accepted by flyctl as `--access-token`. **Do not commit the token.**

No org slug is required for v1. No optional plugin variables.

## What flyctl MCP exposes

Official flyctl maps most of these command groups (exact tool names come from the installed flyctl `tools/list`; do not invent names):

- apps — Fly applications
- machine — Fly Machines
- logs — application logs
- certs — certificates
- secrets — runtime secrets (env)
- volumes — persistent volumes
- status — app status / recent deploy details
- orgs — organizations
- platform — Fly platform info

Docs: [flyctl mcp server](https://fly.io/docs/flyctl/mcp-server/) and [flyctl MCP](https://fly.io/docs/mcp/flyctl-server/). Inspector examples in Fly docs include `fly-apps-list`, `fly-machines-list`, `fly-orgs-list`, `fly-platform-status`.

## Limits (v1)

- Stdio MCP only: `flyctl mcp server` (no `--sse` / `--stream` in this plugin).
- Never invent app names, machine ids, or log lines. Quote only what flyctl returned.
- This repo stores no tokens, API keys, or Tailscale IPs.

## Local install (not the marketplace)

```bash
mkdir -p ~/.cursor/plugins/local
cp -a fly-io ~/.cursor/plugins/local/
```

Real directory, not a symlink. Set `FLY_ACCESS_TOKEN` in the Cursor plugin UI.
