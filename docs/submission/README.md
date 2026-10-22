# Submission packets (files only; nothing has been submitted)

**Gate: do not submit anything until the server is built, deployed and `docs/SPEC.md` section 9 passes.** Submissions publish the description text, which may be cached and indexed.

## Facts to confirm first (all unverified today)
Domain `mahodaysolar.com` ownership; MCP host (`https://mcp.mahodaysolar.com/mcp`); npm package `mahodaysolar-mcp` (404 on 22 Oct 2026, unclaimed); license holder; contact email; whether the legal entity is shown.

## Shared copy
- **Name:** Mahoday Solar
- **One-liner:** Solar sizing and EMI calculators, sourced solar subsidy and net-metering guidance, and AMC (annual maintenance contract) checklists for Indian solar buyers.
- **Description:** A public, read-only server. It computes estimates only from numbers the user supplies, states subsidy and policy facts only when they carry an official source and a check date (otherwise it points to the official portal), and links the matching page on mahodaysolar.com. No account, no API key, no personal data, no prices or savings claims.
- **Tags:** solar, energy, calculators, india, maintenance.
- **Example prompts:** "Size a rooftop system for 400 units a month; I will give you the peak sun hours." / "What should I ask before renewing my solar AMC?" / "Which subsidy details can you confirm for my state, with sources?"

## Targets and needs
| Target | Needs | Notes |
|---|---|---|
| Official MCP Registry | `server.draft.json` finalised; npm package with matching `mcpName` | namespace `com.mahodaysolar/...` needs a DNS TXT on mahodaysolar.com; `io.github.merulocal/...` needs only GitHub auth |
| Claude Connectors Directory | Streamable HTTP, `title` on every tool, accurate annotations, reviewer notes | no-auth public server |
| GitHub MCP Registry | repo with `server.json` | after the official registry |
| Smithery, Glama, PulseMCP, mcp.so | public repo and published package or reachable URL | auto-index once the npm package exists |

Install snippet (verify against the deployed host): `claude mcp add --transport http mahodaysolar https://mcp.mahodaysolar.com/mcp`

## Reviewer notes
Anonymous, read-only; all tools `readOnlyHint:true`; no write tools; no outbound calls at request time; content is versioned JSON with per-fact source, check date and verifier; unsourced facts return `status:"unsourced"`.
