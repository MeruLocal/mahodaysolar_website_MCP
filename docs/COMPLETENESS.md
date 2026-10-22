# Completeness checklist (22 Oct 2026, v0.1.0)

**Origin check (22 Oct 2026, GitHub API):** `main` of `MeruLocal/mahodaysolar_website_MCP` holds only the scaffold commit `7ebf18f` (`.gitignore`, `README.md`); the only branches and PRs are this work (#1 spec, #2 server). No other Mahoday MCP exists in the `MeruLocal` org, and site PR #3 contains no MCP files. Confirmed by the parent session.

Done = exists in this PR and was run or tested here. Gap = not done, with the reason.

| Item | State | Evidence / reason |
|---|---|---|
| Server code (TypeScript, official SDK, stateless Streamable HTTP + stdio) | Done | `npm run build` clean |
| Tools: 15, `area_verb_noun`, `title`, `outputSchema`, read-only annotations | Done | `tests/server.test.mjs`; `npm run audit:live` 27 pass / 0 fail |
| Resources (3) and prompts (4) | Done | tests |
| Annotations accurate, no write tools | Done | all `readOnlyHint:true`, `destructiveHint:false`, `openWorldHint:false` |
| Error handling (bad input is an error, 400/405/404/413/429/500) | Done | `tests/http.test.mjs` |
| Rate limit, body cap, no outbound requests, no URL-fetching tools | Done | tests; code has no `fetch` |
| No invented numbers (subsidy, price, saving, rating) | Done | corpus test; subsidy tools always `unsourced` |
| Calculators correct | Done | known-answer tests (2.5 kW / 5 panels; EMI 8,884.88; zero rate) |
| Server card `/.well-known/mcp.json`, `llms.txt`, `robots.txt`, `/health`, `/version` | Done | `audit:live`; tool count consistent |
| `server.json` registry manifest, version parity | Done | `npm run check:versions` |
| README with install snippets | Done | local and remote; remote host unconfirmed |
| Dockerfile (non-root, healthcheck) | Gap (unbuilt) | written, `docker build` not run (not available/needed here) |
| Tests | Done | 15 pass |
| Content generated from the site | Done | `scripts/gen-site-pages.mjs` from site PR #3 branch |
| Subsidy / net-metering facts | Gap (deliberate) | need a named verifier reading official sources |
| Subsidy estimate tool | Gap (deliberate) | not registered until central rule verified |
| Pages for calculators, subsidy hub, net metering, state pages, loan | Gap | not built on the site; returned as `planned_without_url` |
| Business facts (phone, area, entity) | Gap | founder input; env-driven, `unconfirmed` until set |
| Overseas content | Gap (deliberate) | no confirmed overseas operation |
| Form prefill in `quote_get_link` | Gap | site contact form reads no query parameters |
| Domain / DNS / hosting / deploy | Gap | unconfirmed ownership; nothing deployed |
| npm publish, registry namespace DNS | Gap | not done by instruction |
| Registry submissions | Gap (instruction) | packets in `docs/submission/` only |
| CI | Gap | no paid GitHub Actions; run `npm test` locally |
| Official `@modelcontextprotocol/inspector` and `conformance` runs | Gap | would download unpinned packages; run on the deployed host |
| RSS `audit-live-mcp.mjs` | Gap | script is hard-coded to HGC's `/sse` path; replaced by `scripts/audit-live.mjs` covering the same machine checks |
| Evaluation questions (mcp-builder phase 4) | Gap | need live site pages to be stable before answers can be fixed |
