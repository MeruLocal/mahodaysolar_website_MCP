import { test } from "node:test";
import assert from "node:assert/strict";
import { createHttpServer } from "../dist/http.js";
import { RateLimiter } from "../dist/ratelimit.js";

const start = (opts = {}) => new Promise((resolve) => {
  const s = createHttpServer({ port: 0, host: "127.0.0.1", allowedHosts: ["*"], ...opts });
  s.listen(0, "127.0.0.1", () => resolve({ s, base: `http://127.0.0.1:${s.address().port}` }));
});
const rpc = (base, body) => fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });

test("stateless: tools/call works with no initialize and no session id", async () => {
  const { s, base } = await start();
  const r = await rpc(base, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("mcp-session-id"), null);
  const text = await r.text();
  assert.match(text, /solar_calculate_size/);
  s.close();
});

test("discovery surfaces", async () => {
  const { s, base } = await start();
  const card = await (await fetch(`${base}/.well-known/mcp.json`)).json();
  const v = await (await fetch(`${base}/version`)).json();
  assert.equal(card.tool_count, v.tools);
  assert.equal(card.tools.length, v.tools);
  assert.equal(card.read_only, true);
  assert.match(await (await fetch(`${base}/llms.txt`)).text(), /mcp/i);
  assert.equal((await fetch(`${base}/health`)).status, 200);
  s.close();
});

test("GET /mcp is 405, unknown path 404, bad JSON 400, oversize 413", async () => {
  const { s, base } = await start();
  assert.equal((await fetch(`${base}/mcp`)).status, 405);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  const bad = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{" });
  assert.equal(bad.status, 400);
  const big = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ x: "a".repeat(70_000) }) });
  assert.equal(big.status, 413);
  s.close();
});

test("rate limit returns 429 with Retry-After", async () => {
  const { s, base } = await start({ rateMax: 2 });
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await rpc(base, { jsonrpc: "2.0", id: i, method: "tools/list" })).status);
  assert.deepEqual(codes.slice(0, 2), [200, 200]);
  assert.equal(codes[3], 429);
  s.close();
});

test("limiter fails open with no key and resets after the window", () => {
  let t = 0;
  const l = new RateLimiter(1, 1000, () => t);
  assert.equal(l.check(undefined).ok, true);
  assert.equal(l.check("a").ok, true);
  assert.equal(l.check("a").ok, false);
  t = 1500;
  assert.equal(l.check("a").ok, true);
});

test("business env reaches tools over HTTP", async () => {
  process.env.MAHODAYSOLAR_SERVICE_AREA = "Surat";
  const { s, base } = await start();
  const r = await rpc(base, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "business_check_service_area", arguments: { place: "Surat" } } });
  assert.match(await r.text(), /\\"covered\\": true|"covered":\s?true/);
  delete process.env.MAHODAYSOLAR_SERVICE_AREA;
  s.close();
});

test("malformed request target does not kill the process", async () => {
  const { s, base } = await start();
  const { request } = await import("node:http");
  await new Promise((resolve) => {
    const r = request({ host: "127.0.0.1", port: new URL(base).port, path: "//[", method: "GET" }, (res) => { res.resume(); res.on("end", resolve); });
    r.on("error", resolve); r.end();
  });
  assert.equal((await fetch(`${base}/health`)).status, 200);
  s.close();
});

test("rate limit key is the last X-Forwarded-For entry when proxy is trusted", async () => {
  const { s, base } = await start({ rateMax: 1, trustProxy: true });
  const post = (xff) => fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": xff }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  assert.equal((await post("1.1.1.1, 9.9.9.9")).status, 200);
  assert.equal((await post("2.2.2.2, 9.9.9.9")).status, 429); // spoofed leftmost value does not reset the quota
  s.close();
});
