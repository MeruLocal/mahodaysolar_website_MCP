# Mahoday Solar website MCP: audit and build spec (22 Oct 2026)

**Server audited:** the *website* MCP for Mahoday Solar (public, anonymous, read-only). This is not a CRM MCP and has no account data.
**Measured at:** `MeruLocal/mahodaysolar_website_MCP` `main` @ `7ebf18f` (one scaffold commit: README + .gitignore).
**Update (same day):** v0.1.0 of the server is now built in a follow-up PR (see `README.md`, `docs/COMPLETENESS.md`). Section 4.2 is the original design; **as built, tool names are `solar_calculate_size`, `loan_calculate_emi`, `amc_get_checklist` (replaces three AMC checklist tools), `quote_get_link`, etc., and `page_url` is carried as `citations[].url`** (planned pages are listed separately without a URL). Findings were reviewed by Astra; see `docs/astra-review.md`.

**Verdict at the time of the audit:** there was no server to audit. Every protocol, security and content check in the RSS-MCP-Audit skill is *not applicable yet*; this document is the spec that, once built, must pass those checks. Nothing below is measured behaviour of running code.

## 1. What was measured (evidence)

| Check | Command / source | Result |
|---|---|---|
| MCP repo contents | `git ls-tree -r main` | `.gitignore`, `README.md` ("scaffold only") |
| MCP repo PRs/branches | `gh pr list --state all`, `git branch -r` | none besides `main` |
| Site repo | `gh pr list --repo MeruLocal/mahodaysolar_website` | PR #3 (draft, `feat/site-build-2026-10-22`): 43-page Next.js site, noindex until `NEXT_PUBLIC_INDEXING=on`; PR #1 and #2: keyword research + launch spec (docs) |
| npm name free? | `curl registry.npmjs.org/mahodaysolar-mcp` | 404 (unclaimed, not reserved) |
| mcp.mahodaysolar.com | `curl` | no HTTP response (000); host not serving |
| mahodaysolar.com | `nslookup`, `curl` | resolves, but `curl` got no HTTP response in 15 s; **ownership and DNS control are unverified** (research notes call the domain "assumed") |

## 2. Findings, severity-ranked

| # | Sev | Finding | Evidence | Resolution in this spec |
|---|---|---|---|---|
| F1 | High | No server exists, so "perfect" cannot be satisfied by an audit | repo @ `7ebf18f` | section 4 build spec, section 9 acceptance tests |
| F2 | High | Biggest truth risk: subsidy and tariff figures. Research read only search summaries of PIB/MNRE; the portals returned a title only; draft MNRE PDFs quote different CFA rates | research folder `mahodaysolar/r2/docs/05-official-sources-and-claims.md` | section 5: an unsourced field returns `status:"unsourced"` plus the official link, never a number |
| F3 | High | Business facts unconfirmed (domain, service area, services sold, phone, GSTIN, markets) | site PR #3 launch checklist; research summary | section 5 R8: facts come from one `business.json`; empty fields are omitted; `check_service_area` answers "unconfirmed" until filled |
| F4 | Medium | Site builds 8 overseas pages (US/AU/GB/CA) with no confirmed overseas operation | site PR #3 | MCP serves India only at launch; overseas data absent until the founder confirms |
| F5 | Medium | Slug drift between docs and build: research docs use `/commercial-solar-om` and plan `/solar-panel-warranty` + `/pm-surya-ghar-subsidy` hub with 301; the build has `solar-plant-om` and blog `solar-panel-warranty-guide` | site `lib/services.ts`, `lib/posts.ts` vs `r2/docs/03-page-architecture.md` | section 4.4: page index generated from the site sitemap at build time; CI fails on any non-200 |
| F6 | Medium | Brand isolation: AMC-software vocabulary belongs to TaskSiddhi/HGC | `r2/docs/09-ownership-split.md` | R7: no CRM/software pitch, no cross-brand links |
| F7 | Medium | Traffic expectation | n/a | section 8: an MCP does not rank in Google; value is assistant citations and referral links; no traffic number promised |
| F8 | Low | Spec runway: the RSS skill (section 6) reports that revision 2026-07-28 removes sessions; **I did not verify this against the specification** | RSS skill section 6 | build stateless from day one (4.1) |

## 3. Positioning

A public, read-only knowledge-and-calculator server so an AI assistant answering a solar buyer can (a) compute transparent estimates from the user's own inputs, (b) retrieve sourced, dated explainers, and (c) cite and link the exact Mahoday page. Every tool result carries `citations[]` and `last_reviewed`, so citations point at the site.

## 4. Build spec

### 4.1 Transport and platform
- TypeScript, official `@modelcontextprotocol/sdk`, **Streamable HTTP, stateless** (no `Mcp-Session-Id` dependence), endpoint **`/mcp`** (not `/sse`, avoiding the confusion the HGC server suffers). Also `/health`, `/version` (tool count, content version, `content_checked_at`), `/.well-known/mcp.json` (server card).
- Anonymous, no auth, **no write tools at launch** (lead capture stays on the site form; a tool only returns a prefilled link). Every tool: `readOnlyHint:true`, `destructiveHint:false`, `idempotentHint:true`, `openWorldHint:false`, a `title`, and an `outputSchema` with `structuredContent`.
- Per-IP rate limit (socket address by default; with `MCP_TRUST_PROXY=1` the last `X-Forwarded-For` entry, i.e. exactly one trusted appending proxy), request body cap (tools are synchronous and do no I/O, so no per-tool timeout), Zod-validated bounded inputs, JSON-RPC errors that never echo free text.
- Never `?? 0` or `?? []` over lookups: a missing record returns explicit `not_found` / `unsourced`.
- Content is static JSON in the repo (no DB, no secrets, no outbound calls at request time). Entered bill amounts and other inputs are never logged.

### 4.2 Tools (names verb_noun; lists paginated)
| Tool | Purpose | Truth rule |
|---|---|---|
| `solar_size_estimate` | kW needed from monthly kWh, peak sun hours, performance ratio; panel count; roof m2 | **All three parameters are required inputs; no defaults.** Echo formula and inputs. No savings, payback or price |
| `solar_loan_emi` | standard EMI from the user's amount, rate, tenure | no bank rates stored |
| `subsidy_get_overview` | PM Surya Ghar overview | a field is returned only with `source_url` + `last_checked` + `verifier`; else `status:"unsourced"` and the official portal links |
| `subsidy_get_state` | state scheme by slug | same rule; state list from the site route list |
| `subsidy_estimate` | applies the published rate text | **not registered** until the central rule is verified; config flag, mirrors site calculator C2 |
| `net_metering_get_guide` | process, DISCOM pointers | sourced fields only |
| `amc_get_scope` | what an AMC covers by segment (residential, housing society, commercial) | qualitative scope table; no prices; no SLA numbers unless the owner supplies them |
| `amc_plan_visits` | inputs (kW, type, dust level, inverter brand, install year) to a task list | frequency bands cite a source or are omitted; no price |
| `amc_renewal_checklist` | questions before renewing; consequences of lapse | factual, no invented terms |
| `amc_quote_comparison_guide` | compare two AMC quotes (scope before price) | from the site guide |
| `compare_system_types` | on-grid / off-grid / hybrid; mono vs poly | general technical, sources linked |
| `installation_acceptance_checklist` | buyer checklist at handover | no brand claims |
| `services_list`, `service_get` | services Mahoday says it offers | generated from the site's service list; the owner's list is authoritative |
| `site_search_pages` | find a Mahoday page (title, url, summary) for citation | generated from the sitemap; CI checks every URL |
| `business_get_info`, `check_service_area` | confirmed contact and service area | confirmed fields only; unknown area returns `unconfirmed` + contact path |
| `quote_get_link` | URL of the site quote form with prefilled scope | returns a link; **submits nothing** |

Out of scope at launch: prices, savings, ROI, ratings, years in business, project counts, installer comparisons, brand or model recommendations, overseas rebates, legal or tax advice.

### 4.3 Resources and prompts
- Resources: `mahodaysolar://sources` (source register: topic, official URL, last_checked, verifier), `mahodaysolar://checklists/{amc-renewal,installation-acceptance,maintenance}`, `mahodaysolar://services`.
- Prompts: `size-my-rooftop-system`, `evaluate-an-amc-quote`, `prepare-for-installation-visit`, `is-my-system-underperforming`.

### 4.4 Data model (the anti-drift core)
`content/*.json` entries: `{id, value, source_url|null, last_checked|null, verifier|null, page_url}`. `scripts/build-content.mjs` generates the page index from the site sitemap and **fails CI** if: a numeric subsidy or tariff value lacks `source_url` + `last_checked` + `verifier`, or its `source_url` is not on an allow-list of official domains (draft PDFs and vendor pages rejected); `last_checked` is older than 35 days (subsidy) or 100 days (net metering); any emitted URL is not 200; the tool count differs across `/version`, README, `server.json` and `mcp.json` (one canonical count). This targets the HGC server's recurring failures (630 vs 525 integrations; Rs 1,099 reappearing).

## 5. Content-truth rules (binding)
- R1 No number for subsidy, tariff, irradiance, price, savings or payback unless sourced as in 4.4.
- R2 Draft MNRE PDFs and vendor blogs are not sources.
- R3 Calculators contain no built-in tariff, irradiance or performance ratio.
- R4 No "government approved/empanelled" unless on the official vendor list and linked.
- R5 Overseas content absent until the founder confirms operations.
- R6 Every payload carries `last_reviewed` and `citations[]`; a tool whose page does not exist yet cites no URL, never a guessed one.
- R7 No CRM/software pitch or cross-brand link.
- R8 Owner-confirmed facts only; empty means omitted.
- R9 No invented FAQs or reviews; no `aggregateRating`.

## 6. Alignment with the site (read-only check of PR #3 and the research docs)
- Built service slugs: solar-amc, solar-amc-renewal, solar-panel-maintenance, solar-panel-cleaning, solar-inverter-repair, solar-service, solar-plant-om, solar-monitoring, solar-installation; city: ahmedabad; markets US/AU/GB/CA; 9 guides under `/blog`.
- Pages the MCP depends on that do not exist yet (research docs 03, 06, 08): `/solar-calculator`, `/pm-surya-ghar-subsidy` hub, `/net-metering`, `/solar-subsidy/<state>`, `/solar-loan`, checklists. The MCP ships behind the site, wave by wave (R6).
- I did not build or typecheck the site branch.

## 7. Discovery surfaces (repo artifacts; none published)
1. `/.well-known/mcp.json` server card on the MCP host (name, description, endpoint, transport, tool names and count, no-auth statement).
2. Site side (separate PR in `mahodaysolar_website`, not made here): a line in `llms.txt`, a "For AI assistants" page with per-client install snippets, footer link.
3. `robots.txt` for the **MCP origin** (per-origin; the site's does not govern it).
4. README first screen: what it answers, one-line install, three example prompts.

## 8. Traffic and citation plan (honest)
An MCP endpoint is not itself an indexable page, so it does not rank in Google. Hypothesis to measure, not an observed benefit: assistants with it installed cite and link Mahoday pages, and directory listings (official registry, Smithery, Glama, PulseMCP) may add small referral and brand-search lift. No volume forecast is made. Measure with `utm_source=mcp` on every emitted `page_url` and aggregate call counters (no inputs logged). Real traffic still depends on the site being live and indexed (launch gate owned by the founder). Demand evidence for tool priority (Google Keyword Planner, India, 22 Oct 2026, research folder): calculators 5,400 / 4,400 / 1,300; net metering 5,400; UP subsidy 2,900; solar loan 2,400; EMI calculator 1,300; solar amc 110. So calculator and subsidy tools first, AMC tools second.

## 9. Acceptance tests (before any registry submission)
- RSS `audit-live-mcp.mjs`: 0 FAIL; the standing warns resolved (`title`, `outputSchema`, `listChanged` declared).
- `npx @modelcontextprotocol/inspector --cli <url> --transport http --method tools/list`; official `modelcontextprotocol/conformance`.
- Unit tests per formula with known answers computed independently in the test. Contract test: no tool response states a subsidy amount or percentage, tariff, price or "savings"; amounts derived from the caller's own inputs (EMI) are allowed.
- Link test: all emitted URLs 200 (bot-wall 403s checked in a browser). Statelessness test: `tools/call` without a prior initialize.
- Brand test: output corpus contains no "CRM", "TaskSiddhi", "HelloGrowth".
- Version parity: package.json / server.json / mcp.json / README tool count.

## 10. Build order
1. Skeleton, `/health`, `/version`, `/mcp`, CI (typecheck, vitest, versions). 2. Calculators. 3. Content pipeline and sitemap generation. 4. AMC, checklist and service tools. 5. Subsidy and net-metering tools **after** a named verifier reads the official sources. 6. Discovery and submission (`docs/submission/`).

## 11. Not verified
Domain ownership and DNS control; whether `mcp.mahodaysolar.com` can be provisioned; service area, services sold, phone, GSTIN; every PM Surya Ghar, MNRE and DISCOM fact (no session has read the official sources in full); whether site PR #3 was deployed; npm ownership for publishing; DNS TXT for the registry namespace. No scanner was run (nothing to scan); nothing was downloaded.
