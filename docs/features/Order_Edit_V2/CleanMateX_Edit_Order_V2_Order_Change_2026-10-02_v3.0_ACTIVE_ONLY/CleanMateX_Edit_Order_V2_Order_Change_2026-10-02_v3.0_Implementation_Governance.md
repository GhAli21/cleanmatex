# CleanMateX Edit Order V2 / Order Change v3.0 — Implementation Governance

**Version:** 3.0  
**Date adopted:** 2026-10-14 (Asia/Muscat)  
**Status:** ACTIVE — mandatory implementation-governance contract for WP01–WP20  
**Progress authority:** `Edit_Order_V2_Final_Implementation_Plan_Current_Codebase_v3.0.md` remains the sole WP sequence/progress authority.

## 1. Purpose and authority

This document defines **how** Edit Order V2 / Order Change v3.0 work packages must be discovered, designed, implemented, verified, documented, and closed.

It does **not** replace:

- Full Architecture — target/business architecture;
- Production Implementation Specification — technical implementation contract;
- specialized DB/API/security/UI/service contracts;
- the living implementation plan — WP01–WP20 sequence, dependencies, status, evidence, and next action.

If this governance rule exposes a conflict with an approved frozen invariant or specialized contract, stop the affected implementation and record the conflict in the living plan; do not silently reinterpret the architecture.

## 2. Work Package Definition of Done

A WP is not `DONE` merely because coding finished.

A WP becomes `DONE` only when implementation, verification, the active implementation plan/progress ledger, dependencies, gaps/decisions, and all affected architecture/API/DB/security/UI/QA/runbook documentation are synchronized and verified.

A WP may be marked `DONE` only when all applicable conditions are satisfied:

1. required implementation scope is complete;
2. functional verification passes at the package's required level;
3. architecture/reuse/domain-boundary verification passes;
4. implementation report/evidence is current;
5. the living implementation plan/progress ledger is synchronized;
6. dependency/gap/decision records are updated when affected;
7. relevant API/DB/security/UI/QA/test-guide/manual-test/runbook documentation is synchronized;
8. legacy migration/deprecation status is recorded when affected;
9. no unresolved contradiction exists between code, tests, package report, and active v3.0 contracts.

When any required gate is incomplete, use `PARTIAL`, `BLOCKED`, or another explicit non-DONE status. Do not use `DONE` merely because files compile or unit tests pass.

## 3. Mandatory reuse-first discovery

Before implementing any WP or substantial WP step, inspect the real current CleanMateX codebase and verified schema for existing:

- services and domain services;
- repositories/data-access helpers;
- domain handlers/adapters;
- utilities and validators;
- types/schemas/contracts;
- API routes/server actions;
- database tables/functions/views/RPCs;
- catalogs/configuration/feature flags;
- permission/RBAC checks;
- pricing/tax/finance/calculation engines;
- workflow/fulfillment/delivery services;
- preference/charge logic;
- audit/history/outbox/idempotency/OCC mechanisms;
- UI components/hooks/Cmx components;
- tests, fixtures, and existing edge-case coverage;
- legacy/current Order Edit behavior relevant to the package.

Do not begin by creating a new service/helper/table/component merely because the WP text names a conceptual component.

## 4. Mandatory implementation classification

For every significant need, record one classification:

- `REUSE_AS_IS`
- `REUSE_WITH_EXTENSION`
- `REFACTOR_AND_REUSE`
- `REPLACE`
- `NEW_REQUIRED`

For legacy/current Edit Order components also allow:

- `MIGRATE_BEHAVIOR_TO_V2`
- `REUSE_SHARED_COMPONENT`
- `TEMPORARY_COMPATIBILITY`
- `DEPRECATE_AFTER_V2_CUTOVER`
- `REMOVE_AFTER_V2_CUTOVER`

New implementation is justified only when no suitable existing implementation exists, the existing implementation is unsafe/incompatible, or reuse would create worse coupling than a proper new boundary.

## 5. Canonical Order Change target

The new Order Change V2/v3.0 architecture is the canonical target for committed commercial order edits.

```text
API / UI
   -> Order Change orchestration
      -> capability/policy evaluation
      -> deterministic projection/preview
      -> typed operation handlers/adapters
      -> canonical CleanMateX domain services
      -> atomic Apply/audit/outbox/OCC
```

The V2/v3.0 implementation must not become a thin permanent wrapper around legacy `OrderService.updateOrder()` or another full-replacement Edit writer.

A narrowly bounded temporary compatibility adapter is allowed only when required during migration, with an explicit retirement owner/gate.

## 6. Legacy Edit migration and deprecation

Legacy/current Edit Order code is inspected to preserve valuable behavior, not to remain the future mutation authority.

Inspect it for:

- proven business requirements;
- validation and edge cases;
- useful UX behavior;
- reusable presentation/shared components;
- safe canonical domain-service calls;
- types/contracts still valid;
- tests and operational/audit expectations.

If useful behavior exists only in legacy Edit, migrate or reimplement that behavior inside the new Order Change architecture.

Do **not** make new V2/v3.0 business logic permanently depend on the legacy Edit orchestration/writer merely to reuse behavior.

Once a V2/v3.0 path replaces a legacy responsibility, mark the old path as deprecated/compatibility-only. Where appropriate use JSDoc `@deprecated` plus a clear comment such as:

```text
DEPRECATED FOR COMMITTED ORDER EDITS.
Canonical replacement: Order Change V2/v3.0.
Do not add new committed-order edit behavior here.
Retire after all required V2 WPs, caller migration, E2E/UAT,
cutover verification and rollback-window closure are complete.
```

Do not delete an active legacy path before its callers are safely migrated/blocked.

## 7. Existing canonical domain services must be reused

Legacy Edit orchestration is different from canonical domain ownership.

Examples of existing domain authorities that should be reused or safely adapted where applicable:

- Pricing/Discount/Tax/Rounding;
- Finance aggregation/snapshot/reconciliation;
- Payments/Refunds/Overpayment/Stored Value/AR/Vouchers/Cash Drawer;
- Workflow policy/runtime;
- Delivery/Fulfillment/Logistics;
- Preferences/Charges;
- Audit/Outbox;
- Idempotency/OCC/security/tenant isolation.

Core principle:

> Order Change decides **when** a canonical domain participates. The canonical domain decides **how** its own business rule is calculated or executed.

Order Change must not copy the domain's formulas into a second engine.

## 8. Domain ownership

Business logic stays with its canonical owner.

- pricing logic -> Pricing;
- tax/fiscal logic -> Tax/Fiscal;
- financial aggregation/snapshot/reconciliation -> Finance;
- payment/refund/overpayment/source-cap logic -> Finance/Payments;
- workflow transition/state logic -> Workflow;
- delivery execution -> Delivery/Logistics;
- preference semantics -> owning Preference/Order domain;
- audit/event delivery -> canonical Audit/Outbox mechanisms.

Order Change is primarily an orchestration and semantic-change boundary, not a replacement implementation of those domains.

## 9. Domain-agnostic shared components

Generic/shared infrastructure must remain domain-agnostic unless domain ownership is explicit.

Use typed contracts, narrow interfaces/ports, resolver/handler registries, dependency injection, and configuration/catalog data where appropriate.

Generic components must not hard-code unrelated pricing, finance, tax, delivery, tenant, or workflow business meanings.

Example: the policy engine may evaluate `ORDER_OUTSTANDING_AMOUNT > 0`; Finance must supply the canonical value. The policy engine must not calculate outstanding itself.

## 10. Separation of concerns

Keep these responsibilities separate:

- policy evaluation != mutation execution;
- fact resolution != rule evaluation;
- projection/preview != Apply;
- pricing calculation != settlement;
- finance consequence classification != finance posting/execution;
- workflow transition != commercial Order Change;
- persistence != domain decision logic;
- API transport != domain logic;
- UI rendering != server authorization;
- audit/outbox recording != mutation decision logic.

Prefer small cohesive modules with explicit responsibilities over giant services and utility dumping grounds.

## 11. Single source of truth

There must be one authoritative implementation for each business rule.

Do not duplicate:

- selling-price/discount formulas;
- tax formulas/mode interpretation;
- order-total/snapshot formulas;
- outstanding/payment-status/overpayment formulas;
- refund/source-cap logic;
- workflow transition rules;
- delivery-status derivation;
- permission/capability rules;
- preference-charge single-count semantics;
- reconciliation rules.

If a canonical implementation cannot be called safely inside Apply because it uses global clients, nested transactions, or network access, adapt/refactor the composition boundary; do not copy the formula into a new permanent engine.

## 12. Thin orchestration and dependency direction

Preferred conceptual dependency direction:

```text
shared contracts/infrastructure
          ^
canonical domain services
          ^
Order Change adapters/handlers
          ^
Order Change orchestrator
          ^
API / UI
```

Avoid circular domain dependencies. When two domains collaborate, use orchestration, a narrow typed interface/port, or an event where appropriate.

Do not create one giant `OrderChangeService`, one file per trivial operation, multi-domain helper files, or direct cross-domain DML as shortcuts.

## 13. Unsafe existing code is not reused blindly

Existing code must be classified honestly. Refactor/replace/migrate rather than reuse as-is when it:

- deletes/recreates committed rows and destroys identity/history;
- accepts client-supplied authoritative money;
- bypasses canonical calculations;
- bypasses audit/idempotency/OCC/tenant isolation;
- opens incompatible transactions/global reads/network calls inside Apply;
- contains obsolete hard-coded editability/status rules;
- mixes multiple domain responsibilities;
- creates a second source of truth.

Safe behavior may still be migrated into the new architecture.

## 14. No new committed-edit features in legacy Edit

After adoption of this governance contract, new committed-order editing capability belongs in Order Change V2/v3.0.

If an old route/screen must temporarily remain, it should translate recoverable intent to the new Change authority or reject unsupported legacy payloads once its cohort is V2-enabled. Do not evolve a second legacy mutation engine in parallel.

## 15. Required reuse/domain review in each WP report

Every applicable WP implementation/evidence report must include an **Existing Code Reuse and Domain Ownership Review** with at least:

| Requirement | Existing code found | Canonical domain | Classification | Reused/changed files | Reason |
|---|---|---|---|---|---|

For each significant new component record:

```text
Component:
Domain owner:
Responsibility:
Should be domain-agnostic: YES / NO
Existing equivalents reviewed:
Canonical dependencies:
Legacy Edit behavior reviewed:
Classification:
Why new code is required:
How duplication is prevented:
Architecture verdict:
```

If the WP overlaps legacy Edit, also record:

| Legacy behavior/component | Keep behavior? | V2/v3.0 destination | Legacy status |
|---|---|---|---|

## 16. Architecture verification gate

Before marking a WP `DONE`, verify in addition to functional tests:

- canonical owners were discovered and used appropriately;
- no unnecessary duplicate business logic exists;
- no second source of truth was introduced;
- shared/generic code remains appropriately domain-agnostic;
- separation of concerns and dependency direction are preserved;
- transaction/network boundaries match the active technical contracts;
- legacy dependency/deprecation status is explicit;
- any deliberate exception is documented with rationale and owner.

## 17. Documentation synchronization

A completed WP must update all applicable artifacts, not only code.

At minimum maintain:

- WP implementation/evidence report;
- living implementation plan/progress ledger;
- tests/results, scenario IDs and known limitations;
- dependency/gap/decision entries when affected;
- API/DB/security/UI/test-guide/manual-test/runbook contracts when affected;
- legacy migration/deprecation status when affected.

Do not create a second implementation plan or competing progress ledger.

## 18. Testing documentation and manual-test boundary

Testing is governed by two dedicated companions:

- `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Test_Guide_and_Scenario_Matrix.md` — complete automated/manual scenario catalog and execution evidence contract;
- `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Manual_UI_Test_Guide.md` — only human-judgement UI tests that cannot be adequately proven by reliable automation.

Every applicable WP verification report must reference relevant scenario IDs from the master Test Guide.

Manual testing must not be used as a substitute for missing automation. Objective behavior such as authorization, tenant isolation, transaction rollback, idempotency, concurrency, persisted money, revision/version changes and no-write guarantees must be automated at the appropriate layer.

Every manual scenario must identify the exact navigation path, route when known, page/screen, UI area, control, numbered interaction steps, expected result, locale/RTL/device instructions, final state and evidence to capture. If the exact UI does not yet exist, mark the scenario `NOT_EXECUTABLE_YET`; do not guess the final control/path.

## 19. Mandatory WP execution flow

```text
WP starts
  -> read living plan package
  -> read this governance contract
  -> read applicable specialized contracts
  -> inspect real code/schema
  -> inspect relevant legacy Edit behavior
  -> identify canonical domain owners
  -> classify reuse/refactor/replace/new
  -> review SoC/domain-agnostic/dependency boundaries
  -> identify gaps
  -> implement bounded WP in canonical V2/v3.0 architecture
  -> architecture verification
  -> functional verification
  -> update legacy deprecation/migration status
  -> synchronize documentation
  -> DONE only if all applicable gates pass
```

The prohibited shortcut is:

```text
read WP -> create new files/services -> implement -> call it DONE
```

## 20. Retroactive governance audit — WP07, WP08, WP09

Because WP07–WP09 were implemented before this governance contract was adopted, they require a one-time retroactive audit before their results are treated as governance-complete foundations for later mutation work.

The audit must inspect actual WP07–WP09 code and compare each new service/helper/calculation/classification against existing canonical CleanMateX services and legacy Edit behavior. It must identify:

- missed reuse;
- duplicated algorithms/business rules;
- wrong domain ownership;
- unnecessary coupling;
- domain-specific logic inside generic components;
- second sources of truth;
- unsafe dependence on legacy Edit orchestration;
- useful legacy behavior that still needs migration.

Classify each significant item using this document's classification set and produce a remediation plan before changing code.

Until that audit is completed and any required remediation/revalidation is closed, WP07–WP09 are **implemented/tested slices but not governance-complete DONE packages**. If remediation changes their outputs, revalidate WP10 Preview composition before relying on it for WP11+.

## 21. Final migration goal

```text
Before: Legacy Edit Order is the committed-edit path.
During migration: Legacy Edit is deprecated/compatibility-only; Order Change V2/v3.0 is canonical for enabled cohorts.
After cutover: Order Change V2/v3.0 is the only committed commercial edit authority; legacy mutation writers are retired/decommissioned while historical records remain readable.
```
