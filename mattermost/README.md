# mattermost (v1)

Community Mattermost REST API v4 client. Not affiliated with Mattermost, Inc.

## Tools

| Tool | Args | API |
| --- | --- | --- |
| `list_teams` | none | `GET /api/v4/users/me/teams` → `{ id, name, display_name }[]` |
| `list_channels` | none | `GET /api/v4/users/me/channels` → `{ id, name, display_name, team_id, type }[]` |
| `get_channel_posts` | `channel_id` (required), `page?`, `per_page?` | `GET /api/v4/channels/{id}/posts` → `Post[]` |
| `create_post` | `channel_id`, `message` | `POST /api/v4/posts` → `Post` |

`Post` = `{ id, channel_id, user_id, message, create_at }`.

## Env

- `MATTERMOST_URL` — origin only (scheme + host + optional port). Trailing slashes stripped.
- `MATTERMOST_TOKEN` — sent as `Authorization: Bearer`. The plugin does not store it.

## Limits (v1)

- No team filter on `list_channels`.
- No file upload, reactions, threads-as-first-class, or websocket/streaming.
- Does not invent posts. `create_post` must use the user's message.
- Stdio MCP only (`node server.mjs`).
