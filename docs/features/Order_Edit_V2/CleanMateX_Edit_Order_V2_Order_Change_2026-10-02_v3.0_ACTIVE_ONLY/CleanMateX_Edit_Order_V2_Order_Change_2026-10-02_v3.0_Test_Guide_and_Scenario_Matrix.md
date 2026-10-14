# CleanMateX Edit Order V2 / Order Change v3.0 — Test Guide and Scenario Matrix

**Version:** 3.0  
**Date adopted:** 2026-10-14 (Asia/Muscat)  
**Status:** ACTIVE — authoritative testing-execution companion for Edit Order V2 / Order Change v3.0  
**Progress authority:** `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md` remains the sole WP sequence/status/progress authority.  
**Governance authority:** `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md`.

## 1. Purpose and scope

This document defines the complete executable testing strategy and scenario catalog for Edit Order V2 / Order Change v3.0.

It answers **how the approved behavior is tested**. It does not redefine business rules, architecture, API contracts, DB contracts, or WP scope.

The living implementation plan remains the source for package sequencing and current status. Specialized v3.0 contracts remain the source for expected behavior.

Every WP verification report must reference the relevant scenario IDs from this guide where applicable.

## 2. Testing principles

1. Prefer reliable automation whenever the behavior can be deterministically verified.
2. Use unit tests for pure deterministic business transformations.
3. Use service/integration tests for composition and canonical-domain integration.
4. Use real PostgreSQL/DB integration tests for transactions, locking, FK/RLS, rollback and concurrency.
5. Use API tests for authentication, authorization, DTOs, HTTP errors, idempotency and no-write/write contracts.
6. Use Playwright E2E for browser workflows and server/client integration.
7. Use the Manual UI Test Guide only for behavior that still requires human visual/usability/accessibility judgement.
8. A mocked transaction proves callback composition/failure propagation only; it does not prove PostgreSQL rollback, locks or concurrency.
9. A passing UI test does not replace server authorization/security tests.
10. No test may silently mutate production data. Real DB tests require an approved disposable/local/test environment.

## 3. Test levels and ownership

| Level | Primary purpose | Typical owner/tool | Manual? |
|---|---|---|---|
| Unit | Pure projection, normalization, calculation, classification | Jest | No |
| Service integration | Canonical service/adaptor composition | Jest + controlled collaborators | No |
| DB integration | Atomicity, rollback, locks, RLS/FKs, concurrency | Jest DB config / PostgreSQL test fixture | No |
| API contract | Auth/RBAC/CSRF/DTO/status/idempotency/no-write | Jest/API route tests | No |
| E2E browser | Staff flow across UI/API/server | Playwright | No where reliable |
| Security | Tenant isolation, direct DML/RPC, permission bypass | DB/API/security tests | No |
| Concurrency | two editors, workflow/payment/refund races | DB integration | No |
| i18n/RTL automated | Missing keys, direction-safe DOM/attributes, basic layout hooks | Jest/Playwright/i18n checks | Mostly No |
| Manual UI | Visual clarity, usability, final RTL/layout, focus/keyboard/device judgement | Human tester | Yes, only where automation is insufficient |
| Performance | latency/query plans/contention budgets | k6/query plans/telemetry as applicable | No |

## 4. Scenario status vocabulary

- `AUTOMATED_REQUIRED` — must be covered by reliable automation before release.
- `AUTOMATED_EXISTING` — existing automated evidence currently covers the scenario/slice.
- `AUTOMATION_PLANNED` — owning WP has not implemented the required test yet.
- `MANUAL_REQUIRED` — genuinely requires human judgement; see Manual UI Test Guide.
- `PARTIALLY_AUTOMATED` — objective behavior automated; human visual/usability judgement remains manual.
- `NOT_APPLICABLE_YET` — owning feature/UI is not implemented.

Manual status must never mean “automation has not been written yet.”

## 5. Required test-environment facts

Before executing a scenario, record when relevant:

- environment: local / disposable test DB / preview / staging;
- build/commit/reference revision;
- tenant ID/test tenant label;
- user role/permission set;
- workflow profile/policy revision;
- feature flag/cohort state;
- order ID and source context;
- order commercial revision (`edit_state_version`);
- workflow state version (`wfStateVersion`);
- currency/tax mode;
- settlement facts required by the scenario;
- browser/device/locale for UI tests.

Do not put credentials, secrets or unnecessary customer PII in evidence.

## 6. Scenario matrix — structural and semantic operations

| ID | Scenario | Primary automated level | Owning WP(s) | Release expectation |
|---|---|---|---|---|
| OC-STR-001 | committed unpaid `ADD_ITEM` with stable client→persisted identity | Unit + DB + E2E | WP06/WP11/WP12/WP15 | AUTOMATED_REQUIRED |
| OC-STR-002 | committed unpaid `REMOVE_ITEM` logically removes eligible descendants, preserves history | Unit + DB + E2E | WP06/WP11/WP12/WP15 | AUTOMATED_REQUIRED |
| OC-STR-003 | quantity increase creates/maintains valid piece relationship when tracked | Unit + DB | WP06/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-STR-004 | quantity decrease requires exact eligible piece selection; no blind trim | Unit + API + E2E | WP06/WP14/WP15 | AUTOMATED_REQUIRED + manual UX check |
| OC-STR-005 | `ADD_PIECE` increments active quantity and preserves UUID identity | Unit + DB | WP06/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-STR-006 | `REMOVE_PIECE` uses logical removal and does not reuse historical sequence | Unit + DB | WP06/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-STR-007 | same product appears on multiple committed lines; only selected UUID changes | Unit + E2E | WP06/WP13/WP14 | AUTOMATED_REQUIRED |
| OC-STR-008 | new target added then removed locally becomes semantic no-op | Unit + API | WP06/WP10/WP12 | AUTOMATED_REQUIRED |
| OC-STR-009 | contradictory/cyclic/dangling/duplicate operations fail deterministically | Unit + API | WP04/WP06/WP10/WP12 | AUTOMATED_REQUIRED |
| OC-STR-010 | customer identity / branch / currency changes are rejected in V1 | Schema + API + E2E | WP04/WP14 | AUTOMATED_REQUIRED |

## 7. Scenario matrix — preferences

| ID | Scenario | Primary automated level | Owning WP(s) | Release expectation |
|---|---|---|---|---|
| OC-PREF-001 | add ORDER preference using stable generic operation | Unit + DB | WP07/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-PREF-002 | change ITEM preference preserves preference row identity | Unit + DB | WP07/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-PREF-003 | remove PIECE preference logically and preserve history | Unit + DB | WP07/WP11/WP12 | AUTOMATED_REQUIRED |
| OC-PREF-004 | kind replacement is remove+add, not in-place kind swap | Unit | WP07 | AUTOMATED_EXISTING for projection slice |
| OC-PREF-005 | child preference edit after parent removal is rejected | Unit | WP07 | AUTOMATED_EXISTING for projection slice |
| OC-PREF-006 | ORDER preference money addend counted once | Unit + calculation integration | WP07/WP08 | AUTOMATED_REQUIRED |
| OC-PREF-007 | ITEM/PIECE preference extras remain in line amount and are not double-counted | Unit + calculation integration | WP07/WP08/WP12 | AUTOMATED_REQUIRED |
| OC-PREF-008 | packing/condition/service-note kinds remain generic preference operations | Unit + E2E | WP07/WP14/WP17 | AUTOMATED_REQUIRED |

## 8. Scenario matrix — pricing, tax, discounts, charges and rounding

| ID | Scenario | Primary automated level | Owning WP(s) | Release expectation |
|---|---|---|---|---|
| OC-CALC-001 | unchanged committed line keeps stored selling price after catalog price change | Unit + Preview/Apply equality | WP08/WP10/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-002 | new/changed line uses authorized override when allowed | Unit + API/security | WP08/WP10/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-003 | catalog `finalPrice` adjustment applied exactly once | Unit | WP08 | AUTOMATED_EXISTING for pure adapter slice |
| OC-CALC-004 | TAX_INCLUSIVE mode preserves gross selling semantics | Unit + integration | WP08/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-005 | TAX_EXCLUSIVE mode computes tax without reinterpretation of historical facts | Unit + integration | WP08/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-006 | non-taxable legacy-compatible order charges remain outside tax base unless owning domain changes contract | Unit + integration | WP08/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-007 | promotion cap/usage is not redeemed on Preview and not double-applied | Unit + DB | WP08/WP10/WP12 | AUTOMATED_REQUIRED |
| OC-CALC-008 | reviewed pricing/config fingerprint drift forces re-review | API + DB | WP08/WP10/WP12/WP15 | AUTOMATED_REQUIRED |
| OC-CALC-009 | currency display precision and persistence precision are handled without silent truncation | Unit + DB | WP08/WP12/WP18 | AUTOMATED_REQUIRED |
| OC-CALC-010 | currency increment rounding uses canonical currency rule when enabled | Unit + integration | later WP08 completion/WP12 | AUTOMATION_PLANNED |

## 9. Scenario matrix — financial outcome and immutable settlement

| ID | Scenario | Expected core result | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-FIN-001 | paid 20 → new total 15 | payment/voucher remain 20; outstanding 0; unresolved overpayment 5; no automatic refund | Unit + DB + E2E | AUTOMATED_REQUIRED |
| OC-FIN-002 | paid 10 → new total 20 | outstanding 10 | Unit + DB | AUTOMATED_REQUIRED |
| OC-FIN-003 | paid 20 → new total 25 | outstanding 5; original payment type unchanged | Unit + DB + E2E | AUTOMATED_REQUIRED |
| OC-FIN-004 | pending gateway payment | excluded from collected completed amount | Unit + DB | AUTOMATED_REQUIRED |
| OC-FIN-005 | split tender / applied credit | canonical completed sources aggregate correctly | Unit + DB | AUTOMATED_REQUIRED |
| OC-FIN-006 | prior processed refund | reopens due according to canonical formula | Unit + DB | AUTOMATED_REQUIRED |
| OC-FIN-007 | prior overpayment disposition | reduces unresolved overpayment without rewriting payment | Unit + DB | AUTOMATED_REQUIRED |
| OC-FIN-008 | issued fiscal obligation plus credit/debit corrections | reconciles to full current obligation, not delta document alone | Unit + fiscal integration | AUTOMATED_REQUIRED |
| OC-FIN-009 | linked B2B AR unsupported state | deny explicitly; do not rewrite posted AR invoice | Integration + E2E | AUTOMATED_REQUIRED |
| OC-FIN-010 | financial follow-up failure after Change | Change remains committed; follow-up transaction can retry independently | DB + E2E | AUTOMATED_REQUIRED |

## 10. Scenario matrix — capability, policy and authorization

| ID | Scenario | Expected | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-POL-001 | Edit entry ALLOW | editor may enter; server still re-evaluates operations | API + E2E | AUTOMATED_REQUIRED |
| OC-POL-002 | Edit entry WARN | acknowledgement/reason contract enforced | API + E2E | AUTOMATED_REQUIRED + manual clarity check |
| OC-POL-003 | Edit entry OVERRIDE | required permission/reason; proof actor-bound | API + E2E | AUTOMATED_REQUIRED + manual clarity check |
| OC-POL-004 | Edit entry DENY | editor does not open | API + E2E | AUTOMATED_REQUIRED + manual clarity check |
| OC-POL-005 | operation DENY inside otherwise-open editor | only operation blocked; server denies crafted request too | API + E2E | AUTOMATED_REQUIRED + manual clarity check |
| OC-POL-006 | hard invariant denial | override permission cannot bypass | API/security | AUTOMATED_REQUIRED |
| OC-POL-007 | policy revision changes between Preview and Apply | `POLICY_CHANGED_REVIEW_REQUIRED`/canonical re-review outcome | API + DB | AUTOMATED_REQUIRED |
| OC-POL-008 | missing operation binding | fail closed | Unit/API | AUTOMATED_REQUIRED |
| OC-POL-009 | expired warning/override proof | reject/re-review | API | AUTOMATED_REQUIRED |

## 11. Scenario matrix — Preview purity and Apply atomicity

| ID | Scenario | Expected | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-PRV-001 | Preview successful batch | result only; zero commercial DML | API + DB instrumentation | AUTOMATED_REQUIRED |
| OC-PRV-002 | Preview no-op | no Change/history/outbox/idempotency/version increment | API | AUTOMATED_REQUIRED |
| OC-PRV-003 | Preview invalid ref / cross-order target | deterministic rejection | API/security | AUTOMATED_REQUIRED |
| OC-APL-001 | Apply successful batch | one Change, one revision increment, matching ops/snapshot/audit/outbox | DB integration | AUTOMATED_REQUIRED |
| OC-APL-002 | failure after any write stage | full rollback, no partial Change/version/outbox | DB fault injection | AUTOMATED_REQUIRED |
| OC-APL-003 | Apply commercial-only Change | workflow version/status unchanged | DB integration | AUTOMATED_REQUIRED |
| OC-APL-004 | response serialization/client disconnect after commit | retry returns durable original response; no second Change | DB/API | AUTOMATED_REQUIRED |
| OC-APL-005 | Preview and Apply same frozen context | totals/facts equal within owning currency rules | Integration + DB | AUTOMATED_REQUIRED |

## 12. Scenario matrix — idempotency, concurrency and races

| ID | Scenario | Expected | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-CON-001 | same key + same payload retry | exact original response; one Change/version/outbox | DB concurrency | AUTOMATED_REQUIRED |
| OC-CON-002 | same key + different payload | conflict; no mutation | API + DB | AUTOMATED_REQUIRED |
| OC-CON-003 | two editors same expected edit version | exactly one winner; second stale | DB concurrency + E2E | AUTOMATED_REQUIRED |
| OC-CON-004 | workflow transition commits between Preview/Apply | workflow OCC conflict/re-review | DB concurrency + E2E | AUTOMATED_REQUIRED |
| OC-CON-005 | payment/refund/credit changes during review | Finance facts reloaded under coordinated lock; stale financial outcome not silently applied | DB concurrency | AUTOMATED_REQUIRED |
| OC-CON-006 | split workflow races with Change | deterministic lock/policy outcome; identities/history preserved | DB concurrency | AUTOMATED_REQUIRED |
| OC-CON-007 | duplicate Apply while first in progress | wait/replay/documented in-progress outcome; no duplicate | DB concurrency | AUTOMATED_REQUIRED |

## 13. Scenario matrix — tenant isolation and security

| ID | Scenario | Expected | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-SEC-001 | tenant A references tenant B order | deny/not found without data leak | API + DB/RLS | AUTOMATED_REQUIRED |
| OC-SEC-002 | same tenant, wrong order item/piece/pref UUID | reject hierarchy mismatch | API + DB/FK | AUTOMATED_REQUIRED |
| OC-SEC-003 | forged actor/tenant/source fields | server-derived identity wins; crafted values rejected/ignored per contract | API | AUTOMATED_REQUIRED |
| OC-SEC-004 | normal authenticated user attempts direct committed DML/RPC | denied outside owned command authority | DB/RLS/security | AUTOMATED_REQUIRED |
| OC-SEC-005 | service-role code path omits tenant predicate | security test detects/blocks unsafe access pattern | Integration/security | AUTOMATED_REQUIRED |
| OC-SEC-006 | missing `orders:edit` | API/editor denied | API + E2E | AUTOMATED_REQUIRED |
| OC-SEC-007 | override permission absent | OVERRIDE cannot apply | API + E2E | AUTOMATED_REQUIRED |

## 14. Scenario matrix — legacy migration, bypass closure and cutover

| ID | Scenario | Expected | Primary automated level | Release expectation |
|---|---|---|---|---|
| OC-MIG-001 | legacy full replacement attempts V2-enabled committed order | blocked/translated only through approved compatibility boundary | API/integration | AUTOMATED_REQUIRED |
| OC-MIG-002 | committed Quick Drop detailing | one Change, not direct bulk insert | API + DB + E2E | AUTOMATED_REQUIRED |
| OC-MIG-003 | legacy preference route on enabled committed order | translated to Change or retired response | API/integration | AUTOMATED_REQUIRED |
| OC-MIG-004 | repair/fix route on committed V2 order | governed REPAIR Change or denied; no direct replacement | API/security | AUTOMATED_REQUIRED |
| OC-MIG-005 | V2-modified order during rollback | never falls back to legacy delete/recreate | API/E2E | AUTOMATED_REQUIRED |
| OC-MIG-006 | feature disabled/non-V2 cohort | bounded compatibility behavior remains according to cutover runbook | API/E2E | AUTOMATED_REQUIRED |

## 15. Scenario matrix — UI/E2E and human judgement

Objective browser behavior should be automated in Playwright whenever reliable. Human-only validation is defined separately in `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md`.

| ID | Browser scenario | Automation | Manual companion |
|---|---|---|---|
| OC-UI-001 | open Edit Order through Order Details and load authoritative context | Playwright required | MAN-UI-001 visual context clarity |
| OC-UI-002 | denied Edit entry never opens editor | Playwright required | MAN-UI-002 denial clarity |
| OC-UI-003 | operation-level denied control cannot be committed | Playwright required | MAN-UI-003 disabled/reason usability |
| OC-UI-004 | repeated same-product lines retain exact identity during edits | Playwright required | optional visual check only if layout ambiguous |
| OC-UI-005 | Review Changes shows exact operation grouping and financial result | Playwright objective assertions | MAN-UI-005 clarity/readability |
| OC-UI-006 | stale revision/policy/calculation shows reload/re-review path; no auto-merge | Playwright required | MAN-UI-006 conflict UX clarity |
| OC-UI-007 | lost response retry keeps same idempotency key/payload | Playwright/API required | none if automation is reliable |
| OC-UI-008 | unsaved navigation protection | Playwright required | MAN-UI-008 wording/usability |
| OC-UI-009 | English and Arabic flows function | Playwright key assertions | MAN-UI-009 RTL/visual quality |
| OC-UI-010 | keyboard/focus/dialog flow | Playwright partial | MAN-UI-010 human accessibility check |
| OC-UI-011 | desktop/tablet/small viewport usable | Playwright viewport coverage | MAN-UI-011 final visual judgement |
| OC-UI-012 | financial follow-up is visibly separate from committed Change | Playwright required | MAN-UI-012 clarity/no-auto-refund impression |

## 16. Manual-test boundary

The Manual UI Test Guide is **not** a fallback for missing automation.

A scenario belongs there only when reliable automation cannot adequately prove one or more of:

- visual hierarchy/clarity;
- human comprehension of warning/denial/financial messaging;
- final RTL visual quality;
- real keyboard/focus usability judgement;
- responsive/touch/POS ergonomics;
- clipping/overlap/truncation that requires visual inspection;
- browser/device rendering differences requiring human judgement.

Objective facts such as authorization, persisted totals, revision increment, no mutation, idempotency, RLS, rollback and concurrency must remain automated.

## 17. Verification evidence contract

Each executed WP verification report should record, where applicable:

```text
Scenario ID:
WP / feature slice:
Automation status:
Test file / command:
Environment:
Expected result:
Actual result:
PASS / FAIL / BLOCKED / NOT_EXECUTED:
Evidence reference:
Known limitation / defect ID:
```

Manual evidence additionally follows the Manual UI Test Guide template.

## 18. Release-level minimum evidence

Before pilot/cutover, the release evidence must include all applicable:

- targeted unit/service regression;
- Preview purity proof;
- real DB Apply atomicity/fault injection;
- real concurrency/idempotency evidence;
- tenant isolation/RLS/direct-DML evidence;
- Playwright staff flows;
- EN/AR/RTL automated checks;
- manual-only UI scenarios that are still applicable;
- writer/bypass closure evidence;
- migration/backfill/cutover checks;
- performance/query-plan evidence required by the active performance contract;
- documented failures/gaps rather than silent skips.

## 19. Relationship to Part 9 of the living plan

Part 9 of the living implementation plan remains the high-level architecture scenario matrix and current validation summary.

This document is the detailed testing-execution companion. If this file conflicts with a frozen business/technical contract, the frozen/specialized contract wins and this guide must be corrected; do not change product behavior merely to satisfy a stale test description.
