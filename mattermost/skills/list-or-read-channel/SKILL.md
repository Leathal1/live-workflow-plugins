---
name: list-or-read-channel
description: List Mattermost teams or channels, or read posts in a channel the user names. Use when they ask what teams/channels exist or what was posted. Never invent posts.
---

# List or read a Mattermost channel

Use this skill when the user wants to see their teams, list channels, or read messages that already exist. Do not use it to send a message.

## Tools (call these; do not invent data)

1. `list_teams` — no arguments. Returns `{ id, name, display_name }[]`.
2. `list_channels` — no arguments. Returns `{ id, name, display_name, team_id, type }[]`. v1 has no team filter; pick the channel from this list.
3. `get_channel_posts` — requires `channel_id` from a previous list (or an id the user supplied). Optional `page` / `per_page`. Returns `Post[]` with `{ id, channel_id, user_id, message, create_at }`.

## Workflow

- Teams/channels unknown → `list_teams` and/or `list_channels`, then ask or match by name.
- Reading a named channel → resolve `channel_id` from `list_channels`, then `get_channel_posts`.
- Show only what the API returned. Never invent posts, authors, timestamps, or channel ids.
- If a tool errors, report the error. Do not fabricate a transcript.
