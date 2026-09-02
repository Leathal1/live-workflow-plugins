---
name: read-or-append-note
description: List, read, or search Obsidian notes via Local REST API, or append text the user provided. Never invent note content.
---

# Read or append an Obsidian note

Use this skill when the user wants vault files listed, a note read, a search, or text appended to a note. Do not overwrite a whole file; v1 only appends.

## Tools

1. `list_notes` — optional `path` (directory). Root if omitted. Returns `{ path }[]`. Use to discover files, not to guess names.
2. `get_note` — required `path`. Returns `{ path, content }` from the API text body.
3. `search_vault` — required `query`. Returns `{ filename, score?, matches? }`. Hits are not full notes; call `get_note` if you need the body.
4. `append_note` — required `path` and `content`. PATCH-append only. `content` must be the user's text (or text they asked you to add). Never invent a journal entry or meeting notes.

## When to use which

- "What notes exist" / folder listing → `list_notes`.
- "Open / show this note" → `get_note` (resolve path via list or search first if needed).
- Keyword find → `search_vault`, then `get_note` on a hit the user cares about.
- "Add this to the note" → `append_note` with their content. Do not append unless they asked to write.

If a tool errors, report it. Do not fabricate markdown.
