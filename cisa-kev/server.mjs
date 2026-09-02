#!/usr/bin/env node
/**
 * Zero-dep stdio MCP: CISA KEV catalog + optional OSV query (community client).
 * Public feeds; no auth. Logs to stderr only.
 */
import process from "node:process";

const SERVER_NAME = "cisa-kev";
const SERVER_VERSION = "0.1.0";
const PROTOCOL = "2024-11-05";
const DEFAULT_FEED =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const OSV_URL = "https://api.osv.dev/v1/query";
const CAP = 50;

const KEV_FIELDS = [
  "cveID",
  "vendorProject",
  "product",
  "vulnerabilityName",
  "dateAdded",
  "shortDescription",
  "requiredAction",
  "dueDate",
  "knownRansomwareCampaignUse",
];

let kevCache = null;

function asKevItem(v) {
  const item = {};
  for (const k of KEV_FIELDS) item[k] = v[k];
  return item;
}

function asOsvMatch(v) {
  return { id: v.id, summary: v.summary, affected: v.affected };
}

class HttpError extends Error {
  constructor(status, statusText, body) {
    super("HTTP " + status + " " + statusText);
    this.status = status;
    this.body = body;
  }
}

async function httpJson(url, opts = {}) {
  const headers = {
    Accept: "application/json",
    "User-Agent": "cisa-kev-cursor-plugin/0.1.0",
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { raw: text.slice(0, 500) }; }
  }
  if (!res.ok) throw new HttpError(res.status, res.statusText, data);
  return data;
}

async function loadKev() {
  if (kevCache) return kevCache;
  const fixture = process.env.CISA_KEV_FIXTURE;
  if (fixture) {
    const { readFileSync } = await import("node:fs");
    kevCache = JSON.parse(readFileSync(fixture, "utf8"));
    return kevCache;
  }
  const url = process.env.CISA_KEV_FEED_URL || DEFAULT_FEED;
  kevCache = await httpJson(url);
  return kevCache;
}

function matchesFilter(item, filt) {
  const hay = (s) => String(s || "").toLowerCase();
  const vendor = filt && filt.vendor;
  const product = filt && filt.product;
  const cve = filt && filt.cve;
  if (vendor && !hay(item.vendorProject).includes(hay(vendor))) return false;
  if (product && !hay(item.product).includes(hay(product))) return false;
  if (cve && !hay(item.cveID).includes(hay(cve))) return false;
  return true;
}

const TOOLS = [
  {
    name: "list_kev",
    description: "Fetch the CISA KEV catalog (cached for process lifetime) and filter by optional vendor, product, or cve substring (case-insensitive). Returns count, dateReleased, items (cap 50).",
    inputSchema: {
      type: "object",
      properties: {
        vendor: { type: "string" },
        product: { type: "string" },
        cve: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "kev_lookup",
    description: "Exact cveID lookup in the CISA KEV catalog. Returns the item or not found. Never invent catalog entries.",
    inputSchema: {
      type: "object",
      properties: { cve_id: { type: "string" } },
      required: ["cve_id"],
      additionalProperties: false
    }
  },
  {
    name: "osv_query",
    description: "Query api.osv.dev for a package version. Optional ecosystem. Pass-through of id, summary, affected. Does not wrap NVD.",
    inputSchema: {
      type: "object",
      properties: {
        package: { type: "string" },
        version: { type: "string" },
        ecosystem: { type: "string" }
      },
      required: ["package", "version"],
      additionalProperties: false
    }
  }
];

async function callTool(name, args) {
  switch (name) {
    case "list_kev": {
      const catalog = await loadKev();
      const vulns = Array.isArray(catalog.vulnerabilities)
        ? catalog.vulnerabilities
        : [];
      const filtered = vulns.filter((v) => matchesFilter(v, args || {}));
      const items = filtered.slice(0, CAP).map(asKevItem);
      return {
        count: filtered.length,
        dateReleased: catalog.dateReleased,
        items,
      };
    }
    case "kev_lookup": {
      if (!args.cve_id) throw new Error("cve_id is required");
      const catalog = await loadKev();
      const vulns = Array.isArray(catalog.vulnerabilities)
        ? catalog.vulnerabilities
        : [];
      const want = String(args.cve_id).toLowerCase();
      const hit = vulns.find((v) => String(v.cveID).toLowerCase() === want);
      if (!hit) {
        const err = new Error("not found: " + args.cve_id);
        err.status = 404;
        throw err;
      }
      return asKevItem(hit);
    }
    case "osv_query": {
      if (!args.package) throw new Error("package is required");
      if (!args.version) throw new Error("version is required");
      const pkg = { name: args.package };
      if (args.ecosystem) pkg.ecosystem = args.ecosystem;
      const data = await httpJson(OSV_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package: pkg, version: args.version }),
      });
      const vulns = Array.isArray(data && data.vulns) ? data.vulns : [];
      const matches = vulns.slice(0, CAP).map(asOsvMatch);
      return { count: matches.length, matches };
    }
    default:
      throw new Error("unknown tool: " + name);
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
