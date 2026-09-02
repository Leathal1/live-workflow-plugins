#!/usr/bin/env node
/**
 * Zero-dep stdio MCP: Mattermost REST API v4 (community client).
 * Logs to stderr only. Never logs tokens.
 */
import process from "node:process";

const SERVER_NAME = "mattermost";
const SERVER_VERSION = "0.1.0";
const PROTOCOL = "2024-11-05";

function origin() {
  const raw = process.env.MATTERMOST_URL;
  if (!raw) throw new Error("MATTERMOST_URL is not set");
  return String(raw).trim().replace(/\/+$/, "");
}

function token() {
  const t = process.env.MATTERMOST_TOKEN;
  if (!t) throw new Error("MATTERMOST_TOKEN is not set");
  return t;
}

function asTeam(t) {
  return { id: t.id, name: t.name, display_name: t.display_name };
}

function asChannel(c) {
  return {
    id: c.id,
    name: c.name,
    display_name: c.display_name,
    team_id: c.team_id,
    type: c.type,
  };
}

function asPost(p) {
  return {
    id: p.id,
    channel_id: p.channel_id,
    user_id: p.user_id,
    message: p.message,
    create_at: p.create_at,
  };
}

class HttpError extends Error {
  constructor(status, statusText, body) {
    super(`HTTP ${status} ${statusText}`);
    this.status = status;
    this.body = body;
  }
}

async function api(method, path, body) {
  const url = origin() + path;
  const headers = {
    Authorization: `Bearer ${token()}`,
    Accept: "application/json",
  };
  const opts = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text.slice(0, 500) };
    }
  }
  if (!res.ok) throw new HttpError(res.status, res.statusText, data);
  return data;
}

const TOOLS = [
  {
    name: "list_teams",
    description:
      "List teams the current user belongs to. GET /api/v4/users/me/teams.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_channels",
    description:
      "List channels the current user belongs to. GET /api/v4/users/me/channels. No team_id filter in v1.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_channel_posts",
    description:
      "Get posts in a channel. GET /api/v4/channels/{channel_id}/posts. Maps the posts object values to Post[].",
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "Channel id" },
        page: { type: "number", description: "Page number (optional)" },
        per_page: { type: "number", description: "Page size (optional)" },
      },
      required: ["channel_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_post",
    description:
      "Create a post in a channel. POST /api/v4/posts {channel_id, message}. Do not invent the message.",
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "Channel id" },
        message: { type: "string", description: "Post body as given by the user" },
      },
      required: ["channel_id", "message"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case "list_teams": {
      const rows = await api("GET", "/api/v4/users/me/teams");
      if (!Array.isArray(rows)) throw new Error("unexpected teams payload");
      return rows.map(asTeam);
    }
    case "list_channels": {
      const rows = await api("GET", "/api/v4/users/me/channels");
      if (!Array.isArray(rows)) throw new Error("unexpected channels payload");
      return rows.map(asChannel);
    }
    case "get_channel_posts": {
      if (!args.channel_id) throw new Error("channel_id is required");
      const q = new URLSearchParams();
      if (args.page != null) q.set("page", String(args.page));
      if (args.per_page != null) q.set("per_page", String(args.per_page));
      const qs = q.toString();
      const path =
        `/api/v4/channels/${encodeURIComponent(args.channel_id)}/posts` +
        (qs ? `?${qs}` : "");
      const data = await api("GET", path);
      const posts = data && data.posts && typeof data.posts === "object"
        ? Object.values(data.posts)
        : [];
      return posts.map(asPost);
    }
    case "create_post": {
      if (!args.channel_id) throw new Error("channel_id is required");
      if (args.message == null) throw new Error("message is required");
      const data = await api("POST", "/api/v4/posts", {
        channel_id: args.channel_id,
        message: args.message,
      });
      return asPost(data);
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
