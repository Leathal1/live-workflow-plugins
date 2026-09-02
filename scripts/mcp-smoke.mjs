#!/usr/bin/env node
/**
 * Spawn a stdio MCP server, send Content-Length initialize, tools/list,
 * and tools/call for each listed tool. Exit non-zero on isError or missing tool.
 *
 * Usage:
 *   node scripts/mcp-smoke.mjs <server.mjs> [toolName[:jsonArgs] ...]
 *
 * Env is inherited (MATTERMOST_URL, OBSIDIAN_API_KEY, CISA_KEV_FIXTURE, ...).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";

const TIMEOUT_MS = 60000;

function writeMessage(stream, obj) {
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, "utf8");
  stream.write(`Content-Length: ${body.length}\r\n\r\n`);
  stream.write(body);
}

function makeReader(stream) {
  let buf = Buffer.alloc(0);
  let contentLength = null;
  const queue = [];
  let waiter = null;

  function deliver(msg) {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w(msg);
    } else {
      queue.push(msg);
    }
  }

  stream.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      if (contentLength == null) {
        let headerEnd = buf.indexOf("\r\n\r\n");
        let sep = 4;
        if (headerEnd === -1) {
          headerEnd = buf.indexOf("\n\n");
          sep = 2;
        }
        if (headerEnd === -1) return;
        const header = buf.subarray(0, headerEnd).toString("utf8");
        const m = header.match(/Content-Length:\s*(\d+)/i);
        if (!m) {
          buf = buf.subarray(headerEnd + sep);
          continue;
        }
        contentLength = parseInt(m[1], 10);
        buf = buf.subarray(headerEnd + sep);
      }
      if (buf.length < contentLength) return;
      const body = buf.subarray(0, contentLength).toString("utf8");
      buf = buf.subarray(contentLength);
      contentLength = null;
      let msg;
      try {
        msg = JSON.parse(body);
      } catch (err) {
        deliver({ parseError: String(err), raw: body.slice(0, 500) });
        continue;
      }
      deliver(msg);
    }
  });

  return function next(ms) {
    if (queue.length) return Promise.resolve(queue.shift());
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        waiter = null;
        reject(new Error(`timeout waiting for MCP message after ${ms}ms`));
      }, ms);
      waiter = (msg) => {
        clearTimeout(t);
        resolve(msg);
      };
    });
  };
}

function parseToolSpec(spec) {
  const i = spec.indexOf(":");
  if (i === -1) return { name: spec, arguments: {} };
  const name = spec.slice(0, i);
  const raw = spec.slice(i + 1);
  let args = {};
  if (raw) {
    args = JSON.parse(raw);
  }
  return { name, arguments: args };
}

function snippet(obj, n = 400) {
  const s = typeof obj === "string" ? obj : JSON.stringify(obj);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    process.stderr.write("usage: node mcp-smoke.mjs <server.mjs> [toolName[:jsonArgs] ...]\n");
    process.exit(2);
  }
  const serverPath = path.resolve(args[0]);
  const toolSpecs = args.slice(1).map(parseToolSpec);
  if (process.env.MCP_SMOKE_TOOLS_FILE) {
    const extra = JSON.parse(fs.readFileSync(process.env.MCP_SMOKE_TOOLS_FILE, "utf8"));
    for (const t of extra) toolSpecs.push({ name: t.name, arguments: t.arguments || {} });
  }
  const stderrChunks = [];
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  child.stderr.on("data", (c) => stderrChunks.push(c));
  child.on("error", (err) => {
    process.stderr.write(`spawn error: ${err.message}\n`);
  });

  const next = makeReader(child.stdout);
  let failed = 0;
  let id = 0;

  async function rpc(method, params) {
    const reqId = ++id;
    writeMessage(child.stdin, { jsonrpc: "2.0", id: reqId, method, params });
    const msg = await next(TIMEOUT_MS);
    if (msg && msg.parseError) {
      throw new Error("bad MCP JSON: " + msg.parseError);
    }
    return msg;
  }

  try {
    const init = await rpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-smoke", version: "0.1.0" },
    });
    console.log("== initialize ==");
    console.log(snippet(init && init.result ? init.result : init));
    if (!init || !init.result) {
      console.log("FAIL initialize: no result");
      failed++;
    } else {
      console.log("PASS initialize");
    }

    const listed = await rpc("tools/list", {});
    console.log("== tools/list ==");
    const tools = (listed && listed.result && listed.result.tools) || [];
    const names = tools.map((t) => t.name);
    console.log("tools:", names.join(", ") || "(none)");
    const missing = toolSpecs
      .map((t) => t.name)
      .filter((n, i, a) => a.indexOf(n) === i && !names.includes(n));
    if (missing.length) {
      console.log("FAIL missing tools:", missing.join(", "));
      failed++;
    } else if (toolSpecs.length) {
      console.log("PASS tools/list (all requested tools present)");
    } else {
      console.log("PASS tools/list");
    }

    for (const spec of toolSpecs) {
      console.log(`== tools/call ${spec.name} ==`);
      const msg = await rpc("tools/call", {
        name: spec.name,
        arguments: spec.arguments,
      });
      const result = msg && msg.result;
      const isError = Boolean(result && result.isError) || Boolean(msg && msg.error);
      let payload = result;
      if (result && Array.isArray(result.content) && result.content[0] && result.content[0].text) {
        try {
          payload = JSON.parse(result.content[0].text);
        } catch {
          payload = result.content[0].text;
        }
      }
      console.log(snippet(payload, 800));
      if (isError || (msg && msg.error)) {
        console.log(`FAIL ${spec.name}`);
        failed++;
      } else {
        console.log(`PASS ${spec.name}`);
      }
    }
  } catch (err) {
    console.log("FAIL exception:", err.message);
    failed++;
  } finally {
    try {
      child.stdin.end();
    } catch {
      /* ignore */
    }
    const killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
    await new Promise((resolve) => child.on("exit", resolve));
    clearTimeout(killTimer);
    const errText = Buffer.concat(stderrChunks).toString("utf8").trim();
    if (errText) {
      console.log("== server stderr ==");
      console.log(errText.slice(0, 1500));
    }
  }

  if (failed) {
    process.exit(1);
  }
}

main();
