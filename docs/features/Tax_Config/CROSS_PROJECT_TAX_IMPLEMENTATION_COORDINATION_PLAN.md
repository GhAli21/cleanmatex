# Cross-Project Tax Configuration — Coordination Plan

**Status:** Proposed — planning only  
**Projects:** `F:\jhapp\cleanmatex` and `F:\jhapp\cleanmatexsaas`  
**Related plans:** [Tenant Tax Configuration](TENANT_TAX_CONFIG_IMPLEMENTATION_PLAN.md) · [Calculation and Financial Posting Specification](TAX_CALCULATION_AND_FINANCIAL_POSTING_SPEC.md) · [HQ Tax Setup](../../../../cleanmatexsaas/docs/features/Tax_Setup/HQ_TAX_SETUP_IMPLEMENTATION_PLAN.md) · [Governance Runbook](../../../../cleanmatexsaas/docs/features/Tax_Setup/JURISDICTION_PACK_GOVERNANCE_RUNBOOK.md). The authoritative proposed table/seed/migration register is in Tenant Plan §4.2–§4.3.

## 1. Purpose

Deliver one coherent international tax configuration capability without duplicated calculation logic, cross-tenant leaks, or a false e-invoice claim. This document coordinates sequencing; it does not approve schema changes or implementation by itself.

## 2. Ownership and non-negotiable boundaries

| Concern | Owner | Consumer/constraint |
|---|---|---|
| Shared database schema, migrations, RLS, permission/catalog/navigation seeds | `cleanmatex` | HQ reads after user-applied migration. |
| Tenant tax calculation, order writes, immutable result and tax-document behavior | `cleanmatex` | HQ must not reimplement the engine. |
| Tenant tax configuration UI/actions | `cleanmatex` | Always tenant scoped and permission enforced. |
| Cross-tenant catalog/policy-pack governance and readiness operations | `cleanmatexsaas` | Service-role access only through platform API services. |
| HQ tenant administration UI/API | `cleanmatexsaas` | Every target `org_*` operation carries/filter by `tenant_org_id`. |
| E-invoicing | Separate future feature | Consumes issued immutable tax documents only. |

## 3. Shared product contract

### 3.1 Mode contract

`BASIC` and `ADVANCED` are UI/configuration modes over one tax engine.

| Capability | Basic | Advanced |
|---|---:|---:|
| Multiple independent percentage taxes | Yes | Yes |
| Fixed levy per order/item | Yes | Yes |
| Inclusive/exclusive pricing | Yes | Yes |
| One jurisdiction per tenant | Yes | Yes |
| Service/customer scope | No | Yes |
| Exemption certificate | No | Yes |
| Compound/priority tax | No | Yes |
| Quantity/weight levy | No | Yes |
| Tax periods | No | Yes |

### 3.2 Tax outcome contract

Both projects use the same named concepts and values: jurisdiction, authority, policy-pack version, tax type, charge kind, treatment, profile version, calculation level, amount kind, taxable base, tax amount, levy/fee amount, rounding, exemption decision, and effective date.

Only `cleanmatex` calculates/persists a final result. The fixed topology is `HQ platform web → HQ platform API → private cleanmatex tax-preview endpoint → cleanmatex calculation service`; no independent browser or platform calculation may become a money writer. The calculation/posting specification owns formulas, tax point, and rounding semantics.

### 3.3 Jurisdiction-pack contract

- Pack identity is stable; published content is versioned/effective-dated.
- `VERIFIED` means internally reviewed for the specified jurisdiction/version; it is not a blanket legal guarantee.
- `GENERIC_CONFIGURABLE` permits controlled configuration and displays a legal-review warning.
- Pack status cannot change historic order/document calculations.
- Saudi, UAE, Bahrain, Oman begin as verified packs; Qatar, Kuwait and global coverage begin as generic-controlled until a reviewed version is approved.

## 4. Delivery sequence and handoffs

### Mandatory execution and documentation discipline

At the start of every project context and before every implementation step, read the active repository's `CLAUDE.md`, `AGENTS.md`, local rules, and required skills. Use the agents/subagents required by that repository for exploration, implementation, debugging, review, and validation. A context switch requires re-applying the receiving project's instructions; never transfer implementation assumptions as rules.

For each UI change, inspect existing reusable/Cmx components first. Reuse them where suitable. Create or extend a reusable component only for behavior that is genuinely reusable across features; otherwise use a feature-owned component. Follow the active project's UI, i18n, accessibility, feedback, access-contract, navigation, and no-silent-money-mutation rules.

After every completed task, phase handoff, migration review/application checkpoint, test run, or blocker, update both affected feature plans and their `progress_summary.md`/`current_status.md` records with status, owner, evidence, validation, risks, and next action. Create `CROSS_PROJECT_STATUS.md` when Phase 0 begins and update it at every handoff.

Before release completion, invoke `/documentation` in each project to create/refresh all required feature documentation, including README, progress/current status, developer/user/deploy/testing guides, changelog, version and technical contract/runbook records. Confirm the two packs and cross-project links agree.

### Phase 0 — Decision record and read-only discovery

**Deliverables:** approved scope, ADR(s) for the mode/policy-pack/snapshot model, dependency inventory, and current data/backfill report.

**Exit gate:** user approves concrete schema and permission design. No code/migration yet.

### Phase 1 — Shared schema and permission foundations (`cleanmatex`)

**Deliverables:** new migration(s) for additive catalog/config/profile/snapshot/period needs, RLS/indexes, required permissions and any approved navigation rows.

**Mandatory pause:** create migration files only, present them for user review, and wait for the user to apply them. Do not execute database migrations.

**Exit gate:** applied migration version recorded; data backfill verified; types regenerated in both projects.

### Phase 2 — Authoritative tenant domain and engine (`cleanmatex`)

**Deliverables:** validated tenant actions/API, Basic/Advanced rule resolution, preview/commit parity, immutable snapshots, tax document/credit alignment, and tenant UI.

**Exit gate:** tenant isolation, rounding, effective dates, tax stack, Basic/Advanced, historic immutability and regression tests pass.

### Phase 3 — HQ API and governance (`cleanmatexsaas`)

**Deliverables:** secured catalog/policy-pack service, cross-tenant tenant-tax administration service, readiness/audit endpoints, and platform type generation.

**Exit gate:** permission/tenant-targeting/audit/contract tests pass; HQ service has no independent calculation authority.

### Phase 4 — HQ UI and controlled rollout (`cleanmatexsaas`)

**Deliverables:** Tax & Compliance tenant tab, catalog/policy-pack administration, readiness list, EN/AR labels and RTL-safe screens.

**Exit gate:** UI permission gating, clean error states, browser smoke in EN/AR, and API compatibility verified.

### Phase 5 — Pack activation and production verification (both)

**Deliverables:** approved published GCC/generic pack versions, pilot tenants, support runbook, rollback/retirement plan, dashboards and release evidence.

**Exit gate:** order/tax-document totals reconcile; no unintended tax changes on existing data; support owners accept operational alerts.

## 5. Migration and compatibility strategy

1. Use only additive, backward-compatible schema first.
2. Map existing configuration profiles only from old `VAT/GST/CUSTOM` values to explicit future-use catalog/treatment/charge semantics through an auditable migration. Do not backfill, recalculate, reclassify, or mutate historic orders, tax lines, or issued documents.
3. Keep old readers available until all required writers/readers use the new versioned contract.
4. Add constraints/FKs/uniqueness only after data is clean; never use `DROP ... CASCADE`.
5. Protect prior order and issued-document facts with snapshots; migration must never recalculate historical money.
6. Deploy server capability before UI activation. Use feature rollout/permission gates rather than exposing incomplete controls.

## 6. Cross-project API contract checklist

Before any endpoint is built, document for each operation:

- endpoint/method/version and caller;
- auth/permission; HQ target tenant ID versus tenant-session context;
- request schema, idempotency/concurrency rule and validation errors;
- response DTO and stable code values;
- tenant isolation behavior;
- audit event and correlation ID;
- cache invalidation/revalidation behavior;
- UI loading/success/error/forbidden/empty states;
- test coverage and rollback behavior.

Candidate operation families: tax catalog, jurisdiction packs, tenant tax configuration, tax profiles, tax stack/default, exemptions, preview/explain, readiness, periods, audit history. Do not document an e-invoice submit operation in this scope.

## 7. Data integrity and security gates

- Every `org_*` query/mutation filters `tenant_org_id`; tenant app also uses its tenant context/RLS.
- HQ API validates the requested tenant exists before writes and scopes every child record to it.
- IDs alone are never an authorization boundary.
- All money uses decimal values, not JavaScript floating arithmetic as authority.
- Default/stack changes are transactional and concurrency protected.
- Effective windows, periods, policy versions, exemption dates, references and profile scopes are validated server-side.
- Retirement is soft/inactive; used types/rules are preserved.
- User-facing errors are localized and safe; raw database/provider details never reach users.
- All configuration change paths produce audit evidence.

## 8. Test matrix

| Test family | Tenant app | HQ |
|---|---:|---:|
| Catalog/policy version validity | Consume/selector | Create/publish/retire |
| Tenant isolation and authorization | Required | Required |
| Basic tax stack / fixed levy | Formula/property, authoritative calculation | Preview/contract parity |
| Advanced scope/exemption/period | Authoritative calculation | Administration/visibility |
| Inclusive/exclusive, rounding, discounts | Authoritative calculation | Display/preview parity |
| Historic order/document immutability | Required | Read-only audit verification |
| EN/AR/RTL/accessibility | Required | Required |
| Migration/configuration mapping | Required; historic facts untouched | Type regeneration/read compatibility |

## 9. Rollback and operational plan

- Do not roll back issued tax facts. Disable new configuration activation or retire a pack version instead.
- Retain previous effective profile/pack versions for future-dated correction and audit.
- If a release defect is found, block new tax-document activation for affected tenants, preserve orders, and issue correction documents through the governed financial flow.
- Record feature/pack version, tenant impact, remediation owner and customer communication status.

## 10. Explicit deferred scope

External e-invoice provider integration, credentials, signing, clearance/reporting, inbound webhooks, filing/returns, input-tax recovery, excise/withholding modules, branch legal registration, and multi-country legal entities are separate initiatives. They must reuse—not replace—the immutable tax result and document contract defined here.
