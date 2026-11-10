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
| OC-CALC-011 | Create parity: re-pricing an unchanged order gives exactly Create's total, tax and line columns | DB | P1B-12 | AUTOMATED_EXISTING |
| OC-CALC-012 | the cart quote (`POST /api/v1/orders/quote`) equals the stored Create snapshot: total, tax, each line | DB | P1B-12 | AUTOMATED_EXISTING |
| OC-CALC-013 | Preview = Apply = stored rollup for every Edit kind (quantity, add/remove line, preferences, order and line speed, override, line price, line discount, custom line, notes-only not re-priced) | DB | P6-01/P6-02/P1B-12 | AUTOMATED_EXISTING |
| OC-CALC-014 | recorded discounts re-evaluated per D21; a removal needs the Review acknowledgement before a proof is issued | Unit + DB | P1B-05/P1B-11 | AUTOMATED_EXISTING |
| OC-CALC-015 | a promo removed by an edit gives its use back (usage voided, `current_uses` −1); a booking records its promo use | DB | P1B-12 | AUTOMATED_EXISTING |
| OC-CALC-016 | tax on edit uses the recorded rate (D22); a later catalog price never re-prices a stored line; a new line gets today's Create price (D23) | Unit + DB | P1B-06/P1B-07 | AUTOMATED_EXISTING |
| OC-CALC-017 | loyalty delta at Apply is traced to the change (D24) | Unit + DB | P1B-10/P1B-15 | AUTOMATED_EXISTING |
| OC-CALC-018 | the Edit live card (quote mode) shows the Review figures | API + unit | Reusable View P3-08/P4-08 | NOT_APPLICABLE_YET |

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

## 20. Unit evidence after the WP07–WP09 reuse remediation — 2026-10-14

| Scenario IDs | Automation status | Command | Result |
|---|---|---|---|
| OC-PREF-001–008 | Unit slice PASS | `npx jest __tests__/services/order-change/order-change-preference-projection.test.ts --runInBand --forceExit --watchman=false` | 7 passed |
| OC-CALC-001–009 | Unit slice PASS | Edit adapter plus Create calculation plus `format-money` and inclusive extraction suites | 6 Edit, 23 Create, 8 money, inclusive extraction passed |
| OC-CALC-010 | AUTOMATION_PLANNED | Currency-increment rounding stays in the server-only helper | Not executed inside the pure adapter |
| OC-FIN-001–010 | Unit slice PASS | `npx jest __tests__/services/order-change/order-change-financial-result.service.test.ts --runInBand --forceExit --watchman=false` | 5 passed |
| WP10 preview composition | Revalidated PASS | Preview service and route suites | 11 passed |

These rows are unit evidence only. They do not claim a database, browser, or manual UI pass. Manual UI scenarios remain `NOT_EXECUTABLE_YET`.

## 21. Parity evidence on the shared calculator — 2026-10-31 (Reusable View P1B-12)

Run from `web-admin`. DB suites need local Supabase on port 54322; each runs in one rolled-back transaction.

| Scenario IDs | Evidence | Command | Result |
|---|---|---|---|
| OC-CALC-011, 012, 013, 015, 016 (new line), 017 (Edit request) | `__tests__/db-integration/order-change-edit-parity.db.test.ts` | `npx jest --config jest.db.config.js __tests__/db-integration/order-change-edit-parity.db.test.ts` | PASS |
| OC-CALC-014 | `__tests__/services/commercial/edit-discount-reevaluation.test.ts` + the preview/apply unit suites | `npx jest __tests__/services/commercial` | PASS |
| OC-CALC-016 (recorded tax, stored line price) | `__tests__/services/commercial/commercial-edit.loader.test.ts` | same | PASS |
| OC-CALC-017 (ledger) | `__tests__/db-integration/loyalty-order-earn-reconcile.db.test.ts`, `__tests__/services/loyalty.service.test.ts` | `npx jest --config jest.db.config.js __tests__/db-integration/loyalty-order-earn-reconcile.db.test.ts` | PASS |

Browser steps for the same rules: [Line-Level QA guide](../../Order_Fin/Line_Level_Money_Snapshot/QA_TEST_GUIDE.md) S9–S17.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch8: controlled core Edit)

**Retest r5/core Edit:** 2026-11-07 16:37:44 Asia/Muscat (UTC+4), Demo Laundry/admin, EN1440×985 CSS; AR clean-context check then EN restored. Only dedicated `ORD-20261107-00001` UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9` changed. Detailed returned evidence `/workspace/qa-20261107/man-core-edit-ledger.md`.

| # | Result | Companion and exact scope |
|---|---|---|
| OC-UI-001 | FAIL identity UI subcheck; context PARTIAL | MAN001 current customer controls contradict locked identity contract; context/rev load observed. No security bypass proof. |
| OC-UI-005 | PARTIAL | MAN005 twoops grouping/before-after/financial Review and successful controlled Apply; stale editor/audit findings remain. |
| OC-UI-010 | PARTIAL | MAN010 Escape noncommit PASS; opener-focus restoration not established/page-root observation; no full keyboard proof. |
| OC-UI-012 | PARTIAL | MAN012 visible separate collect follow-up/no autopayment PASS; overpayment example pending. |
| OC-UI-008 / 011 | NOT RUN this batch | No dirty-navigation or responsive/POS exercise. |
| OC-UI-007 | NOT RUN | One Apply and one record do NOT prove lost-response same-key/payload retry/idempotency. |
| Other OC UI rows | NOT RUN this batch | MAN004 WARN/OVERRIDE evidence is additional manual coverage; do not map MAN004 to duplicate-line OC004 (MAN013). Clean AR is not full OC009 flow. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch8)
- **FET-OCUI-Nov07-Core:** Preserve exact companion boundaries. Regress current enabled identity controls, stale committed editor, reason reopen, focus and Unknown user findings recorded in Manual guide. Missing automated retry/security coverage remains missing; no replacement by visual observations.

Bathrobe quantity1→2 preserves override2.100/unit,line4.200; Shirt.300−discount.030=net.270 retained. Live card new4.783/was2.536/delta+2.247/balance4.783/To collect. Review matches numbers, but Updating persisted>25s and stale after Apply. Independent reload total4.783,tax.313,paid0,credits0,due4.783 POC/Reconciled; processing/preparation pending unchanged.

History exactly1Change#1,2ops,reason `QA-20261107 controlled quantity retest`,source order-edit,revision1→2,workflow version1; Applied by Unknown user. ItemUUID `2e052d4b-0c4e-4f20-a408-c29988ccbc80`; added pieceUUID `db4b929d-e1aa-4e96-8d2c-fd39428f7da6`,piece2/processing/expected. Single Apply click proves only observed single record, NOT lost-response retry or durable idempotency.

**Evidence** `/workspace/qa-20261107/shots/`: `man-core-baseline.png`, `man-core-note-review.png`, `man-core-note-discarded.png`, `man-core-quantity-staged.png`, `man-core-quantity-review-required.png`, `man-core-review-reason-required.png`, `man-core-review-reason-entered.png`, `man-core-review-ready.png`, `man-core-post-apply-balance.png`, `man-core-change-history.png`, `man-core-final-items.png`, `man-core-ar-context.png`, `man-core-final-en.png`.

### Test data left behind / current fixture state
Dedicated order now revision2,total4.783/tax.313/paid0/due4.783 OMR,POC,processing/pending,OPEN; Bathrobeqty2 atoverride2.100 and Shirtqty1 net.270;3pieces;one change/twoops/above reason. Note-only draft discarded. No other order/policy/payment/collection/refund/workflow/print/message changes. Final independent EN detail, no dirty draft. Original Create ledger remains historical baseline, not current total.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch11: stale guard and navigation)

**Run:** returned17:17 Asia/Muscat (UTC+4), underlying16:57–17:15 about18minutes (exceeded15minbound). Demo admin,own `ORD-20261107-00001` UUID `cce8a46e-a8f4-4346-8ca1-790182d1e1d9`; EN,final reportedCSS1920×1072/computer capture1280×800. Authoritative `/workspace/qa-20261107/man-stale-nav-ledger.md` read completely. Finalone clean detailtab `/dashboard/orders/{UUID}?tab=change_history`.

| # | Result | Evidence |
|---|---|---|
| MAN006 / OC006 | PARTIAL | B note `QA-20261107-STALE-B-DO-NOT-SAVE` WARNack/Reviewagain initiallySTALE thenREADY asynchronously. Second editor A blocked `Close the other edit window before opening this order again.` Limited single-editor guard evidence PASS; NO concurrent committedstaleApply,no409/networkcapture,no full conflict-recovery PASS. B canceled/discarded before A opened. |
| MAN008 / OC008 | PARTIAL | NAVdraft `QA-20261107-NAV-DRAFT-DO-NOT-SAVE`; Backprompt `Leave without saving?` / `You have unsaved changes. Are you sure you want to discard them?` Cancel/Confirm. Cancel retained draft/route; explicit Discard restored savedAnote/0dirty. Sidebar Orders/Expand wouldnotopen,aria-expandedfalse,noAppmessage; AllOrdersprompt/Leavepath not reached. Backafterdiscard didn'tnavigate; normal detailroute used. |
| MAN013 / OC004 | BLOCKED fixture | Bathrobe+Shirt are NOTsameproductcommittedduplicates. No duplicate draft attempt; missingprecondition,not productFAIL. |
| MAN011 / OC011 | NOT RUN | No responsivevisualpass. |
| OC007 | NOT RUN | One Apply doesnotprove durableidempotency/retry. |

**A notes-only controlled Apply:** after Bclosed,revision2 note `QA-20261107-STALE-A-COMMIT`,1dirty,No money change,total4.783. WARNack→Reviewagain initiallypending/stale thenREADY,no reasonrequested. Applyonce,toast `The change was saved.` Followup `Collect 4.7830 OMR on the existing collection screen. This screen does not take payment.` Backtoorder,no collection.

Independentreload revision3/exactly2historyrecords: oldquantityChange#1 unchanged2ops; newChange#2 oneChange notes op,revision2→3,delta0.000,total4.783/tax0.313,paid0/due4.783,POCprocessing/pending. Newrecord AppliedbyUnknownuser,No reason recorded (none requested),sourceorder-edit,A note persisted. B/NAVnotes absent. No quantity/speed/price/discount/payment/workflow/customer/branch/policy changes.

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch11)
- **FET-EOV2-Nov07-SingleEditorBoundary:** Record single-session guard rather than claiming stale409. Full concurrent stale review test needs supported isolated sessions/testharness; do not bypass guard by internalAPI.
- **P2 candidate FET-EOV2-Nov07-SidebarNav:** Sidebar Orders/Expand didnotopen,preventing remaining navtest; capture current shell interaction on repeat,sourcecause unconfirmed. BackCancel/explicitDiscard passes don't prove sidebarLeavepath.
- **FET-EOV2-Nov07-ReviewPending:** Brief STALE→READY after acknowledged Reviewagain observed without repeat; record asyncsequence,not definitive conflictresult.
- **FET-EOV2-Nov07-NotesScope:** Editnotes persistence nowpasses; prior Createnotes absence remains provisional/separateflow,not resolved by Edit.

**Evidence** `/workspace/qa-20261107/shots/`: `man-stale-b-review-stale.webp`,`man-stale-b-ready-review.webp`,`man-stale-concurrent-edit-block.webp`,`man-stale-a-ready-review.webp`,`man-stale-a-applied-balance.webp`,`man-stale-a-history.webp`,`man-stale-final-en.webp`,`man-nav-draft-staged.webp`,`man-nav-back-prompt.webp`,`man-nav-back-stay.webp`,`man-nav-draft-discarded.webp`.

### Test data left behind / latest fixture
Revision3,total4.783,tax0.313,paid0,due4.783,POCprocessing/pending;2totalChanges(2oldqtyops+1newnotesop). A note intentionallysaved,B/NAVnot;onecleanENdetailtab. No other saved changes. These actualstates supersede expectedrevision3 in brief,not historicalrecords. No Arabiccheck thisbatch.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch15: public tracking and small Edit subset)

**Follow-up:**17:33–17:41:29 Asia/Muscat(UTC+4),Demo admin,ownrev3ordercce8a46e-a8f4-4346-8ca1-790182d1e1d9;EN,final1920×1072CSS. ActualChromeUIincognito/clipboardpaste/device-toolbarused;noShellclipboard/API. Authoritativeupdated`/workspace/qa-20261107/public-fin-customitem-ledger.md`. No savedchanges;existingcustomdraftalreadyloggednotdoublecounted.

| # | Result | Evidence |
|---|---|---|
| OC-UI-011 | PARTIAL | ManualcompanionMAN011configured360cleanvisualsubset;objectiveviewportmatrixnotproven. |

**MAN011/OC011 PARTIAL:** ChromeDevToolsdevice-toolbarconfigured360×985(notzoom). Playwrightreported434×1188whileemulated,so360evidenceisDeviceToolbarsetting,NOTindependentactualCSSmeasurement. Cleanrev3/0dirty,total4.783;Branchdisabled,Reviewvisible/enabled,Discardvisible/disabledclean. Servicecategorybarhorizontal-scrollshowsWash&Iron/DryCleaning,latersclipped;contexttabs1–3visible,laterstepsclipped. RecordP2responsiveusabilitycandidate;horizontal-scrollaloneisnotautomaticallybugifalltabsreachable—verifyreachability/primaryactionsbeforefullFAIL. Full1440/1024/smallPOSmatrixandReviewdialognotcoveredbythissubset. Desktoprestored.
Evidence`shots/custom-item-mobile-360-branch.png`,`custom-item-mobile-360-review-discard.png`,`custom-item-mobile-360-category-overflow.png`,`custom-item-mobile-360-context-tabs.png`under`/workspace/qa-20261107/`.

### Tester suggestions — Financial_Expert_Tester(batch15)
- **FET-OCUI-Nov07-ViewportBoundary:** Do notequateDevToolssetting/screenshotpixelswithindependentactualCSSmeasurement;fullautomatedviewportcoveragepending.

### Test data left behind
None;ownrev3,total/due4.783,tax.313,paid0,processing/pending,twoChanges;customdraftdiscarded(noadditionalcustomattemptcount). ENcleandetail,incognitoclosed,desktoprestored. No messages/linksend/revoke/payment/workflow/printing/policy/settings.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch17: entry candidate piece and tablet retest)

**Run:** tasktimestamp17:42,lastcheck17:52:52 Asia/Muscat(UTC+4);startsecondnotcaptured,10minboundmaybeslightlyexceeded. EN,responsivetoolbar1024×985/1440×985,lastowncleandetail1440×985. Read `/workspace/qa-20261107/man-entry-piece-tablet-ledger.md` completely. No savedorder/ReviewonDelivered/Apply/Delete/pieceAddRemove/workflow/paymentchanges. Ownrev3/total4.783 unchanged.

| # | Result | Exact mapping boundary |
|---|---|---|
| OC002 / MAN002 | PARTIAL candidate; trueentryDENY untested | DeliveredcandidateEditOPENwithoperationrestrictions. No establishedentryDENYdecision,socontractFAILnotasserted. |
| OC011 / MAN011 | PARTIAL | Actualtoolbars1024/1440cleancontext+noteswarningReview;1024tableclipped/overflow,headeractionsvisible;1440noapparentoverlap. NoAR/fullPOSmatrix/automatedviewportproof. |
| MAN007 piece-selection companion | PARTIAL manual-only | Qtydecreasenopickerlocalonly. This relatesOC-STR-004,NOTsame-productOC004/MAN013. NoApply/exactservereligibilityproof. |
| OC007 | NOT RUN | No retry/idempotencytest. |

### Tester suggestions — Financial_Expert_Tester (2026-11-07 batch17)
- **P2 candidate FET-EOV2-Nov07-PieceSelector-Retest:** Localqtydecreaseauto-reducedvisiblepiececountwithoutchooser,matchingpriorUXobservation. Verifyintendedeligiblepiece-selectionworkflowwithrealprotectedpiecefixture;noDBwrong-removalclaim.
- **P2 candidate FET-EOV2-Nov07-1024Table:** Horizontallyclippeditemtableat1024whileReview/Discardvisible. Testscrollreachability/contentbeforebroadunusableclaim;1440cleanlayoutlooksbetter.
- **FET-EOV2-Nov07-EntryFixture:** DeliveredwithclosedoperationsisnotanentryDENYsample;preparegenuineentryDENYthroughpermittedexistingfixture/account,nopolicychangetojustmanufactureit.

**Evidence** `/workspace/qa-20261107/shots/man-entry-delivered-denials.png`,`man-piece-quantity1-piece-list.png`,`man-tablet-1024-controls.png`,`man-tablet-1024-review-dialog.png`,`man-desktop-1440-review-dialog.png`.

### Test data left behind
No persistentchanges. Owncce8a46e-a8f4-4346-8ca1-790182d1e1d9rev3/0dirty/Bathrobeqty2,Shirtdiscountunchanged,total/due4.783,paid0,tax.313,savedAnoterestored;2Changesunchanged. Deliveredcandidateunchangedrev1/19.260. EN1440×985owndetail. Existinghistoricalresultsretained,notrewritten.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch18: long bilingual Review and financial previews)

**Run:**2026-11-07 17:54:09–18:06:54 Asia/Muscat(UTC+4),12m45s(2m45over10minbound);owncce8a46e-a8f4-4346-8ca1-790182d1e1d9,EN/AR→EN1440×985CSS. Fullauthoritative`/workspace/qa-20261107/man014-oc009-p6-05-p6-03-ledger.md`read. No Apply/payment/taxdoc/refund/void/credit/workflow/printing/PDFsave.

| # | Result | Mapping correction |
|---|---|---|
| OC009 / MAN009 | FAIL actualARReview subcheck |BilingualfunctionalEditReviewcomesfromlongreasonARattempt,NOTCollectPayment. ENREADYvsARREASON_REQUIREDdespitesame310charreason. |
| MAN014 additionalmanual | PARTIAL visual / functionalreasonFAIL |Longfield/footerreachable,notbroaderall-statePASS. |

LedgerheadingscallingOC009CollectmodalandP6-05A4reportaremislabels:collect=P6-05,actualreport=P6-03. No unrelatedfinancialactionsusedtosignoffOC009.

**LongReview:** localBathrobeqty2→3,subtotal6.600,4pieces. BlankreasonREASON_REQUIRED;exact`QA-20261107 long review reason `repeated10=310charactersverified. ENReviewagainREADY,current4.783/projected7.0300,tax.313→.460,line4.200→6.300,OUTSTANDING,qty+Addpiece3/unit2.100/processing/expected;bothCAPABILITY_POLICY_OVERRIDE_REQUIRED. ReachableApply/Cancel;Applynotclicked.
ARwithsamedraftandexactreasonvisibleinالسبب:oneمراجعةمرةأخرىattemptremainedREASON_REQUIRED,noApply;Reviewagain/Cancelreachable,noretries. This is functionalreason-stateFAILsubcheck,noserver/securityrootcause. ExactrawUIresidue READY,REASON_REQUIRED,OUTSTANDING,CAPABILITY_POLICY_OVERRIDE_REQUIRED,processing,expected,CHANGE_ORDER_NOTES,CHANGE_ITEM_QUANTITY,ADD_PIECE;intentionalENreasonisnottranslationdefect. Cancel+Discardrestoresrev3/qty2/0dirty/4.783.
Evidence`shots/man-long-en-reason-field.png`,`man-long-en-ready-bottom.png`,`man-long-ar-review.png`under`/workspace/qa-20261107/`.

### Tester suggestions — Financial_Expert_Tester(batch18)
- **FET-OCUI-Nov07-BilingualReview:** Addregressionexactlongreasonlocale-switchworkflow;retainreportedARreasonstate/localizationfailurewithnosavedmutation. OtherOCcontractsnotpassedbythischeck.

### Test data left behind
No savedchanges;alldraftsdiscarded,ownrev3/Bathrobeqty2,total4.783,tax.313,paid0,due4.783,POCprocessing/pending,twoChanges. EN1440×985cleandetail,nomodal;no printing/payment. Priorfailures/roundstextpreserved.

Cumulative provisional ledger recount: PASS 0 / FAIL 2 / PARTIAL 7 / BLOCKED 1 / NOT RUN 2: OC-UI-003, OC-UI-007 (12 parent scenarios). Subcheck PASS does not imply parent PASS.


## Financial_Expert_Tester Results — 2026-11-07 (progress batch23: remaining Edit prerequisite notes only)

No new UI or automated execution. Read `/workspace/qa-20261107/remaining-edit-view-preflight.md`; these notes do not convert prior evidence into new coverage.

| # | Result | Evidence boundary |
|---|---|---|
| OC-UI-003 | NOT RUN target behavior | Contract operation-level denied control cannot be committed (Playwright required), MAN003 disabled/reason companion. Prior speed/price/discount baseline and allowed notes/quantity do not establish REMOVE_ITEM DENY mixed with allowed controls. Need confirmed normal-UI DENY fixture and enforcement evidence. No policy mutation/Remove/Apply attempted. |
| OC-UI-007 | NOT RUN target behavior | Lost-response retry must retain same key/payload and durable original outcome. One earlier Apply/one record or single-editor guard does not prove it. Supported retry/fault harness unavailable; SCM disconnected. No simulated loss/retry, second Apply, internal request or guard bypass. |

### Tester suggestions — Financial_Expert_Tester (batch23)
- **P2 FET-OCUI-Nov07-RemainingPrereqs:** Retain exact deny-fixture and supported retry-harness requirements. Read-only policy/affordance inspection can only characterize prerequisites; don't replace objective enforcement/idempotency evidence with UI visibility or duplicate one-click history.

**Counts unchanged:** PASS0/FAIL2/PARTIAL7/BLOCKED1/NOT RUN2:OC-UI-003,OC-UI-007. No action undertaken on own order rev3,total/due4.783,paid0; no source/API/DB/spec execution or SCM reconnection. Earlier result text preserved.

### Test data left behind
None; preparation only, no saved changes.


## Financial_Expert_Tester Results — 2026-11-07 (FINAL reconciliation: INCOMPLETE)

**INCOMPLETE — NO OVERALL PASS.** Original requested QA pass stopped after the completed evidence below; no further testing. Parent PARTIAL/BLOCKED/NOT RUN are unresolved coverage, and NOT RUN0 never means all subchecks passed. Earlier rounds/leaf FAILs remain unchanged. This is own final reconciliation, not an edit of author requirements or other editors' results. No source/spec additions or execution.

**Final parent counts:** PASS 0 / FAIL 2 / PARTIAL 7 / BLOCKED 2 / NOT RUN 1.

**FAIL IDs:** OC-UI-001, OC-UI-009
**PARTIAL IDs:** OC-UI-002, OC-UI-005, OC-UI-006, OC-UI-008, OC-UI-010, OC-UI-011, OC-UI-012
**BLOCKED IDs:** OC-UI-003, OC-UI-004
**NOT RUN IDs:** OC-UI-007


### Latest completed OC003 / MAN003 read-only evidence
18:55:26–18:59:06 Asia/Muscat(UTC+4), Demo super_admin EN1440px. Full `oc003-policy-affordance-ledger.md` read. Own actual `/dashboard/orders/cce8a46e-a8f4-4346-8ca1-790182d1e1d9/edit`: revision3,processing,0unsaved,Bathrobeqty2,total4.783. Edit Policy Info: Standard Order Change V1; Organization-wide override; policyrev3/PILOT; workflowprofile version4/PILOT. Remove an item(Item) **Needs an override**, NOT Not allowed/DENY. Exact explanation: `You can change this while editing. Review checks the current policy before anything is saved.` / `A person with override permission must approve this before Apply.` / `Review asks for a reason before Apply.` Change notes showed allowed-with-warning, read only. Enabled-looking Remove item hover gave no accessible tooltip; explanation existed in Policy Info. No Remove clicked, no fields changed/Review/Apply. No enforcement PASS or warning-as-failure. Required real REMOVE_ITEM DENY plus allowed-operation fixture remains missing: parent BLOCKED prerequisite, enforcement target NOT RUN.

**Manual-scope correction:** Original user explicitly said no Playwright spec exists and for now checks are manual. Absence of a new OC-UI spec is NOT a blocker to manual OC003. Missing real DENY fixture is the blocker; do not add a spec/code. OC007 lost-response/same-key/payload retry remains NOT RUN because no safe supported harness, not because visual evidence failed. No guard/SCM bypass.
Evidence under `shots/`: `oc003-policy-info-editor.webp`,`oc003-policy-remove-item.png`,`oc003-policy-remove-affordance.webp`. Clean EN detail restored; no saved change.
### Tester suggestions — Financial_Expert_Tester final
- P2 FET-FINAL-OCBoundary: Retain partial manual browser evidence without claiming unexecuted denied-commit/retry/concurrency/objective guarantees. OC003 manual execution is permitted in original scope once real DENY fixture available; OC007 needs supported safe harness. No code/spec added, SCM remains disconnected.
### Test data left behind
Own order rev3,total/due4.783,paid0,2Changes unchanged; no new Apply or records. No messages/printing/password changes.


## Financial_Expert_Tester Results — 2026-11-08 (remote-only policy/access retest and parity adaptation)

**Remote UI evidence:**2026-11-08 16:36:02–16:41:06 Asia/Muscat(UTC+4),HQ System Administrator; full `hq-policy-role-retest.md` read. No toggles/fill/reset/save/publish/assignment/grant/account change. REMOTE ONLY per user direction: tenant `https://cmx.cleanmatex.com`, HQ `https://hqsaas.cleanmatex.com`; no more localhost/listener checks or service actions. cmx is tenant web-admin, NOT a newly supplied customer mobile app.

| # | Result | Evidence |
|---|---|---|
| OC003/MAN003 prerequisite context | BLOCKED true-DENY fixture; target behavior unexecuted | HQ source/clone policy inventory unchanged; no new tenant denied-operation attempt. SourceProcessing15rows4WARN/11override/0DENY not evidence of required REMOVE_ITEM DENY. Manual OC003 not blocked by missing new Playwright spec. |
| OC007 | NOT RUN | No lost-response/retry test or safe harness; no code/spec added. |
Source actual `/en/order-change-config/edit-policies/f0fc3115-d9f4-4f6d-9350-5a16e4ab3bb6`:ORDER_CHANGE_STANDARD_V1 Pilotrev3,230/702. Processing15rules,4Allow with warning/11Require override/0Deny. CHANGE_SERVICE_SPEED Order=Require override, reason/orders:edit_override; NOT a substitute for Item/Piece. All five requested pairs still absent: CHANGE_SERVICE_SPEED Item/Piece, CHANGE_DISCOUNT Item/Piece, CHANGE_ITEM_PRICE Item. No row means no decision combobox/per-row disabled reason; no exposed per-cell add. Smart fill note only adds missing cells, NOT activated or validated as safe pair-add mechanism.
Existing clone actual `/en/order-change-config/edit-policies/a6f6c2ef-8d69-4ab1-9770-d99e33730b62`:ORDER_CHANGE_STANDARD_QA_20261107_V1 Draftrev2/230of702,unassigned/unpublished per current description; Processing same15/4WARN/11override/0DENY, same five pairs absent. Fill missing only/Reset suggestions NOT used; no new clone/type or protected decision changes. Source Pilot badge/list vs adjacent `Unassigned Draft starter matrix. HQ must review, promote, and assign it before any tenant can use it.` is qualified descriptive UX inconsistency, NOT proven lifecycle/backend resolution bug. No current tenant-side parity tested in this evidence.
### Tester suggestions — Financial_Expert_Tester(Nov8 remote policy)
- **P2 FET-OC-Nov08-PrereqBoundary:** Keep absent five line pairs as setup blocker only; do not sign off denied commit, retry or parity from HQ row inventory.
Parent counts unchanged FAIL2/PARTIAL7/BLOCKED2/NOT RUN1(OC007).

### Test data left behind
None created/changed by this retest. Existing source Pilotrev3 and clone Draftrev2 preserved; no publish/assignment/grant. Order last-known Nov7 state is NOT independently verified by HQ-only retest. Final clean EN policy list; no messages/printing/password changes.
