#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NODE=/usr/bin/node
PY=/usr/bin/python3.13
echo "== node --check"
for s in mattermost/server.mjs cisa-kev/server.mjs obsidian-local-rest/server.mjs \
         scripts/mcp-smoke.mjs scripts/dummy-mattermost.mjs scripts/dummy-obsidian.mjs; do
  "$NODE" --check "$s"
  echo "  OK $s"
done

echo "== JSON.parse manifests"
"$PY" - << 'PY'
import json, pathlib
root = pathlib.Path(".")
files = [
  ".cursor-plugin/marketplace.json",
  "mattermost/.cursor-plugin/plugin.json",
  "mattermost/mcp.json",
  "cisa-kev/.cursor-plugin/plugin.json",
  "cisa-kev/mcp.json",
  "obsidian-local-rest/.cursor-plugin/plugin.json",
  "obsidian-local-rest/mcp.json",
]
for f in files:
    json.loads((root/f).read_text())
    print("  OK", f)
mp = json.loads((root/".cursor-plugin/marketplace.json").read_text())
assert mp["name"] == "live-workflow-plugins"
assert [p["name"] for p in mp["plugins"]] == ["mattermost", "cisa-kev", "obsidian-local-rest"]
for p in mp["plugins"]:
    assert p["source"] == p["name"]
try:
    import jsonschema
    schema = {
      "type": "object",
      "required": ["name", "owner", "plugins"],
      "properties": {
        "name": {"type": "string"},
        "owner": {"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}}},
        "metadata": {"type": "object"},
        "plugins": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["name", "source"],
            "properties": {
              "name": {"type": "string", "pattern": "^[a-z0-9][a-z0-9.-]*[a-z0-9]$"},
              "source": {"type": "string"},
              "description": {"type": "string"}
            }
          }
        }
      }
    }
    jsonschema.validate(mp, schema)
    print("  OK jsonschema marketplace.json")
except ImportError:
    print("  skip jsonschema (not installed)")
PY

echo "== local install (real copy)"
DEST="${HOME}/.cursor/plugins/local"
mkdir -p "$DEST"
for p in mattermost cisa-kev obsidian-local-rest; do
  rm -rf "$DEST/$p"
  mkdir -p "$DEST/$p"
  cp -a "$p/." "$DEST/$p/"
  if [[ -L "$DEST/$p" ]]; then echo "FAIL symlink $DEST/$p"; exit 1; fi
  echo "  copied $DEST/$p"
done

echo "== MCP prove"
set +e
./scripts/mcp-prove.sh | tee /tmp/lwp-prove.out
PROVE_RC=${PIPESTATUS[0]}
set -e
echo "== prove.sh done prove_rc=$PROVE_RC"
exit 0
