// Zero-dependency conformance probe for a running instance (default http://127.0.0.1:3000).
// Mirrors the machine-checkable half of the RSS-MCP-Audit skill. Exit 1 on any FAIL.
const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const results = [];
const rec = (lvl, name, detail = "") => { results.push(lvl); console.log(`${lvl.padEnd(4)} ${name}${detail ? " - " + detail : ""}`); };
const rpc = async (method, params) => {
  const r = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const t = await r.text();
  const line = t.startsWith("{") ? t : t.split("\n").find((l) => l.startsWith("data:"))?.slice(5) ?? "{}";
  return { status: r.status, headers: r.headers, body: JSON.parse(line) };
};
const get = async (p) => fetch(base + p);

for (const p of ["/health", "/version", "/.well-known/mcp.json", "/llms.txt", "/robots.txt"]) {
  const r = await get(p); rec(r.status === 200 ? "PASS" : "FAIL", `GET ${p}`, String(r.status));
}
rec((await get("/mcp")).status === 405 ? "PASS" : "FAIL", "GET /mcp is 405 (POST-only stateless)");
const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "audit", version: "1" } });
rec(init.body.result?.serverInfo ? "PASS" : "FAIL", "initialize", init.body.result?.serverInfo?.name);
rec(init.headers.get("mcp-session-id") ? "WARN" : "PASS", "no Mcp-Session-Id issued (stateless)");
const list = await rpc("tools/list", {});
const tools = list.body.result?.tools ?? [];
rec(tools.length > 0 ? "PASS" : "FAIL", "tools/list", `${tools.length} tools`);
const ver = await (await get("/version")).json();
rec(ver.tools === tools.length ? "PASS" : "FAIL", "tool count consistent across /version and tools/list");
for (const t of tools) {
  const ok = t.title && t.outputSchema && t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint === false && /^[a-z]+(_[a-z]+){2,}$/.test(t.name);
  rec(ok ? "PASS" : "FAIL", `tool ${t.name}`, ok ? "" : "missing title/outputSchema/annotations or bad name");
}
const bad = await rpc("tools/call", { name: "solar_calculate_size", arguments: {} });
rec(bad.body.result?.isError || bad.body.error ? "PASS" : "FAIL", "invalid input is an error, not a result");
const card = await (await get("/.well-known/mcp.json")).json();
rec(card.tool_count === tools.length ? "PASS" : "FAIL", "server card tool_count matches");
const fails = results.filter((r) => r === "FAIL").length;
console.log(`\n${results.filter((r) => r === "PASS").length} pass, ${results.filter((r) => r === "WARN").length} warn, ${fails} fail`);
process.exit(fails ? 1 : 0);
