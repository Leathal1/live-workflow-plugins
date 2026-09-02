#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NODE=/usr/bin/node

start_dummy() {
  local script="$1"
  local out="$2"
  "$NODE" "$script" >"$out" 2>"$out.err" &
  echo $!
}

wait_port() {
  local f="$1"
  local i=0
  while [[ $i -lt 50 ]]; do
    if [[ -s "$f" ]] && tr -d '\n' <"$f" | grep -q 'PORT='; then
      tr -d '\n' <"$f" | sed 's/.*PORT=//' | sed 's/[^0-9].*//'
      return 0
    fi
    sleep 0.1
    i=$((i+1))
  done
  echo "timeout waiting for $f" >&2
  cat "$f" >&2 || true
  cat "$f.err" >&2 || true
  return 1
}

MM_OUT=/tmp/lwp-mm.port
OBS_OUT=/tmp/lwp-obs.port
rm -f "$MM_OUT" "$OBS_OUT"
MM_PID=$(start_dummy scripts/dummy-mattermost.mjs "$MM_OUT")
OBS_PID=$(start_dummy scripts/dummy-obsidian.mjs "$OBS_OUT")
trap 'kill $MM_PID $OBS_PID 2>/dev/null || true' EXIT
MM_PORT=$(wait_port "$MM_OUT")
OBS_PORT=$(wait_port "$OBS_OUT")
echo "dummy mattermost port=$MM_PORT obsidian port=$OBS_PORT"

echo
echo "==== mattermost ===="
MATTERMOST_URL="http://127.0.0.1:${MM_PORT}" \
MATTERMOST_TOKEN=dummy \
MCP_SMOKE_TOOLS_FILE="$ROOT/scripts/calls-mm.json" \
"$NODE" scripts/mcp-smoke.mjs "$ROOT/mattermost/server.mjs"

echo
echo "==== obsidian-local-rest ===="
OBSIDIAN_API_URL="http://127.0.0.1:${OBS_PORT}" \
OBSIDIAN_API_KEY=dummy \
MCP_SMOKE_TOOLS_FILE="$ROOT/scripts/calls-obs.json" \
"$NODE" scripts/mcp-smoke.mjs "$ROOT/obsidian-local-rest/server.mjs"

echo
echo "==== cisa-kev live ===="
set +e
MCP_SMOKE_TOOLS_FILE="$ROOT/scripts/calls-cisa.json" \
"$NODE" scripts/mcp-smoke.mjs "$ROOT/cisa-kev/server.mjs"
CISA_RC=$?
MCP_SMOKE_TOOLS_FILE="$ROOT/scripts/calls-cisa-lookup.json" \
"$NODE" scripts/mcp-smoke.mjs "$ROOT/cisa-kev/server.mjs"
LOOKUP_RC=$?
set -e
if [[ $CISA_RC -ne 0 || $LOOKUP_RC -ne 0 ]]; then
  echo "==== cisa-kev fixture fallback ===="
  CISA_KEV_FIXTURE="$ROOT/cisa-kev/fixtures/kev-sample.json" \
  MCP_SMOKE_TOOLS_FILE="$ROOT/scripts/calls-cisa-lookup.json" \
  "$NODE" scripts/mcp-smoke.mjs "$ROOT/cisa-kev/server.mjs"
fi

echo "mcp-prove done"
