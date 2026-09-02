#!/usr/bin/env node
/**
 * Local dummy Mattermost REST v4 for MCP smoke tests.
 * Require Authorization: Bearer <non-empty>. No real tokens.
 */
import http from "node:http";

const TEAM = { id: "t1", name: "engineering", display_name: "Engineering" };
const CHANNEL = {
  id: "c1",
  name: "town-square",
  display_name: "Town Square",
  team_id: "t1",
  type: "O",
};
const POST = {
  id: "p1",
  channel_id: "c1",
  user_id: "u1",
  message: "hello team",
  create_at: 1700000000000,
};

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
}

function unauthorized(res) {
  json(res, 401, { id: "api.context.session_expired.app_error", message: "Invalid or expired session, please login again." });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function bearerOk(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return Boolean(m && m[1]);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!bearerOk(req)) {
      unauthorized(res);
      return;
    }
    const u = new URL(req.url, "http://127.0.0.1");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "GET" && path === "/api/v4/users/me/teams") {
      json(res, 200, [TEAM]);
      return;
    }
    if (req.method === "GET" && path === "/api/v4/users/me/channels") {
      json(res, 200, [CHANNEL]);
      return;
    }
    const postsMatch = /^\/api\/v4\/channels\/([^/]+)\/posts$/.exec(path);
    if (req.method === "GET" && postsMatch) {
      const channelId = postsMatch[1];
      const post = { ...POST, channel_id: channelId };
      json(res, 200, { order: [post.id], posts: { [post.id]: post } });
      return;
    }
    if (req.method === "POST" && path === "/api/v4/posts") {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        json(res, 400, { message: "invalid JSON" });
        return;
      }
      const post = {
        id: body.id || "p-new",
        channel_id: body.channel_id,
        user_id: body.user_id || "u1",
        message: body.message,
        create_at: body.create_at || Date.now(),
      };
      json(res, 201, post);
      return;
    }
    json(res, 404, { message: "not found", path });
  } catch (err) {
    json(res, 500, { message: String(err.message || err) });
  }
});

const port = Number(process.env.PORT || 0);
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  process.stdout.write(`PORT=${addr.port}\n`);
  process.stderr.write(`dummy-mattermost http://127.0.0.1:${addr.port}\n`);
});
