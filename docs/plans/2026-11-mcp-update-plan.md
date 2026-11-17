# Plan: Mahoday Solar MCP update from the 2026-11 site research

Status: **plan only**. No code, tool or data change is made by this PR. A human merges.
Date: 2026-11-17.

Inputs (pinned, because the research session may still be adding commits):

| Input | Repo / path | Commit |
|---|---|---|
| MCP update brief | site repo `mahodaysolar_website`, branch `research/loops-2026-11`, `docs/research/mcp-update-brief.md` | `975772d` (also the branch tip when read) |
| Market page plan | same branch, `docs/research/pages/market-page-plan-2026-11.md` + `market-page-inventory.csv` (264 rows) | `a62ea07` |
| Business facts | same branch, `docs/research/00-business-facts.md` | tip `975772d` |
| Site research PR | site repo PR #6 | open |
| This repo, trunk | `origin/main` | `7ebf18f` (README only) |
| This repo, in-flight | PR #1 spec (`spec/mcp-audit-spec-2026-10-22`, `0760f88`); PR #2 server v0.1.0 (`feat/build-readonly-server-2026-10-22`, `f3ae7d7`) | both draft, 2026-10-22 |

If the brief changes after `975772d`, re-read it and fold the delta in before building.

**What Mahoday Solar is.** Software for solar EPC and operations-and-maintenance (O&M / AMC) companies: site surveys, design and proposals, approvals and subsidy tracking, installation and commissioning, plants and service visits on one record. It is **not an installer**. It does not install systems, quote rooftop projects or hold installer accreditations (business facts A1, A4). Every record and tool in this plan is written from the software buyer's side.

---

## 1. Claim / Mechanism / Observable / Risk

| | |
|---|---|
| **Claim** | Assistants answer questions about Mahoday Solar correctly (what the software does for an EPC or O&M firm, which features are live, availability per market, which page covers a topic) when the MCP serves page and claim records generated from the site's route registry and `claims.csv`, with status, `last_verified` and `publication_status`. |
| **Mechanism** | A public read-only server with `search` + `fetch` and 6–8 verb-entity tools over `page` and `claim` records. Today every product feature is `coming_soon` or deployed-unverified, so nothing is served as `available` until deployed proof exists. |
| **Observable** | The 10-prompt eval (section 6) passes; in particular "Does Mahoday Solar install panels?" returns "no, it is software". A test fails if any record or tool text frames the company as an installer, states a subsidy, tariff or price figure, or names a parent or sister product. |
| **Risk** | **The in-flight server in PR #2 answers a homeowner's installer questions** (rooftop sizing, subsidy options, AMC quotes, service area, quote form). Merging it as-is would tell assistants the wrong business model. Second risk: regulated figures (incentives, net metering) served without an official dated source. |

## 2. Current server state (verified)

**Trunk (`main` at `7ebf18f`):** README only ("scaffold only. Tools and deployment config to be added."). No tools, no tests.

**PR #1 (spec, `0760f88`):** `docs/SPEC.md` (findings F1–F8, tool design, content-truth rules, acceptance tests) and `docs/submission/` drafts. No code.

**PR #2 (server v0.1.0, `f3ae7d7`, based on the PR #1 branch):** stateless Streamable HTTP + stdio, rate limit, `/.well-known/mcp.json`, `llms.txt`, `server.json`, Dockerfile, 18 tests, Astra review (11 findings fixed). **15 tools:** `solar_calculate_size`, `loan_calculate_emi`, `subsidy_get_overview`, `subsidy_get_state`, `netmetering_get_guide`, `amc_get_scope`, `amc_plan_visits`, `amc_get_checklist`, `services_list_offered`, `services_get_service`, `site_search_pages`, `system_compare_types`, `business_get_info`, `business_check_service_area`, `quote_get_link`. 3 resources, 4 prompts. States no subsidy figure (status `unsourced`). Cited site pages were launch-gated, so every URL is `launch-gated`.

**Contradictions with the site research:**

| # | PR #2 | Site research (2026-11-17) | Finding |
|---|---|---|---|
| H1 | README: "India-first solar buyer questions: sizing and EMI calculators ... AMC checklists"; tools `solar_calculate_size`, `system_compare_types`, `business_check_service_area`, `quote_get_link`, `services_list_offered` | Business facts A1, A4: software for EPC and O&M firms; pages must not imply Mahoday Solar installs systems; own-site findings: installer-shaped guides are not reused as pages | **Wrong business model.** The tool set serves a homeowner choosing an installer |
| H2 | Subsidy, net-metering and AMC tools address the homeowner | Market plan section 3: families are written "what your solar EPC / O&M firm must record", never installation or advice about subsidy amounts | Same topics can stay, re-framed as the records an EPC firm keeps (approvals and subsidy tracking is a product area) |
| H3 | `business_get_info` returns owner-confirmed facts from env; `unconfirmed` until set | Legal entity Soor LLC (founder); registered address OPEN; app not live on its host; support inboxes are placeholders | Entity can be served; address and inboxes stay `unconfirmed` |
| H4 | No feature-status tool | Plans Starter / Professional / Enterprise in code, `coming_soon`, `purchasable: false`, prices indicative; shipped code is not deployed proof | MCP needs `list_feature_status` with nothing `available` yet |
| H5 | No market records; India only | Market plan: IN, US, GB, CA, AU, DE, FR, JP, IT (264 candidate pages); product fields are India-shaped | Market availability statements needed; DE, FR, JP, IT not purchasable |
| H6 | No SOC 2 statement | Founder statement only, plain "SOC 2"; scope OPEN | Serve plain wording only via `get_claim` |
| H7 | Content-truth rule "brand isolation (no CRM or other-brand mentions)" | Business facts call the product a CRM for solar EPC and O&M | The "no CRM mention" rule conflicts with how the product is described in code; founder to choose the public category word |
| H8 | `llms.txt`, `server.json` drafts | FAQPage markup OPEN in business facts; founder decision for this programme: off | MCP must not depend on or emit FAQPage |

## 3. Target contract: a public read-only knowledge layer

**Principles (brief, loop 10 contract).** Public, read-only; built only after facts are verified. One source of truth with the website: the route registry (which also drives head hreflang and the sitemap) plus `claims.csv`. Only verified-public facts exposed. No customer-action tools (sign up, book, request a quote, change data). Pricing and comparison records stay out until launch. No parent or sister product names in any field.

**Tools (2 retrieval + 6 verb-entity), from the brief.** Each description states what / when / returns / not-for.

| Tool | What | When to use | Returns | Not for |
|---|---|---|---|---|
| `search_pages` (`search`) | Ranked search over page and claim records, `market?`, `family?` | First call | top N `{page_id, title, canonical_url, market, family, status}` | Installer or homeowner advice |
| `fetch_page` (`fetch`) | One page record by `page_id` | To cite | full `page` record | Arbitrary URLs |
| `list_feature_status` | Product features with status | "Which features are live" | `feature[]` (none `available` until deployed proof) | Promising roadmap items |
| `get_claim` | One claim from `claims.csv` with `may_state_on_page` and status | SOC 2, free plan, pricing, installs | `claim` | Widening a claim |
| `list_market_pages` | Page records by market, family, status | "Which page covers X in market Y" | `page[]` | Planned pages as live |
| `get_alternates` | Locale alternates for a page, plus `x-default` | Hreflang questions | `alternates` | Pages without a real counterpart |
| `stale_sources` | Sources past `refresh_after` (30 days for incentives and prices) | Maintenance; "which sources are stale" | `source[]` | — |
| `get_glossary_term` | Glossary hub entry | Terminology | `glossary_entry` | One-term thin pages |

The brief's `coverage(market)` (counts by gate and family) is served as a field on `list_market_pages` results in the first release, to keep the named tool count at 8.

**Common record envelope (brief, record type `page`):**

```ts
{
  page_id: string;
  market: "IN" | "US" | "GB" | "CA" | "AU" | "DE" | "FR" | "JP" | "IT";
  locale: string;                               // BCP-47
  canonical_url: Record<Locale, string>;        // from the one route registry
  alternates: Record<string, string>;           // locale -> URL, plus x-default
  family: Family;
  title: string;
  summary: string;
  status: "available" | "beta" | "integration" | "coming_soon" | "unavailable";
  page_status: "planned" | "drafted" | "in_review" | "published" | "retired";
  feature_status?: "pre-launch" | "live" | "coming_soon";
  gate: string[];
  sources: { url: string; captured_on: string; sha256: string; refresh_after: string }[];
  last_verified: string;
  publication_status: "draft" | "verified_public" | "held";
  reviewed_by?: string;                         // Astra run id for DE / FR / JP / IT
  updated_at: string;
}
```

**Output schemas.** Every tool declares an `outputSchema`; `structuredContent` validates against it.

## 4. Record types: one per page family

From `market-page-inventory.csv` (264 rows, 9 families) at `a62ea07`. All share the `page` envelope; family fields as in the brief:

| Page family (rows) | Record type | Fields beyond the envelope | Gate |
|---|---|---|---|
| `incentive` (9) | `incentive_page` | `scheme_name`, `authority`, `effective_date`, `as_of`, `refresh_date` | NEEDS-DATA; official dated source + Astra check; no amount advice |
| `net-metering` (9) | `net_metering_page` | `scheme_name`, `authority`, `effective_date`, `as_of`, `refresh_date` | same |
| `compliance` (9) | `compliance_page` | `certification_body`, `records_required[]` | NEEDS-DATA |
| `permitting` (9) | `permitting_page` | `authority`, `steps_recorded[]` | NEEDS-DATA |
| `regional` (66) | `regional_page` | `region`, `distinct_rule_summary` | only regions with distinct official rules |
| `workflow` (72) | `workflow_page` | `workflow` (survey, design, approvals, installation QA, commissioning, AMC, RMA ...), `feature_refs[]` | IN READY for contract with a pre-launch badge |
| `segment` (36) | `segment_page` | `segment` (Residential, C&I, RWA / housing society, Institutional) | NEEDS-DATA |
| `tool` (27) | `tool_page` | `inputs[]`, `currency`, `formula_ref`, `reviewer` | named reviewer for regulated inputs |
| `glossary` (27) | `glossary_hub` | `terms[]` (hubs, not one page per term) | NEEDS-DATA |

**9 family record types.** Core types: `feature`, `claim`, `market`, `source`.

## 5. Change proposals for existing content (proposals only; nothing is removed)

Founder rule: ask before removing anything. PR #2's tools are **not** proposed for deletion; they are proposed for re-framing or for holding behind a flag until the founder decides.

| # | Proposal | Why |
|---|---|---|
| P1 | Re-frame PR #2 README and server instructions from "solar buyer questions" to "software for solar EPC and O&M companies" | H1 |
| P2 | Hold `solar_calculate_size`, `loan_calculate_emi`, `system_compare_types`, `business_check_service_area` and `quote_get_link` out of the first release (not deleted) and ask the founder whether any of them belongs on a software site, e.g. as a free tool for EPC estimators | H1 |
| P3 | Re-frame `subsidy_*`, `netmetering_get_guide` and `amc_*` as "what an EPC / O&M firm records and tracks" records, keeping the no-figure rule and official-portal pointers | H2 |
| P4 | Serve Soor LLC as the entity; keep address and inboxes `unconfirmed` | H3 |
| P5 | Add `list_feature_status` with every feature `coming_soon` until deployed proof exists | H4 |
| P6 | Ask the founder which public category word to use ("software", "CRM" or both) and align the PR #2 brand-isolation rule with it | H7 |
| P7 | Add a test that fails on installer framing ("we install", "our installers", service-area claims) in any record or tool text | H1 |
| P8 | No parent or sister brand names were found in this repo or the PR branches (only the GitHub org name in repository URLs). Add an encoded deny-list guard | brand isolation |

## 6. Eval suite (from the brief)

Pass = correct tool, correct record, correct URL, no invented fact.

| # | Prompt | Expected tool | Expected record | Expected URL / answer |
|---|---|---|---|---|
| 1 | Is there a free plan? | `get_claim` | `claim: free-plan` | not stated |
| 2 | Does Mahoday Solar install panels? | `get_claim` | `claim: business-type` | no; it is software for solar EPC and O&M companies |
| 3 | Which features are live? | `list_feature_status` | `feature[]` | none confirmed live |
| 4 | Where is the AMC renewal guide? | `search_pages` | `workflow_page: amc-renewals` (IN) | its canonical URL, or `planned` |
| 5 | What does the AMC contract template contain? | `fetch_page` | `tool_page: amc-contract-template` | contents as published; `planned` if not live |
| 6 | Is it SOC 2 certified? | `get_claim` | `claim: soc2` | plain "SOC 2" founder statement only; no scope |
| 7 | Do you serve Germany? | `list_market_pages` / market record | `market: DE` | availability statement: not yet purchasable |
| 8 | What is the net metering rule in <market>? | `list_market_pages` → `fetch_page` | `net_metering_page` | source, as-of and refresh dates, or "not verified" |
| 9 | How much does it cost? | `get_claim` | `claim: pricing` | pricing not published |
| 10 | Which sources are stale? | `stale_sources` | `source[]` | list of sources past `refresh_after` |

## 7. Security and MCP Registry readiness

- **No write or customer-action tools.** No sign-up, demo booking, quote request, service-area booking or data change. `quote_get_link` is held (P2).
- All tools keep `readOnlyHint: true`; no outbound requests at request time; no personal data.
- PR #2 hardening (rate limit, host allowlist, proxy trust flags, GET `/mcp` 405) stays.
- **MCP Registry listing only after a security review**, and after the business-model re-frame (P1–P3). The `docs/submission/` drafts in PR #1 stay unsubmitted.

## 8. Sequencing and gates

| Step | Work | Gate |
|---|---|---|
| 0 | Founder decides P2 and P6; land the PR #1 spec with a note pointing to this plan | Human merge |
| 1 | Re-frame PR #2 (P1, P3, P4, P7); retarget to `main` | Eval 2 passes; installer-framing test green |
| 2 | Record envelope + output schemas; `search_pages` + `fetch_page` | Eval 4, 5 pass |
| 3 | `get_claim`, `list_feature_status` | Eval 1, 3, 6, 9 pass |
| 4 | IN workflow, segment and tool page records (wave 1) | Pre-launch badge on every feature reference |
| 5 | Incentive, net-metering, compliance, permitting and regional records | Official dated source, blind Astra check, as-of and refresh dates; `stale_sources` green |
| 6 | US, AU, CA, GB records | Product currency / incentive fields exist, or records stay `held` |
| 7 | DE, FR, JP, IT records | Purchasable, Astra review, support language |
| 8 | Security review, then Registry submission | Section 7 |

**Facts fixed by founder decisions (do not reopen):**

- **SOC 2:** plain wording "SOC 2" only. No type, scope, date or auditor.
- **Legal entity:** Soor LLC.
- **Regulated figures** (incentives, net-metering rules, tariffs, tax): official dated source plus an Astra check, with as-of and refresh dates; never from memory.
- **FAQPage markup is off.**

## 9. Open founder questions

1. Should any of the five held PR #2 tools (P2) return as a free tool for EPC estimators, or stay out?
2. Public category word: "software", "CRM" or both (P6)?
3. Registered address and real support / sales inboxes, so `business_get_info` can move off `unconfirmed`.
4. Is the marketing site `mahodaysolar.com` live, and when is the app live on its host?
5. Named reviewer for regulated inputs in tool pages (separate from the Astra language review).
6. Firecrawl cap for source capture (30 now), which bounds how many incentive and regional records can be sourced.
