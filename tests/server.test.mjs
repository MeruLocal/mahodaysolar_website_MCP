import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../dist/server.js";

async function connect(env = {}) {
  const { server, toolNames } = buildServer(env);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, toolNames };
}
const call = async (c, name, args = {}) => c.callTool({ name, arguments: args });

test("every tool is read-only, titled, named area_verb_noun and has an outputSchema", async () => {
  const { client, toolNames } = await connect();
  const { tools } = await client.listTools();
  assert.equal(tools.length, toolNames.length);
  for (const t of tools) {
    assert.match(t.name, /^[a-z]+(_[a-z]+){2,}$/, t.name);
    assert.ok(t.title, `${t.name} title`);
    assert.ok(t.outputSchema, `${t.name} outputSchema`);
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.annotations.openWorldHint, false);
  }
});

test("size estimate matches an independently computed value", async () => {
  const { client } = await connect();
  // 300 kWh / (30 * 5 * 0.8) = 2.5 kW; ceil(2500/550) = 5 panels
  const r = await call(client, "solar_calculate_size", { monthly_kwh: 300, peak_sun_hours: 5, performance_ratio: 0.8, panel_watt: 550, roof_m2_per_kw: 6 });
  assert.equal(r.structuredContent.data.required_kw, 2.5);
  assert.equal(r.structuredContent.data.panel_count, 5);
  assert.equal(r.structuredContent.data.roof_area_m2, 15);
});

test("size estimate refuses missing parameters (no defaults)", async () => {
  const { client } = await connect();
  const r = await call(client, "solar_calculate_size", { monthly_kwh: 300 });
  assert.equal(r.isError, true);
});

test("EMI matches the standard formula and the zero-rate case", async () => {
  const { client } = await connect();
  // 100000 at 12% for 12 months: 8884.88 (standard)
  const r = await call(client, "loan_calculate_emi", { principal: 100000, annual_rate_percent: 12, tenure_months: 12 });
  assert.equal(r.structuredContent.data.monthly_emi, 8884.88);
  const z = await call(client, "loan_calculate_emi", { principal: 12000, annual_rate_percent: 0, tenure_months: 12 });
  assert.equal(z.structuredContent.data.monthly_emi, 1000);
});

test("subsidy and net-metering tools are unsourced and carry no figures", async () => {
  const { client } = await connect();
  for (const [name, args] of [["subsidy_get_overview", {}], ["subsidy_get_state", { state: "Gujarat" }], ["netmetering_get_guide", {}]]) {
    const r = await call(client, name, args);
    assert.equal(r.structuredContent.status, "unsourced", name);
    const text = JSON.stringify(r.structuredContent);
    assert.doesNotMatch(text, /₹|Rs\.?\s?\d|\d\s?%|per kW|\bkW subsidy/i, `${name} must not state figures`);
  }
});

test("whole output corpus has no price, saving, rating, brand-crossing or invented-claim terms", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  const outputs = [];
  const safeArgs = { slug: "solar-amc", query: "amc", name: "amc-renewal", segment: "residential", dust_level: "low", system_kw: 3, state: "Gujarat", place: "Surat", interest: "amc" };
  for (const t of tools) {
    const keys = Object.keys(t.inputSchema.properties ?? {});
    if (keys.some((k) => ["monthly_kwh", "principal"].includes(k))) continue;
    const args = Object.fromEntries(keys.filter((k) => k in safeArgs).map((k) => [k, safeArgs[k]]));
    const r = await call(client, t.name, args);
    assert.notEqual(r.isError, true, t.name);
    outputs.push(JSON.stringify(r.structuredContent));
  }
  const corpus = outputs.join("\n");
  assert.doesNotMatch(corpus, /₹|\bRs\.?\s?\d|\$\d|aggregateRating|\bsave[sd]?\b|savings|payback|CRM|TaskSiddhi|HelloGrowth|guarantee/i);
});

test("every emitted page URL is a canonical mahodaysolar path; planned pages have no URL", async () => {
  const { client } = await connect();
  const r = await call(client, "site_search_pages", { query: "subsidy", limit: 5 });
  assert.ok(r.structuredContent.data.matches.length >= 1);
  for (const m of r.structuredContent.data.matches) assert.match(m.url, /^https:\/\/mahodaysolar\.com\/[a-z0-9\/-]+\?utm_source=mcp$/);
  assert.ok(r.structuredContent.data.planned_without_url.length >= 1);
});

test("business facts: unconfirmed by default, omitted when empty, shown when set", async () => {
  const none = await connect({});
  const a = await call(none.client, "business_get_info");
  assert.equal(a.structuredContent.status, "unconfirmed");
  assert.deepEqual(a.structuredContent.data.contact, {});
  const area = await call(none.client, "business_check_service_area", { place: "Surat" });
  assert.equal(area.structuredContent.status, "unconfirmed");
  assert.equal(area.structuredContent.data.covered, null);
  const set = await connect({ MAHODAYSOLAR_SERVICE_AREA: "Surat, Ahmedabad", MAHODAYSOLAR_PHONE: "  " });
  const b = await call(set.client, "business_check_service_area", { place: "Surat" });
  assert.equal(b.structuredContent.data.covered, true);
  const c = await call(set.client, "business_check_service_area", { place: "ra" });
  assert.equal(c.structuredContent.data.covered, null);
  const g = await connect({ MAHODAYSOLAR_SERVICE_AREA: "Greater Noida" });
  assert.equal((await call(g.client, "business_check_service_area", { place: "Noida" })).structuredContent.data.covered, null);
  assert.deepEqual((await call(set.client, "business_get_info")).structuredContent.data.contact, {});
});

test("input validation rejects odd state text and unknown slugs", async () => {
  const { client } = await connect();
  assert.equal((await call(client, "subsidy_get_state", { state: "<script>x</script>" })).isError, true);
  assert.equal((await call(client, "services_get_service", { slug: "nope" })).isError, true);
});

test("resources and prompts are listed", async () => {
  const { client } = await connect();
  const res = await client.listResources();
  assert.ok(res.resources.some((r) => r.uri === "mahodaysolar://pages"));
  const t = await client.readResource({ uri: "mahodaysolar://checklists/amc-renewal" });
  assert.match(t.contents[0].text, /renew/i);
  const p = await client.listPrompts();
  assert.ok(p.prompts.length >= 4);
});
