#!/usr/bin/env node
/**
 * Zero-dep stdio MCP: Obsidian Local REST API (community client).
 * Logs to stderr only. Never logs the API key.
 */
import https from "node:https";
import process from "node:process";
import { URL } from "node:url";

const SERVER_NAME = "obsidian-local-rest";
const SERVER_VERSION = "0.1.0";
const PROTOCOL = "2024-11-05";

function origin() {
  const raw = process.env.OBSIDIAN_API_URL;
  if (!raw) throw new Error("OBSIDIAN_API_URL is not set");
  return String(raw).trim().replace(/\/+$/, "");
}

function apiKey() {
  const k = process.env.OBSIDIAN_API_KEY;
  if (!k) throw new Error("OBSIDIAN_API_KEY is not set");
  return k;
}

class HttpError extends Error {
  constructor(status, statusText, body) {
    super(`HTTP ${status} ${statusText}`);
    this.status = status;
    this.body = body;
  }
}

function parseBody(status, statusText, contentType, text) {
  let data = text;
  if (text && String(contentType || "").includes("json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  } else if (!text) {
    data = null;
  }
  if (status < 200 || status >= 300) {
    throw new HttpError(status, statusText, data);
  }
  return data;
}

function httpsInsecure(u, method, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers,
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const text = Buffer.concat(chunks).toString("utf8");
          const ct = res.headers && res.headers["content-type"];
          resolve(
            parseBody(res.statusCode || 0, res.statusMessage || "", ct, text)
          );
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function api(method, path, jsonBody) {
  const url = origin() + path;
  const headers = {
    Authorization: `Bearer ${apiKey()}`,
    Accept: "application/json, text/markdown, */*",
  };
  let body;
  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(jsonBody);
  }
  const u = new URL(url);
  const localHttps =
    u.protocol === "https:" &&
    (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  if (localHttps) {
    return httpsInsecure(u, method, headers, body);
  }
  const opts = { method, headers };
  if (body !== undefined) opts.body = body;
  const res = await fetch(url, opts);
  const text = await res.text();
  return parseBody(res.status, res.statusText, res.headers.get("content-type"), text);
}

function vaultPath(p) {
  const s = String(p || "").replace(/^\/+/, "");
  const encoded = s
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return "/vault/" + encoded;
}

function asNoteMeta(entry, prefix) {
  if (typeof entry === "string") {
    const name = entry.replace(/^\/+/, "");
    const path = prefix
      ? prefix.replace(/\/+$/, "") + "/" + name
      : name;
    return { path };
  }
  if (entry && typeof entry === "object") {
    if (entry.path) return { path: entry.path };
    if (entry.name) {
      const name = String(entry.name).replace(/^\/+/, "");
      const path = prefix
        ? prefix.replace(/\/+$/, "") + "/" + name
        : name;
      return { path };
    }
  }
  return { path: String(entry) };
}

function asSearchHit(h) {
  const hit = {
    filename:
      (h && (h.filename || h.path || h.file)) || "",
  };
  if (h && h.score != null) hit.score = h.score;
  if (h && h.matches != null) hit.matches = h.matches;
  return hit;
}

const TOOLS = [
  {
    name: "list_notes",
    description:
      "Directory listing of the vault (root if path omitted). GET /vault/ or GET /vault/{path}/. Returns NoteMeta[] = [{ path }].",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Vault-relative directory" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_note",
    description:
      "Read a note's file contents. GET /vault/{path} (no trailing slash). Returns { path, content }.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Vault-relative file path" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "search_vault",
    description:
      "Simple full-text search. POST /search/simple/?query=... Maps API hits to { filename, score?, matches? }. Does not invent note bodies.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "append_note",
    description:
      "Append content to a note. PATCH /vault/{path} with JSON { operation: \"append\", content }. Does not invent content.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "Text to append; do not invent it" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case "list_notes": {
      const rel =
        args && args.path ? String(args.path).replace(/^\/+|\/+$/g, "") : "";
      const path = rel ? vaultPath(rel) + "/" : "/vault/";
      const data = await api("GET", path);
      let files = [];
      if (Array.isArray(data)) files = data;
      else if (data && Array.isArray(data.files)) files = data.files;
      const prefix = rel || "";
      return files.map((f) => asNoteMeta(f, prefix));
    }
    case "get_note": {
      if (!args.path) throw new Error("path is required");
      const data = await api("GET", vaultPath(args.path));
      let content;
      if (typeof data === "string") content = data;
      else if (data && typeof data.content === "string") content = data.content;
      else if (data == null) content = "";
      else content = JSON.stringify(data);
      return { path: args.path, content };
    }
    case "search_vault": {
      if (!args.query) throw new Error("query is required");
      const q = encodeURIComponent(args.query);
      const data = await api("POST", "/search/simple/?query=" + q);
      const rows = Array.isArray(data)
        ? data
        : (data && (data.results || data.matches)) || [];
      return rows.map(asSearchHit);
    }
    case "append_note": {
      if (!args.path) throw new Error("path is required");
      if (args.content == null) throw new Error("content is required");
      await api("PATCH", vaultPath(args.path), {
        operation: "append",
        content: String(args.content),
      });
      const data = await api("GET", vaultPath(args.path));
      let content;
      if (typeof data === "string") content = data;
      else if (data && typeof data.content === "string") content = data.content;
      else content = data == null ? "" : JSON.stringify(data);
      return { path: args.path, content };
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

function writeMessage(obj) {
  const json = JSON.stringify(obj);
  const body = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function resultOk(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function resultErr(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

function toolResult(data, isError) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: Boolean(isError),
  };
}

async function handle(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;
  if (method && String(method).startsWith("notifications/")) return;
  if (id === undefined || id === null) return;
  try {
    if (method === "initialize") {
      resultOk(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
      return;
    }
    if (method === "tools/list") {
      resultOk(id, { tools: TOOLS });
      return;
    }
    if (method === "ping") {
      resultOk(id, {});
      return;
    }
    if (method === "tools/call") {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      try {
        const data = await callTool(name, args);
        resultOk(id, toolResult(data, false));
      } catch (err) {
        const payload = {
          error: String(err.message || err),
        };
        if (err.status) payload.status = err.status;
        if (err.body) payload.body = err.body;
        resultOk(id, toolResult(payload, true));
      }
      return;
    }
    resultErr(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    resultErr(id, -32000, String(err.message || err));
  }
}

let buf = Buffer.alloc(0);
let contentLength = null;

function onChunk(chunk) {
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
        process.stderr.write("bad MCP header\n");
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
      process.stderr.write("bad JSON-RPC body\n");
      continue;
    }
    Promise.resolve(handle(msg)).catch((err) => {
      process.stderr.write(`handler error: ${err.message}\n`);
    });
  }
}

process.stdin.on("data", onChunk);
process.stdin.on("end", () => process.exit(0));
process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION} stdio MCP\n`);
