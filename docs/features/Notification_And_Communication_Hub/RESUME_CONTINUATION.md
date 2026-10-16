# Notification Hub — Resume & Continuation (read this first after /clear)

**Written:** 2026-10-14 · **Authoritative over chat memory.** Plan: [notification-hub-production-implementation-plan.md](./notification-hub-production-implementation-plan.md) §23.1 · Status: [STATUS.md](./STATUS.md) · Ops console: [../Platform_Operations_Console/STATUS.md](../Platform_Operations_Console/STATUS.md)

## 1. Where things stand
- Tenant repo `F:\jhapp\cleanmatex` (owns ALL migrations) and HQ repo `F:\jhapp\cleanmatexsaas` (platform-api NestJS, platform-web Next.js, platform-workers).
- Hub pilot code is complete in both repos. Platform Operations Console (A10) P0–P4 built: migrations 0610/0611/0612 APPLIED to both DBs; DB types regenerated in both HQ apps; next free migration seq = **0634** (0633 = clears the automatic approval expiry dates, written, UNAPPLIED) (0632 = live config baseline: job schedules, Twilio credential label, platform account and sender as PENDING; written, UNAPPLIED, see Setup_And_Config/LIVE_CONFIG_SNAPSHOT_2026-10-16.md) (0629–0631 applied by the owner 2026-10-16 and verified on the remote; types and Prisma regenerated) (0623–0626 and 0628 applied by the owner 2026-10-15; 0627 belongs to the order-data work; types and Prisma regenerated) (0613–0621 and 0623 applied by the owner 2026-10-15; 0622 belongs to the order-change work).
- 2026-10-14 hardening: central `HqRbacService` (`platform-api/src/common/services/hq-rbac.service.ts`) — HQ RBAC enforced unless `HQ_RBAC_ENFORCEMENT_ENABLED=false`; guard + ops services use it. 153 tests pass.
- Everything is UNCOMMITTED in both repos (user commits). Unrelated pre-existing failing suites in `platform-api/src/common` (tenant-permission guard/service, tenant-runtime-jwt guard) — not ours.

## 2. User is doing (operator steps — do NOT attempt)
Fix job drift on `/ops/jobs`; HQ env vars (checklist Step 2); Twilio account/sender/template/route for demo tenant; one real routed send + WhatsApp proxy test (`ntf.pilot_test_message`); `RESEND_WEBHOOK_SECRET` + Resend webhook; browser-test the four `/ops/*` screens; commit both repos; remove stray `supabase/migrations/pglast-*.whl`; runbook drills with owners (C2). If the user reports results/breakages, handle those FIRST.

## 3. Work queue for Claude (do in order; each = code + tests + EN/AR i18n + docs/STATUS update)
| # | Item | Notes |
|---|---|---|
| R0 | Triage anything the user reports from browser tests | first priority |
| R1 ✅ DONE 2026-10-14 (all 4 repos use generated `SupabaseClient<Database>`; results narrowed in-repo; tsc clean for ops-*, 153 tests pass) | Replace typed `as unknown as` bridges in the 4 ops repositories (`platform-api/src/modules/ops-*/ *.repository.ts`) with generated types | types already regenerated; keep tests green |
| R2 ✅ DONE 2026-10-14 (mig 0613 applied both DBs, types regenerated, temp bridge removed) | Soft-bounce threshold tracking (A2) | needs migration → create SQL, state UNAPPLIED, STOP |
| R3 ✅ DONE 2026-10-14 (mig 0614 applied both DBs, types regenerated, bridge removed) | SMS inbound carrier opt-out / STOP (A2) | HQ Twilio ingress → `fn_ntf_carrier_opt_apply` → `org_ntf_suppression_lst` |
| R4 ✅ DONE 2026-10-14 (no migration) | Meta WhatsApp provider-message-id capture (A2) | tenant `sendViaMeta` returns wamid; reconcile META row with wamid => SENT |
| R5 ✅ DONE 2026-10-14 (no migration) | Sender-level live verification (A5b) | HQ `POST …/senders/:id/verify` (Twilio SMS/WhatsApp, Resend domain) + UI button; operator must click-through once |
| R6 ⏸ **R6a+R6b built; STOPPED for migration 0618 (retire sys_ntf_runtime_cf) — owner applies, then regenerates types in all three apps** (0615/0616/0617 applied 2026-10-15) | Config registry v2 end-to-end: HQ + tenant resolvers, encryption toggle, plain-secret health check, runtime screen retired | after 0618: regenerate types, rotate outbox secret, run the seed script per DB, click-through `/ops/config` |
| R7 ✅ DONE 2026-10-15 (mig 0621 applied by owner both DBs, types regenerated) | Ops follow-ups: change-history UI (done), master-key rotation + re-encryption tool (done), drift alerting (done), salted fingerprints (decided against — rationale in `Platform_Operations_Console/config_registry_guide.md` §10) | after 0621: set `platform.ops.alert_webhook_url` if wanted; try a rotation drill on a test key; click through the history icon and the Encryption keys panel on `/ops/config` |
| R8 ✅ DONE 2026-10-15 — 19/34 rows covered (was 13), 8 partial, 6 open with reasons; four product defects fixed (queue-enqueue stuck reservation, date-only timezone, campaign pause mid-batch + COMPLETED overwrite, tenant-session access to HQ endpoints) | audit doc `test-matrix-coverage-audit-2026-10-10.md` ("Still open after R8") |
| R9 ✅ DONE 2026-10-15 — plan §23.1 rows A3/A4/A6/A7/A8 updated, STATUS entries per item, QA guide scenarios T1–T35 (`Platform_Operations_Console/qa_test_guide.md`), runbooks 06/08/09/10/11/13, "Residual / post-pilot backlog" below | `/documentation` skill |

**Previously deferred items are now IN SCOPE (user decision 2026-10-14: build everything to full production-ready — no gaps, all layers: DB, backend, APIs, services, HQ screens, EN/AR, tests, docs).** See the table below.

### 3b. Former-deferred items — now required (R10–R14)
Recommended execution order: **R10 (A3) → R11 (A7) → R12 (A4b) → R13 (A8) → R14 (A6)** (A4b builds on A7's canonical builder; A6 failover is only meaningful once A8 gives a second connector). Run them after R0–R5; R6–R9 may interleave. For each: short design note in plan §23.1 first, then migration (UNAPPLIED, stop), backend service/use-case layers, HQ endpoints + screens (Cmx, `cmxMessage`, EN/AR), permissions seeded by migration, jobs registered in `sys_ops_job_cf`, Setup Health checks + `SetupGuidancePanel` where relevant, tests incl. tenant isolation/concurrency, docs + STATUS.

| # | Item | Scope to deliver |
|---|---|---|
| R10 ✅ DONE 2026-10-15 (mig 0623 applied both DBs) — **A3 quota hard-cap race** | Close fully: atomic reserve→commit/release inside one DB function under the existing per-(tenant,channel) advisory lock (builds on migs 0598 `fn_ntf_quota_usage_locked` / `fn_ntf_meter_usage_atomic`); reservation expiry sweep job; concurrency tests (parallel commands cannot exceed cap); quota screen shows reserved vs used. |
| R11 ✅ DONE 2026-10-15 (no migration) — **A7 NTF-06 canonical builder** | One builder/policy/render path for events, campaigns and test sends (plan NTF-06: contract fixtures exercise the same path); migrate the three callers; contract-fixture tests; no behaviour change for live `order.created` route path (regression tests first). |
| R12 ✅ DONE 2026-10-15 (mig 0624 applied both DBs) — **A4b generic preview / test-send API** | HQ API + Templates-screen UI: render any event/template for chosen tenant+locale+sample data (preview) and test-send to an allow-listed recipient; goes through R11 builder; audited, rate-limited, flagged `is_test`, never bypasses suppression/opt-in rules except explicit documented test mode; permission `ntf_*:test_send` seeded by migration. |
| R13 ✅ PORT + KIT + SANDBOX DONE 2026-10-15; **real second providers per channel still need the owner's choice + credentials** — **A8 second-provider connectors** | Define provider-connector port (domain-agnostic adapter contract + registry + conformance test kit) and implement at least one extra connector per channel family (SMS/WhatsApp/Email). **Ask the user which real providers** (e.g. GCC SMS aggregator, Meta Cloud API, SES/SendGrid) when reaching this step; build against sandbox/fake until credentials exist. |
| R14 ✅ BUILT 2026-10-15 — **STOPPED for migration 0626 (owner applies; 0625 already applied), then regenerate types** — **A6 operational safety tooling** | Account health metrics (rolling success/failure), circuit breaker states (CLOSED/OPEN/HALF_OPEN), pause/drain/restore per account/channel, failover rules (account-level now, cross-provider once R13), retention cleanup (reuse `ntf-retention-sweep`/registry), billing reconciliation report; HQ health screen + Setup Health checks + alerts via jobs registry; runbooks updated. |

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
