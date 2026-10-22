#!/usr/bin/env node
/**
 * Streamable HTTP entry point. Stateless: each POST gets a fresh server and transport, so nothing
 * leaks between callers and the process can sit behind any load balancer. Holds no secrets and makes
 * no outbound requests. Binds to 127.0.0.1 unless MCP_HTTP_HOST says otherwise.
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { LAST_REVIEWED, SITE_URL } from "./data.js";
import { RateLimiter } from "./ratelimit.js";

const MAX_BODY_BYTES = 64 * 1024;

export interface HttpOptions { port?: number; host?: string; allowedHosts?: string[]; rateMax?: number; trustProxy?: boolean; publicUrl?: string }

const sendJson = (res: ServerResponse, status: number, payload: unknown, extra: Record<string, string> = {}) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body), ...extra });
  res.end(body);
};

const MAX_DRAIN_BYTES = 1024 * 1024;

/** Stops storing past the cap but keeps draining (bounded) so the 413 can be delivered before the socket closes. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  let over = false;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_DRAIN_BYTES) { req.destroy(); throw Object.assign(new Error("Request body too large"), { status: 413 }); }
    if (size > MAX_BODY_BYTES) { over = true; continue; }
    chunks.push(chunk as Buffer);
  }
  if (over) throw Object.assign(new Error("Request body too large"), { status: 413 });
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const readPublic = (name: string) => readFileSync(publicDir + name, "utf8");

export function createHttpServer(opts: HttpOptions = {}): Server {
  const port = opts.port ?? Number(process.env.PORT ?? 3000);
  const host = opts.host ?? process.env.MCP_HTTP_HOST ?? "127.0.0.1";
  const allowedHosts = opts.allowedHosts ?? (process.env.MCP_ALLOWED_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const trustProxy = opts.trustProxy ?? process.env.MCP_TRUST_PROXY === "1";
  const publicUrl = (opts.publicUrl ?? process.env.MCP_PUBLIC_URL ?? "https://mcp.mahodaysolar.com").replace(/\/$/, "");
  const limiter = new RateLimiter(opts.rateMax ?? Number(process.env.MCP_RATE_LIMIT_PER_MIN ?? 60), 60_000);
  const { server: probe, toolNames } = buildServer({});
  void probe.close();

  const clientKey = (req: IncomingMessage): string | undefined => {
    if (trustProxy) {
      const xff = req.headers["x-forwarded-for"];
      // MCP_TRUST_PROXY=1 means exactly one trusted proxy that APPENDS the peer address, so the last entry is the real client.
      const first = (Array.isArray(xff) ? xff.join(",") : xff)?.split(",").map((s) => s.trim()).filter(Boolean).pop();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? undefined;
  };

  return createServer((req, res) => {
    const fail = () => { if (!res.headersSent) sendJson(res, 500, { error: "Internal server error" }); else res.end(); };
    void (async () => {
      let url: URL;
      try { url = new URL(req.url ?? "/", "http://localhost"); } catch { return sendJson(res, 400, { error: "Bad request target" }); }

      if (url.pathname === "/health") return sendJson(res, 200, { status: "ok", server: SERVER_NAME, version: SERVER_VERSION });
      if (url.pathname === "/version") return sendJson(res, 200, { name: SERVER_NAME, version: SERVER_VERSION, tools: toolNames.length, content_reviewed: LAST_REVIEWED });
      if (url.pathname === "/.well-known/mcp.json") {
        const card = JSON.parse(readPublic("mcp.json")) as Record<string, unknown>;
        return sendJson(res, 200, { ...card, version: SERVER_VERSION, endpoint: `${publicUrl}/mcp`, tools: toolNames, tool_count: toolNames.length });
      }
      if (url.pathname === "/llms.txt") {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        return void res.end(readPublic("llms.txt").replaceAll("{{ENDPOINT}}", `${publicUrl}/mcp`).replaceAll("{{SITE}}", SITE_URL));
      }
      if (url.pathname === "/robots.txt") {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        return void res.end("User-agent: *\nAllow: /\nAllow: /.well-known/\nAllow: /llms.txt\n");
      }
      if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        return void res.end(`Mahoday Solar MCP server (read-only, no API key).\nMCP endpoint: POST ${publicUrl}/mcp\nDiscovery: /.well-known/mcp.json, /llms.txt, /health, /version\n`);
      }
      if (url.pathname !== "/mcp") return sendJson(res, 404, { error: "Not found. The MCP endpoint is POST /mcp." });
      if (req.method !== "POST") return sendJson(res, 405, { error: "This endpoint speaks JSON-RPC over POST (stateless Streamable HTTP)." }, { allow: "POST" });

      const rl = limiter.check(clientKey(req));
      if (!rl.ok) return sendJson(res, 429, { jsonrpc: "2.0", error: { code: -32000, message: "Rate limit exceeded. Retry later." }, id: null }, { "retry-after": String(rl.retryAfterSeconds) });

      const { server } = buildServer(process.env);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableDnsRebindingProtection: !allowedHosts.includes("*"),
        allowedHosts: [`${host}:${port}`, `localhost:${port}`, `127.0.0.1:${port}`, ...allowedHosts],
      });
      res.on("close", () => { void transport.close(); void server.close(); });
      try {
        await server.connect(transport);
        await transport.handleRequest(req, res, await readJsonBody(req));
      } catch (error) {
        const status = (error as { status?: number }).status === 413 ? 413 : error instanceof SyntaxError ? 400 : 500;
        if (!res.headersSent) sendJson(res, status, { jsonrpc: "2.0", error: { code: status === 500 ? -32603 : -32700, message: status === 413 ? "Request body too large" : status === 400 ? "Invalid JSON" : "Internal server error" }, id: null });
      }
    })().catch(fail);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.MCP_HTTP_HOST ?? "127.0.0.1";
  const http = createHttpServer({ port, host });
  http.listen(port, host, () => process.stderr.write(`mahodaysolar-mcp listening on http://${host}:${port}/mcp\n`));
  const stop = () => http.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
