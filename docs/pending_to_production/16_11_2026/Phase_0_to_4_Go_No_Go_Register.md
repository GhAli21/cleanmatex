# Phase 0–4 Go / No-Go Register

**Status:** Active launch-control register  
**Baseline date:** 17 Nov 2026  
**Authority:** [ROADMAP.md](ROADMAP.md) defines scope and phase exit checks; this register is the single execution view for its Phase 0–4 rows.  
**Launch rule:** `GO` is allowed only when every required row in the applicable phase is `Pass` and the phase exit result is evidenced. A calendar date, code merge, or green static check alone is never a pass.

## How to operate this register

- **Target by** is a planning window derived from the roadmap’s Week 1–4 sequence, beginning 17 Nov 2026. It is not a promise. The Owner must replace it with an accountable due date before work starts.
- **Evidence authority:** use dated, read-only remote Supabase evidence for every production-state, scheduler, backlog, security, migration, or launch decision. Local database results are development-only diagnostics and cannot set a row to `Pass`.
- **Status:** `Not started`, `In progress`, `Blocked`, `Pass`, `Fail`, `N/A (approved)`. `N/A` needs the owner’s written rationale and cannot weaken an exit check.
- Immediately after **every** action, update its row with the status, evidence link/command/date, owner, and next action. Also update the related feature `STATUS.md` / `RESUME_CONTINUATION.md` where it exists.
- A failed retest remains `Fail` until the replacement evidence is linked. Do not overwrite old evidence.
- Before starting a later phase, record the prior phase’s `GO` or `NO-GO` below. Phase 3 may run in parallel with Phase 0; all other dependencies follow the roadmap.

## Phase decision log

| Phase | Decision | Date | Approver | Evidence / reason | Next action |
|---|---|---|---|---|---|
| 0 | Pending | — | — | — | — |
| 1 | Pending | — | — | — | — |
| 2 | Pending | — | — | — | — |
| 3 | Pending | — | — | — | — |
| 4 | Pending | — | — | — | — |

## Phase 0 — Security gate

**Target by:** 23 Nov 2026 · **Decision:** no pilot, customer data, or scheduler enablement until this phase is `GO`.  
**Execution plan for 0.1–0.4:** [S0_privilege_lockdown_PLAN.md](S0_privilege_lockdown_PLAN.md). Update that plan's Progress Log after every task. A drafted migration is not a `Pass`.

| ID | Required result | Owner | Source | Target by | Status | Evidence / next action |
|---|---|---|---|---|---|---|
| 0.1 | Review and draft revoke/RLS migration for anon/authenticated writable `sys_*`/`hq_*` tables; Owner applies only after review. | Dev → Owner | S0a | 21 Nov | In progress | `supabase/migrations/0745_revoke_sys_hq_anon_writes.sql` drafted, not applied |
| 0.2 | Review and draft SECURITY DEFINER privilege/default-privilege/search-path migration; Owner applies only after review. | Dev → Owner | S0b, S0d | 21 Nov | In progress | `supabase/migrations/0746_revoke_definer_execute_and_lock_search_path.sql` drafted, not applied |
| 0.3 | Review and draft `security_invoker`/revoke fix for seven definer views; Owner applies only after review. | Dev → Owner | S0c | 21 Nov | In progress | `supabase/migrations/0747_security_invoker_catalog_views.sql` drafted, not applied |
| 0.4 | Add a DB/CI regression that fails on anon-writable tables or anon-executable SECURITY DEFINER functions. | Dev | S0b | 22 Nov | In progress | `scripts/db/check-s0-privileges.sql` and `.github/workflows/privilege-lockdown.yml`. Live check waits for apply |
| 0.5 | Turn on leaked-password protection in hosted Supabase Auth. Secure password change (S5) is not needed now. | Owner | S0d | 21 Nov | Not started | Owner decision 17 Nov 2026 defers S5 |
| 0.6 | Re-run security advisor; smoke-test login, new order, HQ screens, and public tracking after the access changes. | Owner + Dev | ROADMAP Phase 0 | 23 Nov | Not started | — |

**GO evidence:** advisor reports zero writable `rls_disabled_in_public` findings and zero anon-executable definer functions; all four smoke paths pass.  
**NO-GO if:** any privileged public write/execute grant remains, or the remediation breaks an essential path without a reviewed replacement.

## Phase 1 — Operational autonomy gate

**Target by:** 30 Nov 2026 · **Dependency:** Phase 0 `GO`; job redesign work follows [I11_background_execution_redesign_PLAN.md](I11_background_execution_redesign_PLAN.md).

| ID | Required result | Owner | Source | Target by | Status | Evidence / next action |
|---|---|---|---|---|---|---|
| 1.1 | Classify each enabled job and restore/replace schedules only through the approved DB/worker design; every enabled job has exactly one verified scheduler. | Dev + Owner | I11a | 27 Nov | In progress | Remote baseline is captured: 14 desired-enabled registry jobs are absent; five legacy HTTP bridges are enumerated; one active DB-native `tax-kit-update` scheduler is outside the registry; session, stale-push, quota/retention, tax-kit, file-expiry, run-capture, and idempotency handlers are evidenced as database work. Finance, campaign/retry, and provider ownership/rollback remain before any enablement. |
| 1.2 | Decide trial-expiry outcome, implement it under the approved scheduler model, and prove an expired demo trial changes state. | Owner → Dev | B1 | 27 Nov | Not started | — |
| 1.3 | Cancel/resolve old demo queued notifications before sender enablement. | Owner | D13 | 27 Nov | Not started | — |
| 1.4 | Deploy Sentry or equivalent to web-admin and platform-web with PII scrubbing; prove a controlled error appears. | Dev | I4 | 28 Nov | Not started | — |
| 1.5 | Verify Resend domain SPF/DKIM/DMARC, set production values, and receive a password-reset email. | Owner | I6 | 27 Nov | Not started | — |
| 1.6 | Set `HQ_ENCRYPTION_MASTER_KEY` and re-encrypt registry secrets; prove plaintext secrets are absent from the registry. | Owner | I7 | 27 Nov | Not started | — |
| 1.7 | Add HQ test/build CI, schedule DB integration checks, and resolve launch-relevant known red tests. | Dev | I9, I10 | 30 Nov | Not started | — |
| 1.8 | Configure uptime probes and the HQ alert webhook; prove one controlled alert arrives. | Owner | I5 | 28 Nov | Not started | — |

**GO evidence:** 48 hours of successful enabled-job runs; trial expiry works; controlled app error and reset email arrive; critical CI is green.  
**NO-GO if:** scheduler drift, unbounded queued backlog, missing provider email, unencrypted secrets, or unobserved production failure remains.

## Phase 2 — Production environment and recoverability gate

**Target by:** 30 Nov 2026 · **Dependency:** Phase 0–1 `GO` for customer data cutover.

| ID | Required result | Owner | Source | Target by | Status | Evidence / next action |
|---|---|---|---|---|---|---|
| 2.1 | Choose a new production Supabase project (recommended) or formally accept and scope cleanup of the current project. | Owner | I2 | 24 Nov | Not started | — |
| 2.2 | If new, replay migrations on staging from scratch and resolve every replay failure before production application. | Dev + Owner | I2 | 27 Nov | Not started | — |
| 2.3 | Confirm daily backups/PITR and perform a recorded restore drill to an isolated copy. | Owner | I3, N7 | 28 Nov | Not started | — |
| 2.4 | Set and verify production environment variables for tenant app, HQ API/web/workers, including required build memory. | Owner | I8 | 28 Nov | Not started | — |
| 2.5 | If reusing the project, complete and evidence every applicable cleanup item in file 13. | Owner | file 13 | 28 Nov | Not started | — |
| 2.6 | Deploy tenant app, HQ API, HQ web, and workers from one committed release identifier; run post-deploy smoke checks. | Owner | I1, H1 | 30 Nov | Not started | — |

**GO evidence:** no demo/test data in production scope, restore drill recorded, required secrets/config present, and all deployed components identify the same release.  
**NO-GO if:** production shares uncontrolled demo data, restoration is unproven, or deployment versions are inconsistent.

## Phase 3 — Legal and commercial gate

**Target by:** 07 Dec 2026 · **May start:** in parallel with Phase 0. **Dependency for pilot:** all required rows pass.

| ID | Required result | Owner | Source | Target by | Status | Evidence / next action |
|---|---|---|---|---|---|---|
| 3.1 | Obtain lawyer-approved EN/AR Terms, Privacy Policy, DPA, cookie/acceptable-use position for pilot markets. | Owner | B4 | 07 Dec | Not started | — |
| 3.2 | Publish approved legal pages and persist accepted version/time at sign-up. | Dev | B4 | 07 Dec | Not started | — |
| 3.3 | Confirm Supabase data region and publish an accurate data-residency statement. | Owner | B5 | 05 Dec | Not started | — |
| 3.4 | Obtain/record tax-adviser decisions for tax config, subscription VAT, and UAE/Oman e-invoicing applicability. | Owner | T7, B8, T2 | 07 Dec | Not started | — |
| 3.5 | Complete Meta/sender verification plus approved EN/AR transactional WhatsApp templates and relevant SMS sender IDs. | Owner | N1, N3 | 07 Dec | Not started | — |
| 3.6 | Decide and implement customer opt-in/lawful-basis recording at order intake. | Owner → Dev | N4 | 07 Dec | Not started | — |
| 3.7 | Deliver and test an authorized customer anonymization path that retains required order/finance records. | Dev | U4 | 07 Dec | Not started | — |

**GO evidence:** approved legal content is live and versioned acceptance is stored; provider templates are approved; tax decisions are recorded; customer data-rights path is tested.  
**NO-GO if:** customers are onboarded without lawful terms/privacy basis or required communication consent/approval.

## Phase 4 — Real-user and hardware proof gate

**Target by:** 14 Dec 2026 · **Dependency:** Phase 0–3 `GO` for a paying pilot.

| ID | Required result | Owner | Source | Target by | Status | Evidence / next action |
|---|---|---|---|---|---|---|
| 4.1 | Execute and publish the customer onboarding script: sign-up → all Setup Health checks green → order → payment → receipt → ready → delivered, without developer help. | Owner + Dev | B9, Q1 | 07 Dec | Not started | — |
| 4.2 | Triage and correct every onboarding gap found: tax confirmation, Express rule, UAE emirate, tax periods, ERP-Lite mappings, and business-type templates as applicable. | Dev | T3, SP5, T10, T11, P12, C2 | 10 Dec | Not started | — |
| 4.3 | Configure/publish Edit Policy, `INIT_MOBILE_RETAIL` where sold, and least-privilege HQ role grants. | Owner | E3, W6, S4 | 08 Dec | Not started | — |
| 4.4 | Pass blocker browser QA Q2–Q12 in EN/AR and desktop/tablet; record every result. | Owner + Dev | file 12 | 12 Dec | Not started | — |
| 4.5 | Fix every failed blocker QA case and complete its specific retest. | Dev | ROADMAP Phase 4 | 13 Dec | Not started | — |
| 4.6 | Pass real pilot-store hardware tests: receipt/label printer, scanner, cash drawer, tablet, Arabic layout, barcode/QR. | Owner | Q20, O3 | 14 Dec | Not started | — |
| 4.7 | Complete native Arabic review of all pilot surfaces, especially operations, security, and tax. | Owner | Q19 | 14 Dec | Not started | — |

**GO evidence:** Q1 passes without developer support; every blocker QA row has passing evidence or an approved and retested fix; real hardware and Arabic review pass.  
**NO-GO if:** core order/payment/delivery flow or hardware behavior has not been proven in the actual pilot configuration.

## Evidence index

| Reference | Source |
|---|---|
| Security | [02_security_and_tenant_isolation.md](02_security_and_tenant_isolation.md) |
| S0 execution | [S0_privilege_lockdown_PLAN.md](S0_privilege_lockdown_PLAN.md) |
| Operations / I11 | [03_infrastructure_deploy_and_operations.md](03_infrastructure_deploy_and_operations.md) |
| Commercial | [01_business_and_commercial_blockers.md](01_business_and_commercial_blockers.md) |
| QA | [12_manual_qa_backlog.md](12_manual_qa_backlog.md) |
| Data cleanup | [13_data_cleanup_before_go_live.md](13_data_cleanup_before_go_live.md) |
| Background jobs execution plan | [I11_background_execution_redesign_PLAN.md](I11_background_execution_redesign_PLAN.md) |

## Change log

| Date | Change | Owner |
|---|---|---|
| 2026-11-17 | Created from ROADMAP phases 0–4; all execution rows start unverified. | Dev |
| 2026-11-17 | Rows 0.1–0.4 moved to In progress. Migrations 0745–0747 and the privilege invariant are drafted and not applied. Not a Pass. | Dev |
| 2026-11-17 | Linked the S0 privilege-lockdown plan for rows 0.1–0.4. Status stays Not started. | Dev |
