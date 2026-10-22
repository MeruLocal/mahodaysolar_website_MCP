# Mahoday Solar MCP

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server for the Mahoday Solar website (`mahodaysolar_website`). India-first solar buyer questions: sizing and EMI calculators from **your own numbers**, pointers to **official** subsidy sources (it states **no** subsidy figure), AMC checklists, and canonical Mahoday Solar page URLs to cite.

No account, no API key, no personal data, no outbound requests, no write tools. Stateless Streamable HTTP plus stdio.

> **Status: draft v0.1.0, not deployed, not submitted anywhere.** The site pages it cites are launch-gated (draft PR `mahodaysolar_website#3`), so every URL is returned with `status: "launch-gated"`. Domain, host and contact details are unconfirmed.

## Tools (15, all `readOnlyHint: true`, each with `title` and `outputSchema`)

| Tool | What it does |
|---|---|
| `solar_calculate_size` | kW, panel count, roof area from monthly kWh, peak sun hours, performance ratio, panel watt. All required; no defaults; no price or saving |
| `loan_calculate_emi` | EMI from amount, rate, tenure you enter |
| `subsidy_get_overview`, `subsidy_get_state`, `netmetering_get_guide` | Where to confirm rules (official portals). Status always `unsourced`; no rate, cap or rule |
| `amc_get_scope`, `amc_plan_visits`, `amc_get_checklist` | What an AMC covers, task list and questions for a provider, four checklists |
| `services_list_offered`, `services_get_service`, `site_search_pages` | Services as described on the site, plus URLs to cite |
| `system_compare_types` | On-grid / off-grid / hybrid, qualitative |
| `business_get_info`, `business_check_service_area` | Owner-confirmed facts only; `unconfirmed` until set |
| `quote_get_link` | URL of the site form; submits nothing |

Also 3 resources (`mahodaysolar://pages`, `://sources`, `://checklists/{name}`) and 4 prompts. Every result carries `status` (`ok | unsourced | unconfirmed | not_found`), `citations` and `last_reviewed`.

## Install

Local (stdio):
```bash
npm install && npm run build
claude mcp add mahodaysolar -- node /absolute/path/to/mahodaysolar_website_MCP/dist/index.js
```
Remote (after it is deployed; host unconfirmed): `claude mcp add --transport http mahodaysolar https://mcp.mahodaysolar.com/mcp`

Run HTTP: `PORT=3000 npm run start:http` (binds 127.0.0.1; set `MCP_HTTP_HOST`, `MCP_ALLOWED_HOSTS`, `MCP_TRUST_PROXY` behind a proxy). Docker: `docker build -t mahodaysolar-mcp .`

## Endpoints
`POST /mcp` (stateless JSON-RPC) · `/.well-known/mcp.json` · `/llms.txt` · `/robots.txt` · `/health` · `/version`. `GET /mcp` returns 405 by design.

## Content-truth rules
No subsidy rate/cap/eligibility/tariff/price/saving/rating/years/project count anywhere; calculators take every parameter from the caller; business facts come from env and are omitted when empty; brand isolation (no CRM or other-brand mentions). Enforced by `tests/server.test.mjs`. Page content is generated from the site repo: `npm run gen:pages -- <services.ts> <posts.ts>`.

## Verify
`npm test` (unit + HTTP, 15 tests) · `npm run check:versions` · `npm run audit:live -- http://127.0.0.1:3000` (zero-dependency probe).

## Docs
[`docs/SPEC.md`](docs/SPEC.md) audit findings and design · [`docs/GO_NO_GO.md`](docs/GO_NO_GO.md) one-page decision note · [`docs/COMPLETENESS.md`](docs/COMPLETENESS.md) Done/Gap checklist · [`docs/submission/`](docs/submission/) registry packets (drafts, nothing submitted).
