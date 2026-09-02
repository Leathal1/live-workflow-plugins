---
name: create-post
description: Post a message to a Mattermost channel. Use only when the user asked to send or post. Pass the user's message unchanged to create_post.
---

# Create a Mattermost post

Use this skill only when the user clearly wants to send a message. Do not post as a side effect of listing or reading.

## Tool

`create_post` with:

- `channel_id` (string, required) — from `list_channels` or an id the user gave.
- `message` (string, required) — the user's message only. Do not rewrite, pad, or invent text.

## Workflow

1. If `channel_id` is unknown, call `list_channels` and match the channel they named.
2. Call `create_post` with `{ channel_id, message }` using their wording.
3. Return the API post (`id`, `channel_id`, `user_id`, `message`, `create_at`). Do not invent a confirmation if the tool errors.
