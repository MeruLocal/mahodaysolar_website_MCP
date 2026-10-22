# Go / no-go: Mahoday Solar MCP (22 Oct 2026)

**Decision asked:** deploy `mahodaysolar-mcp` v0.1.0 and list it in MCP registries?
**Recommendation:** **GO for deploy to a private/staging host now; NO-GO for public registry submission until the four gates below clear.** It is cheap to run (static content, no secrets, no outbound calls) and safe by construction, but there is nothing public to cite yet.

## Gates before any registry submission
1. **The site is live and indexed.** Every URL the server returns is `launch-gated` (site PR #3 is a draft, noindex). A listing that cites pages returning 404/noindex is worse than no listing.
2. **Founder inputs:** domain ownership and DNS control (for `mcp.` host and registry namespace), service area, phone/email, legal entity. Until set, the server answers `unconfirmed`.
3. **Official-source verification:** a named person reads PM Surya Ghar / MNRE / DISCOM sources before any subsidy tool states a fact. Today none does, by design.
4. **Acceptance run** against the deployed host (inspector, official conformance suite) - not yet run.

## How this can bring traffic (honest mechanisms)
- **Not Google rankings.** An MCP server does not rank. No traffic number is promised and none is forecast.
- **Citations and referral links.** When an assistant with the server installed answers a solar question, it returns `citations` with `?utm_source=mcp` URLs on mahodaysolar.com. Measurable in GA4 once the site is live.
- **Directory visibility.** Official MCP Registry, Smithery, Glama, PulseMCP give discoverability and small referral/brand-search lift; each needs a published package or reachable URL.
- **Demand backing the tool set** (Google Keyword Planner India, 22 Oct 2026, research folder): solar calculator 5,400 / panel calculator 4,400 / rooftop calculator 1,300, net metering 5,400, solar loan 2,400, EMI calculator 1,300. The calculators here are the only tools with real demand evidence; AMC terms are small (solar amc 110) but are the business's focus.
- **Biggest lever is outside the MCP:** the site's own calculator, subsidy hub and net-metering pages (wave 1) do not exist yet; the MCP can only point at them (planned pages return no URL).

## Risks
- Wrong subsidy facts quoted by assistants: mitigated by stating none.
- Stale site slugs: mitigated by generating the index from the site source (`npm run gen:pages`); it must be re-run when the site changes - no CI is wired (no paid GitHub Actions).
- Brand isolation: tests forbid CRM/other-brand terms.
- An unmaintained listing decays; needs an owner and a monthly source check once subsidy facts are added.

## Cost
Hosting: one small container; no database. Maintenance: re-run the page generator on site changes; monthly source re-check if facts are added.
