#!/usr/bin/env node
/**
 * Local dummy Obsidian Local REST API for MCP smoke tests.
 * Require Authorization: Bearer <non-empty>. No real keys.
 */
import http from "node:http";

const vault = {
  "Welcome.md": "# Welcome\nThis is a sample note.\n",
  "Projects/todo.md": "# Todo\n- [ ] example\n",
};

function send(res, status, body, contentType) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  res.writeHead(status, {
    "Content-Type": contentType || "application/json",
    "Content-Length": buf.length,
  });
  res.end(buf);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), "application/json");
}

function unauthorized(res) {
  json(res, 401, { message: "Invalid API key" });
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

function listDir(dir) {
  const prefix = dir ? dir.replace(/\/+$/, "") + "/" : "";
  const names = [];
  const seen = new Set();
  for (const p of Object.keys(vault)) {
    if (prefix && !p.startsWith(prefix)) continue;
    if (!prefix && p.indexOf("/") === -1) {
      if (!seen.has(p)) {
        seen.add(p);
        names.push(p);
      }
      continue;
    }
    const rest = prefix ? p.slice(prefix.length) : p;
    if (!rest) continue;
    const i = rest.indexOf("/");
    const name = i === -1 ? rest : rest.slice(0, i) + "/";
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return { files: names };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!bearerOk(req)) {
      unauthorized(res);
      return;
    }
    const u = new URL(req.url, "http://127.0.0.1");
    const pathname = u.pathname;

    if (req.method === "POST" && pathname === "/search/simple/") {
      const query = String(u.searchParams.get("query") || "").toLowerCase();
      const hits = [];
      for (const [filename, content] of Object.entries(vault)) {
        const hay = (filename + "\n" + content).toLowerCase();
        if (query && hay.includes(query)) {
          hits.push({ filename, score: 1 });
        }
      }
      json(res, 200, hits);
      return;
    }

    if (!pathname.startsWith("/vault")) {
      json(res, 404, { message: "not found", path: pathname });
      return;
    }

    const vaultPart = pathname.slice("/vault".length); // "" | "/" | "/Welcome.md" | "/Projects/"
    const isDir = vaultPart === "" || vaultPart === "/" || vaultPart.endsWith("/");
    const rel = decodeURIComponent(vaultPart.replace(/^\/+|\/+$/g, ""));

    if (req.method === "GET" && isDir) {
      json(res, 200, listDir(rel));
      return;
    }

    if (req.method === "GET") {
      if (!(rel in vault)) {
        json(res, 404, { message: "not found", path: rel });
        return;
      }
      send(res, 200, vault[rel], "text/markdown");
      return;
    }

    if (req.method === "PATCH") {
      const raw = await readBody(req);
      const ct = String(req.headers["content-type"] || "");
      let append = "";
      if (ct.includes("json")) {
        let body = {};
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          json(res, 400, { message: "invalid JSON" });
          return;
        }
        append = body.content != null ? String(body.content) : "";
      } else {
        append = raw;
      }
      const prev = rel in vault ? vault[rel] : "";
      vault[rel] = prev + append;
      json(res, 200, { path: rel, appended: true });
      return;
    }

    json(res, 405, { message: "method not allowed" });
  } catch (err) {
    json(res, 500, { message: String(err.message || err) });
  }
});

const port = Number(process.env.PORT || 0);
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  process.stdout.write(`PORT=${addr.port}\n`);
  process.stderr.write(`dummy-obsidian http://127.0.0.1:${addr.port}\n`);
});
