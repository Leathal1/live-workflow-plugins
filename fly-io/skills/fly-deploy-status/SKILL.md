---
name: fly-deploy-status
description: When to list Fly apps, check app status, or inspect machines via official flyctl MCP. Use app/machine/status tools. Never invent app names or machine ids.
---

# Fly deploy status

Use this skill when the user wants to know which Fly apps exist, whether a deploy is healthy, or what Machines are running. Do not invent app names or machine ids.

This plugin wraps official `flyctl mcp server`. Tools come from flyctl itself (apps, machines, status, plus orgs/platform as needed). Call `tools/list` for the exact names on the installed flyctl. Fly docs inspector examples include `fly-apps-list`, `fly-machines-list`, `fly-orgs-list`, `fly-platform-status`.

## When to call which group

1. **apps** — list or inspect applications for the authenticated token. Use when the user asks which apps they have, or you need an app name they did not supply.
2. **status** — application current status, recent deployment details, allocated regions. Use when they ask if an app is up, what version is live, or deploy health.
3. **machine** — list or inspect Fly Machines for an app. Use when they ask which VMs are running, machine state, or a specific machine id they already gave.

Optional context (same flyctl MCP, not required for v1): **orgs** if they ask which org; **platform** for region/VM-size facts.

## Workflow

- Unknown app name → list apps first. Never guess slugs.
- Named app, overall health → status tools for that app.
- Named app, instance/VM detail → machine list/inspect. Never invent machine ids.
- Show only flyctl output. If a tool errors (auth, unknown app, missing flyctl), report the error. Do not fabricate status.
