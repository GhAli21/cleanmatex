# Notification Hub — Resume & Continuation (read this first after /clear)

**Written:** 2026-10-14 · **Authoritative over chat memory.** Plan: [notification-hub-production-implementation-plan.md](./notification-hub-production-implementation-plan.md) §23.1 · Status: [STATUS.md](./STATUS.md) · Ops console: [../Platform_Operations_Console/STATUS.md](../Platform_Operations_Console/STATUS.md)

## 1. Where things stand
- Tenant repo `F:\jhapp\cleanmatex` (owns ALL migrations) and HQ repo `F:\jhapp\cleanmatexsaas` (platform-api NestJS, platform-web Next.js, platform-workers).
- Hub pilot code is complete in both repos. Platform Operations Console (A10) P0–P4 built: migrations 0610/0611/0612 APPLIED to both DBs; DB types regenerated in both HQ apps; next migration seq = **0613**.
- 2026-10-14 hardening: central `HqRbacService` (`platform-api/src/common/services/hq-rbac.service.ts`) — HQ RBAC enforced unless `HQ_RBAC_ENFORCEMENT_ENABLED=false`; guard + ops services use it. 153 tests pass.
- Everything is UNCOMMITTED in both repos (user commits). Unrelated pre-existing failing suites in `platform-api/src/common` (tenant-permission guard/service, tenant-runtime-jwt guard) — not ours.

## 2. User is doing (operator steps — do NOT attempt)
Fix job drift on `/ops/jobs`; HQ env vars (checklist Step 2); Twilio account/sender/template/route for demo tenant; one real routed send + WhatsApp proxy test (`ntf.pilot_test_message`); `RESEND_WEBHOOK_SECRET` + Resend webhook; browser-test the four `/ops/*` screens; commit both repos; remove stray `supabase/migrations/pglast-*.whl`; runbook drills with owners (C2). If the user reports results/breakages, handle those FIRST.

## 3. Work queue for Claude (do in order; each = code + tests + EN/AR i18n + docs/STATUS update)
| # | Item | Notes |
|---|---|---|
| R0 | Triage anything the user reports from browser tests | first priority |
| R1 | Replace typed `as unknown as` bridges in the 4 ops repositories (`platform-api/src/modules/ops-*/ *.repository.ts`) with generated types | types already regenerated; keep tests green |
| R2 | Soft-bounce threshold tracking (A2) | needs migration → create SQL, state UNAPPLIED, STOP |
| R3 | SMS inbound carrier opt-out / STOP (A2) | webhook + suppression list (`org_ntf_suppression_lst`, mig 0603) |
| R4 | Meta WhatsApp provider-message-id capture (A2) | |
| R5 | Sender-level live verification (A5b) | |
| R6 | Convert remaining config keys to `ConfigResolverService` one by one (checklist `Platform_Operations_Console/config_registry_guide.md` §7); tenant-app resolver; migrate plain-text `sys_ntf_runtime_cf.outbox_secret_key` | tenant keys are `is_wired=false` until a tenant resolver exists |
| R7 | Ops follow-ups: change-history UI for `sys_ops_config_chg_log`, master-key rotation/re-encryption tool, drift alerting, salted fingerprints | |
| R8 | C3 test matrix: close every remaining row that is feasible without new infra; list the rest honestly | audit doc `test-matrix-coverage-audit-2026-10-10.md` |
| R9 | Final: refresh plan §23.1, STATUS.md, QA/runbook docs; mark plan closed with deferrals as post-pilot backlog | `/documentation` skill |

**Deferred by user decision — do NOT build unless told:** A3 quota race, A4b generic preview/test-send API, A6 health/failover tooling, A7 NTF-06 builder, A8 second-provider connectors.

## 4. Standing rules (do not violate)
- Load the skill BEFORE writing code (`/database` SQL, `/backend`, `/frontend`, `/i18n`, `/multitenancy` for `org_*`, `/implementation`, `/code-documentation`).
- NEVER apply migrations (no MCP/CLI writes): write new SQL (never edit applied ones), say UNAPPLIED, STOP, wait for user. `supabase_remote` MCP = reads only.
- Every `org_*` read/write visibly filters `tenant_org_id`. Permissions `resource:action` + seeded by migration. Constants mirror DB strings. TEXT not VARCHAR. Max 30 chars DB object names; comment every DB object.
- Service/use-case layers (no controller logic); Cmx components, `cmxMessage`/`useMessage`, EN+AR i18n (parity check), no `any`.
- Never expose secrets (browser/logs/audit/repo). No maker≠checker checks.
- After each increment: update plan/STATUS/docs. Verify subagent claims yourself (counts were wrong before).
- Environment lessons: Edit tool for edits (a bulk `sed -i` on permission code was blocked); never run `git stash`; preserve CRLF when scripting edits; run jest targeted (full runs time out ~5 min); foreground `sleep` is blocked; platform-web `npm run build` must not run concurrently with another build.

## 5. Verification commands
- HQ API: `cd F:\jhapp\cleanmatexsaas\platform-api && npx jest src/modules/ops- src/common/guards/hq-permission src/common/services/hq-rbac` and `npx tsc --noEmit | grep ops-`
- HQ web: `cd platform-web && npx tsc --noEmit && npm run build`; ops/notification jest suites under `__tests__/features/`.
- Tenant: `cd web-admin && npm run build`, `npx eslint . --quiet`, `npm run check:i18n`.
- Remote DB facts (read via MCP): 17 jobs in `sys_ops_job_cf`, 11 operations, 50 config keys, 6 `hq_ops:*` permissions.
