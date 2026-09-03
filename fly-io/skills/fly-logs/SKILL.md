---
name: fly-logs
description: When to fetch Fly application logs via official flyctl MCP log tools. Never invent log lines.
---

# Fly logs

Use this skill when the user wants to see logs from a Fly app or machine. Do not use it to guess what an app printed.

This plugin wraps official `flyctl mcp server`. Log tools come from flyctl itself (logs command group). Call `tools/list` for the exact name on the installed flyctl.

## Tool group

**logs** — view application logs generated on the Fly platform. Requires an app name from the user or from a prior apps-list call. Optional machine id / region only if the user supplied them or a previous machine-list returned them.

## Workflow

1. If the app name is unknown, list apps first (apps group). Never invent a slug.
2. Call the flyctl logs tool for that app. Do not tail endlessly in chat; report what the tool returned.
3. Quote log lines only from the tool result. Never invent stack traces, timestamps, or request ids.
4. If the tool errors (bad token, unknown app, missing flyctl), report the error. Do not fabricate logs.
