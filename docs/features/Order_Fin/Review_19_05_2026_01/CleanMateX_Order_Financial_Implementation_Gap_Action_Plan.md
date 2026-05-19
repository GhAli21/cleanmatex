# CleanMateX Order Financial Platform — Implementation Gap Action Plan

## 0. Planning Principles

- This document is an action plan, not an architecture redesign.
- The current implementation should be preserved wherever it is already working and operationally valid.
- Proposed changes should be additive, low-risk, and reversible.
- Business decisions are separated from coding tasks so engineering does not guess finance policy.
- Production blockers are separated from enhancements so the team can ship in controlled batches.
- The current as-implemented review remains the source of truth for present-state behavior.

## 1. Executive Action Summary

- Current readiness level:
  - Substantially implemented and directionally production-capable, but not yet safe for finance sign-off without a small set of integrity clarifications and targeted fixes.
- Main blocker areas:
  - dual-ledger coexistence between the new `org_order_*` path and legacy `org_payments_dtl_tr`
  - possible payment-settings route/schema mismatch
  - unclear gateway completion semantics
  - gift-card classification conflict if finance reports consume current breakdowns
  - reconciliation scope narrower than production finance controls usually require
- Non-blocking gaps:
  - runtime-only settlement legs are not yet documented clearly
  - some backend financial capabilities are more complete than current UI exposure
  - order financial reporting surfaces are not yet complete enough for operators
- Business decisions needed:
  - source of truth, legacy retirement, settlement persistence timing, retail/delivery defaults, refund lineage strictness, gift-card presentation policy, gateway completion policy, and required reconciliation coverage
- Recommended implementation order:
  - approve decisions first
  - fix integrity blockers second
  - complete reporting/UI and tests third
  - keep optional architecture hardening last

| Category | Count | Summary |
|---|---:|---|
| Must Fix Before Production | 5 | Integrity and control gaps that can distort accounting behavior, route correctness, or production sign-off confidence. |
| Should Fix Soon | 8 | Important clarifications, reporting improvements, and test coverage that reduce operational risk after blockers are addressed. |
| Nice to Have | 7 | Useful hardening and modularization items that are valuable later but not required for initial production readiness. |
| Needs Business Decision | 9 | Policy and finance-rule choices that engineering should not infer from the locked spec alone. |
| Already Implemented / No Action | 13 | Core financial ledgers, services, UI modules, and control frameworks already exist and should be preserved. |

## 2. Decision Register

| Decision ID | Decision | Options | Recommended Option | Why | Blocking? |
|---|---|---|---|---|---|
| D-001 | Is `org_order_*` the official financial source of truth going forward? | Keep both paths active; make `org_order_*` authoritative and map legacy; keep legacy authoritative | Make `org_order_*` authoritative and treat legacy as transitional | The review shows the new path is substantially implemented and aligns with current target direction without requiring a rebuild. | Yes |
| D-002 | What is the retirement/mapping plan for legacy `org_payments_dtl_tr`? | Immediate cutover; read-only legacy with mapping; long-term coexistence | Read-only legacy with explicit mapping and reconciliation during transition | This reduces rollout risk and avoids breaking existing flows while removing ambiguity. | Yes |
| D-003 | Should persisted settlement header/leg tables be added now, later, or not at all? | Add now; defer until audit/reporting need is proven; never add | Defer and document current runtime model first | The review did not prove this is a current production blocker, and forced persistence now risks unnecessary redesign. | Yes |
| D-004 | Should retail default be `PAY_ON_COLLECTION` or current `CASH`? | `PAY_ON_COLLECTION`; `CASH`; configurable by org/branch | Keep current `CASH` until business explicitly changes policy | The review found working current behavior; this is a business-rule choice, not an automatic bug. | Yes |
| D-005 | Should `PAY_ON_DELIVERY` be supported in V1? | Yes now; no for V1; configurable later | No for V1 unless delivery operations explicitly require it before go-live | The review found no confirmed V1 flow; adding it now expands scope without proven production need. | Yes |
| D-006 | Is payment-row-level refund linkage enough, or is original settlement-leg linkage required? | Payment row only; settlement leg required; hybrid later | Accept payment-row linkage for V1, revisit only if split-refund reporting proves insufficient | Current refunds work, and the review did not show a hard production failure from missing settlement-leg lineage. | Yes |
| D-007 | Should gift card be removed from discount lines and shown only as credit/stored-value application? | Keep mixed presentation; move fully to credit/stored value; dual display | Move fully to credit/stored-value application | Finance reporting should not treat liability redemption as commercial discount. | Yes |
| D-008 | Should gateway payments be treated as completed only after external confirmation? | Immediate internal completion; pending until external confirmation; method-specific behavior | Pending until external confirmation for gateway methods | This is the safest accounting stance and avoids overstating payment success. | Yes |
| D-009 | Which reconciliation checks are required before production? | Current limited checks; current plus targeted additions; broad full-suite buildout | Current plus targeted additions: dual-ledger, retained-cash, gateway state, credit-application completeness | This closes the biggest control gaps without expanding into a large reconciliation program. | Yes |

## 3. Production Blockers

### PB-001 — Dual-Ledger Source-of-Truth Risk

- Current finding:
  - The newer `org_order_*` financial model and legacy `org_payments_dtl_tr` path both remain active.
- Evidence from review:
  - Gap Matrix marked legacy/new ledger unification as `Critical` and `Blocking`.
  - Risk Register states reports, refunds, and reconciliation can diverge by payment path.
- Business risk:
  - Finance teams may see different answers depending on which ledger/report path is queried.
- Technical risk:
  - Reconciliation, refund traceability, and downstream reporting can drift silently.
- Recommended action:
  - Approve a source-of-truth statement that `org_order_*` is authoritative for order finance going forward.
- Safe implementation approach:
  - Do not remove legacy code first.
  - Add mapping documentation, cross-ledger checks, and read-path alignment before any retirement step.
- Files/tables likely affected:
  - `org_order_payments_dtl`
  - `org_order_credit_apps_dtl`
  - `org_order_refunds_dtl`
  - `org_payments_dtl_tr`
  - reporting and reconciliation services
- Tests required:
  - dual-ledger consistency
  - refund consistency across both paths
  - report parity on representative orders
- Acceptance criteria:
  - a written source-of-truth statement is approved
  - a mapping exists for legacy-to-new behavior
  - at least one automated cross-ledger reconciliation check is in place
- Owner suggestion:
  - Solution architect + finance lead + backend lead
- Blocking level:
  - P0 Production Blocker

### PB-002 — Payment Settings Route/Schema Mismatch

- Current finding:
  - At least one payment settings route appears to filter by non-existent `branch_id` on `org_payment_methods_cf`.
- Evidence from review:
  - Executive Summary calls this out directly.
  - Risk Register warns of route failure or hidden logic bug.
- Business risk:
  - Payment method setup can behave incorrectly in production, leading to wrong checkout options or admin misconfiguration.
- Technical risk:
  - Runtime failures, empty method lists, or silently ignored filters.
- Recommended action:
  - Verify route behavior against actual schema and correct the query/filter contract.
- Safe implementation approach:
  - Prefer a narrow route/service fix only.
  - Avoid redesigning payment configuration tables.
- Files/tables likely affected:
  - payment settings API route(s)
  - payment settings service(s)
  - `org_payment_methods_cf`
- Tests required:
  - route query behavior with and without branch context
  - schema-contract regression test
- Acceptance criteria:
  - route returns expected payment methods without referencing nonexistent columns
  - admin UI remains functional for current setup flows
- Owner suggestion:
  - Backend/API owner
- Blocking level:
  - P0 Production Blocker

### PB-003 — Gateway Completion Semantics Are Not Safe Enough

- Current finding:
  - The review found card/gateway methods can be financially posted before external capture/confirmation is clearly proven.
- Evidence from review:
  - Risk Register states settlement status may overstate real-world payment success.
- Business risk:
  - Revenue, cash, and receivable balances may be recognized too early.
- Technical risk:
  - A gateway failure or timeout could still leave a locally completed-looking payment state.
- Recommended action:
  - Define and enforce a gateway status policy for pending, failed, and completed states.
- Safe implementation approach:
  - Apply a method-specific completion policy.
  - Do not rebuild payment capture architecture in this phase.
- Files/tables likely affected:
  - order settlement service
  - payment-related status fields
  - gateway-capable payment method configuration
- Tests required:
  - pending gateway
  - failed gateway
  - confirmed gateway completion
  - retry/idempotency behavior
- Acceptance criteria:
  - gateway-capable methods cannot be marked fully completed without approved external confirmation logic
  - failure and timeout states are reconciled consistently
- Owner suggestion:
  - Finance systems lead + backend lead
- Blocking level:
  - P0 Production Blocker

### PB-004 — Gift Card Classification Conflict

- Current finding:
  - Gift card ledger exists, but calculation/reporting logic still treats gift card partly like discount.
- Evidence from review:
  - Discounts section notes `giftCardApplied` is pushed into `discountLines`.
  - Risk Register warns liability can be misreported as discount.
- Business risk:
  - Gross sales, discount analysis, and liability reporting can become misleading.
- Technical risk:
  - UI and reports may show financially inconsistent breakdowns across modules.
- Recommended action:
  - Move gift card presentation and reporting to credit/stored-value treatment once approved.
- Safe implementation approach:
  - Keep existing ledger tables.
  - Change classification/presentation first, then validate reports.
- Files/tables likely affected:
  - order calculation service
  - order financial tab/report
  - any finance reports consuming discount lines
  - gift card ledger and order credit application views
- Tests required:
  - gift card + cash
  - gift card + card
  - report classification regression
- Acceptance criteria:
  - gift card redemption is not shown as discount in financial breakdowns
  - liability/redemption reporting stays internally consistent
- Owner suggestion:
  - Finance product owner + frontend/backend owners
- Blocking level:
  - P0 Production Blocker if finance reporting depends on current breakdowns; otherwise high-priority pre-go-live fix

### PB-005 — Reconciliation Scope Too Narrow for Production Sign-Off

- Current finding:
  - Reconciliation framework exists, but coverage is narrower than expected for production finance assurance.
- Evidence from review:
  - Missing checks include dual-ledger unification, retained-cash deeper audit, and credit-application linkage completeness.
- Business risk:
  - Stakeholders may assume stronger controls than currently exist.
- Technical risk:
  - Production issues can remain undetected until month-end or manual audit.
- Recommended action:
  - Add a targeted minimum reconciliation control set before production sign-off.
- Safe implementation approach:
  - Extend existing reconciliation framework only where risk is highest.
  - Do not launch a full reporting overhaul first.
- Files/tables likely affected:
  - reconciliation service
  - finance reports
  - cash drawer summaries
  - order payment and credit application ledgers
- Tests required:
  - reconciliation run with dual-ledger discrepancies
  - retained cash discrepancy
  - gateway state mismatch
- Acceptance criteria:
  - production readiness checklist includes approved reconciliation checks
  - reconciliation can raise actionable issues for key integrity failures
- Owner suggestion:
  - Finance operations lead + backend lead
- Blocking level:
  - P0 Production Blocker

## 4. Should Fix Soon

### SF-001 — Document the Runtime Settlement Leg Model Explicitly

- Current finding:
  - Settlement leg behavior exists in services, but not in persisted settlement header/leg tables.
- Evidence from review:
  - Settlement header not found; settlement legs exist as runtime objects only.
- Business risk:
  - Teams may assume persistence and lineage that do not actually exist.
- Technical risk:
  - Future work may accidentally design against a false model.
- Recommended action:
  - Publish a short technical note describing current runtime settlement orchestration and refund lineage boundaries.
- Safe implementation approach:
  - Documentation first; persistence only if later approved.
- Files/tables likely affected:
  - documentation only initially
- Tests required:
  - none for documentation
- Acceptance criteria:
  - current runtime leg behavior is clearly documented and referenced by future work
- Owner suggestion:
  - Solution architect
- Blocking level:
  - P1 High

### SF-002 — Improve Order Financial Tab Breakdown

- Current finding:
  - Current order financial surfaces do not show the full available fact model consistently.
- Evidence from review:
  - Review notes gaps in discounts and credit applications on the financial tab.
- Business risk:
  - Operators cannot easily understand what was paid, discounted, credited, and still owed.
- Technical risk:
  - Support teams may rely on ad hoc queries instead of product UI.
- Recommended action:
  - Add explicit sections for discounts, credit applications, and payment mix.
- Safe implementation approach:
  - Reuse current order financial action/service outputs.
- Files/tables likely affected:
  - order financial tab/report component
  - order financial action/service
- Tests required:
  - UI breakdown rendering with mixed payment scenarios
- Acceptance criteria:
  - financial tab clearly separates discounts from credit/stored-value applications
- Owner suggestion:
  - Frontend owner
- Blocking level:
  - P1 High

### SF-003 — Add Tests for Retained Cash vs Tendered/Change

- Current finding:
  - Cash drawer retained-cash math was not fully evidenced by dedicated tests.
- Evidence from review:
  - Business Rules Review marks this as partially implemented and recommends explicit tests.
- Business risk:
  - Drawer variance disputes can consume significant store time.
- Technical risk:
  - Tendered cash may be overstated as retained cash in edge cases.
- Recommended action:
  - Add focused tests around retained cash, tendered amount, and change returned.
- Safe implementation approach:
  - Use targeted service and integration tests without changing the model.
- Files/tables likely affected:
  - settlement tests
  - cash drawer tests
- Tests required:
  - exact-cash
  - over-tender with change
  - mixed-method scenarios with partial cash
- Acceptance criteria:
  - automated tests prove retained cash equals net cash kept, not gross tendered amount
- Owner suggestion:
  - Backend/test owner
- Blocking level:
  - P1 High

### SF-004 — Expand Mixed-Payment Scenario Coverage

- Current finding:
  - Several checkout combinations are not covered end to end.
- Evidence from review:
  - Missing tests include wallet + card, advance + pay-on-collection, credit note + cash.
- Business risk:
  - Production edge cases can fail in precisely the scenarios most likely to generate support tickets.
- Technical risk:
  - Uncovered branch logic can regress without notice.
- Recommended action:
  - Add missing end-to-end and integration tests for mixed payment combinations.
- Safe implementation approach:
  - Extend existing test suites rather than introducing new frameworks.
- Files/tables likely affected:
  - integration tests
  - settlement tests
  - refund tests
- Tests required:
  - wallet + card
  - advance + pay-on-collection
  - credit note + cash
  - partial payment remainder classification
- Acceptance criteria:
  - each supported combination has a passing automated happy-path and failure-path test
- Owner suggestion:
  - QA automation + backend owner
- Blocking level:
  - P1 High

### SF-005 — Add Cross-Ledger Reconciliation Check

- Current finding:
  - Reconciliation exists but does not yet explicitly guard the legacy/new ledger seam.
- Evidence from review:
  - Cross-ledger consistency is a stated report and reconciliation priority.
- Business risk:
  - Drift can remain invisible until manual finance reconciliation.
- Technical risk:
  - Silent inconsistency between two payment representations.
- Recommended action:
  - Add one targeted reconciliation check for order-financial vs legacy payment totals/status alignment.
- Safe implementation approach:
  - Start with exception reporting rather than forced auto-correction.
- Files/tables likely affected:
  - reconciliation service
  - finance reporting queries
- Tests required:
  - deliberate mismatch case
  - expected clean case
- Acceptance criteria:
  - mismatched orders are surfaced with actionable issue detail
- Owner suggestion:
  - Backend owner
- Blocking level:
  - P1 High

### SF-006 — Add Stored-Value Liability Report

- Current finding:
  - Gift card liability is visible, but no equally clear consolidated stored-value liability report was confirmed for wallet/advance/credit note.
- Evidence from review:
  - Missing reports section calls this out.
- Business risk:
  - Finance cannot easily monitor prepaid obligations outside gift cards.
- Technical risk:
  - Manual extraction becomes the default process.
- Recommended action:
  - Add a stored-value liability summary report across stored-value classes.
- Safe implementation approach:
  - Reporting-only change first; no new ledger model.
- Files/tables likely affected:
  - reporting route/service
  - stored-value UI/reporting component
- Tests required:
  - report aggregation by source type and date range
- Acceptance criteria:
  - report can show opening, movement, and closing liability totals by stored-value type
- Owner suggestion:
  - Reporting owner
- Blocking level:
  - P2 Medium

### SF-007 — Clarify Backend-Ready vs UI-Exposed Stored-Value Options

- Current finding:
  - Backend support exists for wallet, advance, credit note, and loyalty applications, but UI exposure is not consistently evidenced.
- Evidence from review:
  - Flow summaries repeatedly state backend exists while checkout UI confirmation was not found.
- Business risk:
  - Training, SOPs, and acceptance testing may assume options that operators cannot actually use.
- Technical risk:
  - Hidden capability creates confusion during rollout.
- Recommended action:
  - Document the support matrix and expose only what is approved and tested.
- Safe implementation approach:
  - Documentation/configuration first, UI enablement second if needed.
- Files/tables likely affected:
  - documentation
  - checkout configuration/UI
- Tests required:
  - support-matrix validation tests if UI exposure changes
- Acceptance criteria:
  - approved payment/credit methods are clearly labeled as backend-ready, UI-ready, or deferred
- Owner suggestion:
  - Product owner + frontend lead
- Blocking level:
  - P2 Medium

### SF-008 — Clarify B2B Invoice / AR Behavior

- Current finding:
  - Basic B2B credit eligibility exists, but full AR allocation behavior is not active.
- Evidence from review:
  - Review explicitly notes AR sophistication is below the full reference model.
- Business risk:
  - B2B customers may expect more invoice/receivable behavior than the platform actually supports.
- Technical risk:
  - Later AR expansion could be mis-scoped if V1 boundaries are not documented now.
- Recommended action:
  - Publish a V1 statement of supported and unsupported B2B invoice/AR behavior.
- Safe implementation approach:
  - Documentation first, feature expansion only if commercially required.
- Files/tables likely affected:
  - documentation only initially
- Tests required:
  - none initially
- Acceptance criteria:
  - B2B financial scope is explicit in production readiness notes
- Owner suggestion:
  - Product/finance owner
- Blocking level:
  - P2 Medium

## 5. Nice to Have

### NH-001 — Dedicated Checkout-Options API

- Why it is not urgent:
  - The review found service-level capability already exists, and current consumers do not prove a production blocker.

### NH-002 — Dedicated Tax-Engine Service Extraction

- Why it is not urgent:
  - Tax config and tax fact posting already work; extraction is a modularity improvement, not a go-live dependency.

### NH-003 — Dedicated Payment-Capture Service Extraction

- Why it is not urgent:
  - Current need is policy clarity and status enforcement, not a service-layer redesign.

### NH-004 — Broader Reporting Pack

- Why it is not urgent:
  - Core integrity controls should be completed before expanding finance reporting breadth.

### NH-005 — Persisted Settlement Header/Leg Tables

- Why it is not urgent:
  - The review did not prove current runtime settlement behavior is blocking core production operation today.

### NH-006 — Advanced Loyalty Expiry/Bonus Workflows

- Why it is not urgent:
  - Loyalty foundations already exist; advanced lifecycle controls can follow after financial stabilization.

### NH-007 — Advanced Promotion Analytics

- Why it is not urgent:
  - Promotions are implemented and operational; analytics depth is secondary to financial correctness.

## 6. Already Implemented / Preserve

- Financial snapshot on `org_orders_mst`
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Order charges table and service writes
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Order taxes table and service writes
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Order payments table with `REAL_PAYMENT`
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Credit applications table
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Stored value ledgers
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Cash drawer session/movement model
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Loyalty model
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Promotion model
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Tax config model
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Outbox and idempotency framework
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Reconciliation framework
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Payment settings UI/API
  - Preserve as-is aside from the route/schema verification fix.
  - Only improve if a specific gap is identified.
- Cash drawer UI/API
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Stored value UI/API
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Promotions UI/API
  - Preserve as-is.
  - Only improve if a specific gap is identified.
- Tax settings UI/API
  - Preserve as-is.
  - Only improve if a specific gap is identified.

## 7. Proposed Implementation Batches

### Batch 0 — Stabilization / No-Code Confirmation

- Goals:
  - confirm decisions before coding
  - align finance and engineering on current source of truth
  - verify the route/schema mismatch
  - agree production readiness criteria
- Scope:
  - decision register approval
  - source-of-truth statement
  - legacy ledger mapping
  - gateway completion policy
  - gift-card classification decision
- Exclusions:
  - no source-code changes
  - no migrations
  - no module redesign
- Files likely affected:
  - review/action-plan docs
  - operational readiness notes
- DB changes expected?:
  - No
- Risk:
  - Low
- Acceptance criteria:
  - all blocking decisions have named owners and approved outcomes
  - legacy/new ledger operating policy is documented

### Batch 1 — Critical Integrity Fixes

- Goals:
  - remove immediate finance/control ambiguity
  - close production blocker gaps without redesign
- Scope:
  - payment settings route/schema fix
  - gift card classification fix if approved
  - gateway status policy enforcement
  - minimal reconciliation additions
- Exclusions:
  - no settlement persistence redesign
  - no broad reporting overhaul
  - no legacy removal yet
- Files likely affected:
  - payment settings API/service
  - order calculation and settlement logic
  - reconciliation service
  - related tests
- DB changes expected?:
  - No
- Risk:
  - Medium
- Acceptance criteria:
  - each P0 blocker has a merged fix or an approved compensating control
  - no route/schema mismatch remains
  - gateway methods respect approved completion semantics

### Batch 2 — Reporting and UI Completion

- Goals:
  - make current finance facts visible and operator-usable
- Scope:
  - order financial tab improvements
  - credit applications display
  - discounts display
  - stored value liability report
  - cash drawer retained cash checks in UI/reporting where needed
- Exclusions:
  - no new core ledger models
  - no advanced analytics pack
- Files likely affected:
  - order financial tab/report UI
  - finance reporting routes/services
  - stored-value reporting UI
- DB changes expected?:
  - No
- Risk:
  - Medium
- Acceptance criteria:
  - operators can read order finance breakdowns without manual database interpretation
  - stored-value liabilities are reportable

### Batch 3 — Test Coverage

- Goals:
  - prove correctness of mixed-settlement and cash-handling paths
- Scope:
  - multi-leg tests
  - cash tender/change tests
  - stored-value combination tests
  - refund split tests
  - idempotency tests
- Exclusions:
  - no functional redesign
  - no new product features
- Files likely affected:
  - service tests
  - integration tests
  - reconciliation tests
- DB changes expected?:
  - No
- Risk:
  - Low
- Acceptance criteria:
  - P0 and P1 financial scenarios are covered by automated tests
  - regression confidence is materially improved

### Batch 4 — Optional Architecture Hardening

- Goals:
  - strengthen auditability and modularity only if justified by real operating need
- Scope:
  - settlement header/leg persistence if approved
  - dedicated tax engine if needed
  - dedicated payment capture service if needed
- Exclusions:
  - no speculative refactor without approved business case
- Files likely affected:
  - settlement services
  - tax calculation logic
  - payment capture orchestration
  - possible new additive migration files if approved later
- DB changes expected?:
  - Yes, if settlement persistence is approved
- Risk:
  - High
- Acceptance criteria:
  - optional hardening is approved by business and justified by audit or scale needs

## 8. Detailed Task Backlog

| ID | Title | Type | Priority | Area | Description | Acceptance Criteria | Depends On |
|---|---|---|---|---|---|---|---|
| BD-001 | Approve order-finance source of truth | Business Decision | P0 Production Blocker | Architecture/Finance | Decide whether `org_order_*` is the official order-financial ledger going forward. | Decision approved and documented. | None |
| BD-002 | Approve legacy payment-path transition policy | Business Decision | P0 Production Blocker | Architecture/Finance | Define whether `org_payments_dtl_tr` remains read-only transitional, active, or deprecated. | Mapping/transition note approved. | BD-001 |
| BD-003 | Approve gateway completion policy | Business Decision | P0 Production Blocker | Payments | Define pending, failed, and completed behavior for gateway methods. | Policy approved and linked to implementation tasks. | None |
| BD-004 | Approve gift-card accounting classification | Business Decision | P0 Production Blocker | Finance | Confirm gift card must be treated as credit/stored-value application, not discount. | Policy approved and report/UI implications listed. | None |
| BD-005 | Approve retail and delivery default payment policy | Business Decision | P1 High | Product/Operations | Confirm whether retail remains `CASH` and whether `PAY_ON_DELIVERY` is deferred from V1. | Decision approved and documented. | None |
| BUG-001 | Fix payment settings route/schema mismatch | Bug | P0 Production Blocker | API | Correct any payment-method route logic that filters on nonexistent schema fields. | Route passes schema-contract tests and returns correct data. | None |
| BUG-002 | Enforce gateway completion semantics | Bug | P0 Production Blocker | Settlement | Prevent locally completed financial state for gateway methods until approved completion criteria are met. | Pending/failed/completed gateway tests pass. | BD-003 |
| BUG-003 | Correct gift-card classification in breakdown/reporting | Bug | P0 Production Blocker | Finance/UI | Remove gift card from discount-style presentation and align with stored-value application treatment. | Gift card no longer appears as discount in breakdown outputs. | BD-004 |
| DOC-001 | Publish runtime settlement model note | Documentation | P1 High | Architecture | Document current runtime settlement-leg behavior, refund lineage, and non-persisted boundaries. | Note added and referenced by backlog. | BD-001 |
| DOC-002 | Publish V1 B2B invoice/AR scope note | Documentation | P2 Medium | Finance | Clarify what AR behavior is supported now versus deferred. | Scope note approved. | None |
| DOC-003 | Publish stored-value support matrix | Documentation | P2 Medium | Product/UI | Mark wallet, advance, credit note, and loyalty options as backend-ready, UI-ready, or deferred. | Support matrix reviewed with product/QA. | None |
| FEAT-001 | Add minimal dual-ledger reconciliation check | Feature | P1 High | Reconciliation | Extend reconciliation to flag mismatch between legacy and new order-finance ledgers. | Reconciliation can detect and list mismatches. | BD-001, BD-002 |
| FEAT-002 | Improve order financial tab breakdown | Feature | P1 High | UI/Reporting | Show discounts, credit applications, and payment mix clearly. | Financial tab displays complete approved breakdown. | BUG-003 |
| FEAT-003 | Add stored-value liability report | Report | P2 Medium | Reporting | Provide consolidated stored-value liability visibility across wallet, advance, credit note, and gift card. | Report shows grouped liability totals and movements. | BD-004 |
| TEST-001 | Add cash retained vs tendered/change tests | Test | P1 High | Settlement/Cash Drawer | Verify expected cash retained is net of change and not gross tendered. | Service and integration tests pass for cash scenarios. | None |
| TEST-002 | Add mixed-payment combination tests | Test | P1 High | Checkout | Cover wallet + card, advance + pay-on-collection, credit note + cash, and partial-payment remainder. | All targeted mixed-payment tests pass. | BD-005 |
| TEST-003 | Add refund split-lineage coverage | Test | P2 Medium | Refunds | Prove current payment-row refund linkage is sufficient for approved V1 scope. | Approved refund scenarios pass without ambiguity. | D-006 decision equivalent |
| TEST-004 | Add idempotency duplicate-submit coverage for gateway/stored-value paths | Test | P1 High | Integrity | Strengthen confidence in duplicate submit handling under mixed methods. | Duplicate-submit tests pass consistently. | BUG-002 |
| DATA-001 | Produce legacy-to-new ledger mapping sheet | Data Migration | P1 High | Finance/Operations | Create a mapping artifact that explains equivalent fields and transaction meaning across the two ledgers. | Mapping sheet approved by finance and engineering. | BD-001, BD-002 |
| RPT-001 | Add reconciliation readiness checklist | Documentation | P1 High | Operations | Define the minimum reconciliation checks required before go-live. | Checklist approved and linked to release gate. | BD-003, D-009 decision equivalent |

## 9. Test Plan

### P0 Tests

- Dual-ledger consistency
  - Verify the same representative order does not produce conflicting totals/status across `org_order_*` and legacy payment views under the approved transition model.
- Cash tendered/change retained cash
  - Verify retained cash equals net cash kept after change returned.
- Payment settings route/schema
  - Verify payment configuration routes do not reference nonexistent schema fields and return expected method sets.
- Gateway pending/failed/completed behavior
  - Verify local financial state stays pending until external confirmation for gateway methods.
- Gift card classification after fix
  - Verify gift card redemption is reported as credit/stored-value application, not discount.

### P1 Tests

- Cash + card
- Wallet + card
- Gift card + cash
- Advance + pay-on-collection
- Credit note + cash
- Partial payment with remainder
- Refund by payment row/current lineage
- Idempotency duplicate submit

### P2 Tests

- Reports
- UI display
- Reconciliation runs
- Tax inclusive/exclusive
- Promotion expiry

## 10. Migration Safety Plan

- Additive first
  - Prefer additive schema changes only if later approved; do not alter working ledgers destructively.
- Avoid destructive drops
  - No table retirement or column removal until the legacy/new ledger transition is complete and verified.
- Inspect existing indexes/constraints
  - Review current uniqueness, foreign keys, and status constraints before introducing any additive metadata.
- Backfill strategy
  - If future additive fields are introduced, backfill from existing order-financial facts and legacy mappings in an idempotent, auditable way.
- Rollback notes
  - Every future migration should include rollback considerations and a release fallback plan.
- Seed safety
  - Any future seed changes for payment methods, statuses, or settings must preserve current production-compatible codes and avoid silent code drift.
- Prisma/Supabase type generation notes
  - If future schema changes are approved, regenerate types only after migration review and keep type updates isolated from logic changes.
- RLS review notes
  - Any future schema additions to `org_*` tables must preserve tenant isolation and receive explicit RLS review before rollout.

## 11. Risk-Based Recommendation

- What to do first:
  - Approve the decision register, especially source of truth, legacy transition, gateway completion, and gift-card classification.
  - Then execute the narrow P0 integrity fixes.
- What not to touch yet:
  - Do not rebuild checkout, settlement, tax, or payment architecture.
  - Do not add settlement header/leg persistence yet unless a real audit requirement is approved.
  - Do not retire legacy tables before mapping and reconciliation controls exist.
- What needs business approval:
  - retail default
  - delivery support in V1
  - refund lineage strictness
  - gift-card classification policy
  - gateway completion semantics
  - required reconciliation sign-off scope
- What can safely wait:
  - dedicated checkout-options API
  - tax-engine extraction
  - payment-capture service extraction
  - advanced loyalty/promotion analytics
  - persisted settlement headers/legs
- Whether current implementation can continue toward production after selected fixes:
  - Yes. The current implementation appears strong enough to continue toward production if the P0 blockers are resolved, the decision register is approved, and the targeted tests/reconciliation controls are completed.

## 12. Final Output Format Requirements

- This document is intentionally practical, direct, and implementation-ready.
- It does not repeat the full as-implemented review.
- It does not redesign already working modules.
- It does not generate migrations or modify code.
- It is suitable for execution in small, low-risk batches.
