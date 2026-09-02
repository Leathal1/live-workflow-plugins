# obsidian-local-rest (v1)

Community client for the Obsidian Local REST API. Not affiliated with Obsidian or the Local REST API plugin author.

## Tools

| Tool | Args | API |
| --- | --- | --- |
| `list_notes` | `path?` | `GET /vault/` or `GET /vault/{path}/` (trailing slash) → `{ path }[]` |
| `get_note` | `path` | `GET /vault/{path}` (no trailing slash) → `{ path, content }` |
| `search_vault` | `query` | `POST /search/simple/?query=` → `{ filename, score?, matches? }[]` |
| `append_note` | `path`, `content` | `PATCH /vault/{path}` JSON `{ operation: "append", content }`, then GET → `{ path, content }` |

## Env

- `OBSIDIAN_API_URL` — origin, no trailing slash. Example: `https://127.0.0.1:27124` or `http://127.0.0.1:27123`.
- `OBSIDIAN_API_KEY` — sent as `Authorization: Bearer`. The plugin does not store it.

Local HTTPS (`127.0.0.1` / `localhost`) uses `node:https` with `rejectUnauthorized: false` (self-signed cert). HTTP uses `fetch`.

## Limits (v1)

- Append only (no overwrite, no dedicated create/delete tools).
- Search hits are not full note bodies; call `get_note` to read.
- Never invent note content.
- Stdio MCP only (`node server.mjs`).
