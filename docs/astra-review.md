# Astra review of the Mahoday Solar MCP spec and v0.1.0 code (22 Oct 2026)

Reviewer: gpt-6-astra via `ask-sol.mjs --model astra --role code` (egress scan clean; payload = SPEC.md, `src/server.ts`, `src/http.ts`, part of `src/data.ts`; no keys or PII). Sol skipped by founder instruction. One reviewer, not run in parallel with any other.

**Verdict returned: do-not-ship.** Every finding below was checked against the code by me before acceptance.

| # | Astra finding | Decision | Action |
|---|---|---|---|
| 1 | HTTP builds server with empty env, so business facts can never be configured | **Accepted, verified** (`buildServer({})`) | Pass `process.env`; HTTP test added |
| 2 | Service-area substring match (`Greater Noida` covers `Noida`; `ra` matches `Gujarat`) | **Accepted, verified** | Exact comma-separated match only; not-listed returns `unconfirmed`, `covered:null`; tests added |
| 3 | Spec promised `page_url` field; code has `citations[]` | **Accepted as spec drift, not a code bug** | Spec amended to `citations[]`; resources now carry `last_reviewed` |
| 4 | `services_get_service` returns draft copy as `status:"ok"` | **Accepted** | Services list/detail now `unconfirmed` with an explicit caveat |
| 5 | `system_compare_types` unsourced and off-grid definition too narrow | **Accepted** | Status `unsourced`; wording no longer requires batteries |
| 6 | Exception outside the inner `try` (bad request target, missing public file) becomes an unhandled rejection | **Accepted, verified** | Target parse guarded; whole handler `.catch`; process-survival test added |
| 7 | Body cap throws mid-iteration and may destroy the socket before the 413 | **Accepted** | Bounded drain (1 MiB) then 413; hard destroy above that. Existing test sends 70 KB and passes; a streaming no-Content-Length wire test is **not** added (gap) |
| 8 | Spec acceptance rule forbids currency amounts, which EMI legitimately returns | **Accepted** | Spec rule reworded: derived amounts allowed; subsidy/tariff/price/saving claims forbidden |
| 9 | Spec's CI gate omits `verifier` and source allow-list | **Accepted** (latent) | Spec 4.4 amended |
| 10 | "Protocol 2026-07-28 removes sessions" rests on a secondary reference | **Accepted** | F8 reworded: unverified by me against the specification |
| 11 | With trusted proxy, leftmost `X-Forwarded-For` is client-controlled | **Accepted, verified** | Uses the last entry (one trusted appending proxy); spoofing test added; default is socket address |
| nit | Traffic wording asserted benefits | **Accepted** | Reworded as a hypothesis to measure |

**Not accepted / unchanged:** none rejected outright. Two Astra observations are limits, not defects: no per-tool timeout is implemented (the spec claim was removed; tools are synchronous and do no I/O); `allowedHosts:["*"]` disabling host checks is an operator choice documented in `.env.example`.

**Astra could not see** (and I did not verify either): the lockfile and SDK Origin handling, `calc.ts` and the content JSON (covered by my known-answer and corpus tests, not by Astra), registry/DNS state, deployed behaviour.

**Still unverified after fixes:** the official MCP Inspector and conformance suite (not run: would download unpinned packages); a wire-level streaming oversize test; behaviour behind a real reverse proxy; the Dockerfile build.
