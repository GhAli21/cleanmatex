# Tenant Tax Configuration — Implementation Plan

**Status:** Proposed — planning only  
**Owner:** `cleanmatex` tenant app and shared migration authority  
**Companion plans:** [calculation/posting specification](TAX_CALCULATION_AND_FINANCIAL_POSTING_SPEC.md) · [HQ plan](../../../../cleanmatexsaas/docs/features/Tax_Setup/HQ_TAX_SETUP_IMPLEMENTATION_PLAN.md) · [cross-project plan](CROSS_PROJECT_TAX_IMPLEMENTATION_COORDINATION_PLAN.md)  
**Explicit exclusion:** external e-invoice/clearance integrations. Tax documents remain the source input for a future, separate e-invoice feature.

## 1. Approved product decisions

1. Every country can onboard. Each tenant has one active tax jurisdiction in phase one; branches inherit it.
2. The UI has **Basic** and **Advanced** modes. They use one calculation engine and one immutable order snapshot contract.
3. Basic Mode supports an independent tax stack: one or more percentage taxes or fixed levies. Fixed levies may be per order or per item. Quantity/weight levies are Advanced Mode.
4. Advanced Mode unlocks scoped profiles, exemptions, effective schedules, compound/priority rules, and tax periods.
5. GCC packs are available from launch: verified packs for Saudi Arabia, UAE, Bahrain, and Oman; controlled generic GCC configuration for Qatar and Kuwait until a verified policy is approved. A generic configurable pack supports all other countries.
6. Saudi receives a dedicated tax-document readiness experience, but no ZATCA submission in this scope.
7. Users with the appropriate permission may perform all allowed tax changes. No maker-checker is required; reasoned audit records are mandatory.
8. Issued tax documents and their tax results are immutable. Later changes use correction documents, never retrospective rewrites.

## 2. Current repository baseline

| Area | Confirmed current state | Required outcome |
|---|---|---|
| Tax profiles | `org_tax_profiles_cf` stores tenant, type, rate, compound flag, `applies_to`, dates, default and activity. | Evolve it into the tenant rule source without losing existing records. |
| Exemptions | `org_tax_exemptions_cf` stores customer/service scope, certificate and dates. | Make combined scope semantics and date validation explicit. |
| Global types | `sys_tax_types_cd` seeds `VAT`, `GST`, `CUSTOM`, but runtime code hardcodes the same values. | Make the catalog the selector source; remove hardcoded executable taxonomy safely. |
| Tenant UI | `/dashboard/settings/tax` has profile and exemption UI/actions. | Replace duplicate/drifted behavior with Basic/Advanced configuration UX. |
| Pricing | `org_tenants_mst.tax_pricing_mode` supports `TAX_EXCLUSIVE` and `TAX_INCLUSIVE`; branch override exists. | Preserve these semantics and expose them as a Basic setting. |
| Engine | Existing profile resolution and `org_order_taxes_dtl` persistence exist. | Enforce scope/treatment/order-vs-item calculations and create full snapshots. |
| Documents | Existing tax-document lifecycle requires registration and triggers. | Preserve its immutability; do not add external submission here. |

## 3. Functional contract

### 3.1 Basic Mode

Basic Mode is the default. It contains only:

- jurisdiction pack and tax registration details;
- tax enabled/disabled;
- inclusive/exclusive price presentation;
- one or more active taxes/levies, each with type, bilingual display label, percentage or fixed amount, item/order basis, effective date, active state, and treatment;
- a calculation preview for an item and an order;
- a compliance readiness banner; and
- audit history.

Basic rules are intentionally constrained: all rules apply to all eligible items, percentage rules are independent (no tax-on-tax), and there are no customer/service exemptions. Basic Mode permits `TAX` and `LEVY` only; a `FEE` remains in the commercial-pricing domain. The calculation, document, and reporting contract is normative in the companion specification.

### 3.2 Advanced Mode

Advanced Mode keeps every Basic rule and adds:

- service/category and future branch applicability;
- item-level or order-level percentage tax rules;
- profile priorities and compound base rules;
- rate/version schedules with validation of date windows;
- customer-only, service-only, and customer-plus-service exemptions;
- certificate metadata, expiry, verification state, and reference attachment;
- operational tax periods (`OPEN`, `CLOSED`) with a reasoned reopen path; and
- an explainable tax-decision preview showing which rule won and why.

Switching mode changes visibility, not stored financial meaning. Downgrading to Basic must be blocked while an advanced-only rule remains active; it may be deactivated/retired first, never deleted if used.

### 3.3 Deterministic calculation pipeline

`tenant jurisdiction/version → tenant tax mode → active effective rules → line/order eligibility → exemption decision → taxable base after discounts → independent or sequenced calculation → rounding → persisted snapshot`

Rules to implement and test:

- tax treatment is one of `STANDARD`, `ZERO_RATED`, `EXEMPT`, `OUT_OF_SCOPE`;
- zero-rated and exempt are distinct at 0%; only the applicable policy pack defines reporting behavior;
- a fixed levy has an explicit `ORDER` or `ITEM` basis and is not silently folded into percentage tax;
- a percentage profile has exactly one calculation level, `ITEM` or `ORDER`;
- Basic rules are independent; Advanced rules may compound only with an explicit sequence/base;
- line and order discounts use the established financial allocation rules before tax calculation;
- precision is `DECIMAL(19,4)` for money and the jurisdiction pack supplies the rounding mode/point;
- a preview and committed order use the same server authority and inputs; and
- refunds, credits, amendments, and issued documents use the original persisted result, not current configuration.

## 4. Proposed data and migration work

No migration is authorised by this document. The implementation creates new migrations only in `F:\jhapp\cleanmatex\supabase\migrations\`, then stops for user review and application.

### 4.1 Schema changes to design and approve

| Concern | Planned approach | Invariant |
|---|---|---|
| Tax type catalog | Extend `sys_tax_types_cd` with tax/levy/fee classification, configurable/verified capability and display metadata; seed VAT, municipality tax, tourism tax, tourism levy, service levy and generic custom types. | Codes are never deleted or renamed after use. |
| Jurisdiction packs | Add concise global jurisdiction/policy-pack records and versioned effective rules, including country, authority, allowed treatments, default rates, rounding and verified status. | Generic packs never claim legal verification. |
| Tenant configuration | Add a tenant-scoped tax configuration record or clearly bounded tenant-master fields for mode, jurisdiction, policy version, enabled state, registration and pricing mode. | One active jurisdiction/configuration per tenant in phase one. |
| Profiles | Extend `org_tax_profiles_cf` rather than duplicate rates: treatment, charge kind, amount kind, calculation level, priority and policy version. | A used profile is superseded, not legally rewritten. |
| Scope assignments | Replace free-text `applies_to` incrementally with validated relational assignments to existing service/category records. | Every assignment remains tenant-scoped. |
| Exemptions | Add explicit scope-match semantics, verification status and attachment/reference metadata; preserve existing data through a mapped legacy state. | Customer + service means both match, not either. |
| Periods | Add tenant/jurisdiction periods only for Advanced Mode. | Closing a period blocks backdated issued tax documents; reopening requires a reason. |
| Order tax facts | Extend the persisted tax line/snapshot contract with charge kind, treatment, rule/profile version, policy version, calculation level, taxable base and rounding. | History is immutable. |

### 4.2 Proposed table register and seeds

This is the complete **proposed** register for implementation planning. It is not a migration and does not authorise table creation.

| Table | Decision | Core purpose / relationship |
|---|---|---|
| `sys_tax_types_cd` | Extend existing | Global stable type code, bilingual labels, `charge_kind`, activity and sort order. Pack verification does **not** belong here. |
| `sys_tax_jurisdictions_cd` | New | ISO country/authority, IANA timezone, default currency and activity. |
| `sys_tax_policy_packs_mst` | New | Stable pack identity; references a jurisdiction and has a unique pack code. |
| `sys_tax_pack_versions_cf` | New | Immutable/effective-dated policy-pack version, source/reviewer/review dates, pack status, rounding and tax-point policy. |
| `sys_tax_pack_rules_dtl` | New | Rules allowed by one pack version: tax type, treatment, charge/reporting bucket, default rate, and Basic/Advanced capability. |
| `org_tax_config_cf` | New | One active tenant configuration/candidate lifecycle: selected pack version, Basic/Advanced mode, application source, acknowledgement and activation status. |
| `org_tax_profiles_cf` | Extend existing | Tenant-specific tax/levy rule: treatment, amount kind/value, calculation level, priority, policy version and supersession. |
| `org_tax_exemptions_cf` | Extend existing | Exact match semantics, certificate verification/expiry and attachment reference. |
| `org_tax_periods_mst` | New | Advanced-mode tenant/jurisdiction period status and close/reopen reason. |
| `org_order_taxes_dtl` | Extend existing | Immutable calculation snapshot only; no replacement table. |
| `org_tenants_mst` | Reuse existing | Existing tax registration and tenant pricing mode remain canonical; do not duplicate them. |

No tax audit table is proposed: reuse the existing audit-event infrastructure. No e-invoice table is proposed. Advanced service/category scope tables are deferred until the exact existing catalog keys are confirmed, so they can use real tenant-safe foreign keys rather than polymorphic text IDs.

#### Seed register

| Seed group | Values / rule |
|---|---|
| Existing type preservation | Preserve `VAT`, `GST`, `CUSTOM` codes and all existing references. |
| Added tax types | `MUNICIPALITY_TAX`, `TOURISM_TAX`, `TOURISM_LEVY`, `SERVICE_LEVY`. `FEE` is a charge classification, not a phase-one tax-setup seed. |
| Jurisdictions | `SA`, `AE`, `BH`, `OM`, `QA`, `KW`, and global generic scope. |
| Pack identities | `GCC_SA_VAT`, `GCC_AE_VAT`, `GCC_BH_VAT`, `GCC_OM_VAT`, `GCC_QA_GENERIC`, `GCC_KW_GENERIC`, `GLOBAL_GENERIC_VAT`. |
| Pack versions | One effective-dated initial version per pack, with source/review metadata. Generic packs have no automatic tenant tax rate. |
| Tenant configuration | Seed no new active tenant profiles/configurations. HQ may create a safe candidate default later; it never overwrites an active configuration. |
| Permissions/navigation | Seed only approved new HQ tax permissions and any approved HQ navigation row in the same `cleanmatex` migration sequence. |

### 4.3 Planned migration units

The migration filenames and sequence numbers are `TBD` until implementation starts and the current last migration is inspected.

1. **Global catalog and pack foundation:** global tables, type additions, GCC/global pack/version/rule seeds, indexes and global integrity constraints.
2. **Tenant configuration and rule evolution:** `org_tax_config_cf`, profile/exemption extensions, periods, RLS, indexes and tenant-safe references.
3. **Immutable outcome compatibility:** additive `org_order_taxes_dtl` snapshot fields and read-compatible constraints; historic facts are untouched.
4. **RBAC/navigation:** only after exact HQ route/permission approval, seed permissions and `sys_components_cd` navigation metadata.

Each unit is created as a new migration in `cleanmatex`, presented for review, and never applied by the agent.

### 4.4 Migration safety sequence

1. Read current constraints, indexes, RLS policies, functions and dependent order/tax-document objects through read-only discovery.
2. Add new nullable/backward-compatible fields and catalogs; seed only non-destructive defaults.
3. Map existing configuration profiles only with explicit legacy mappings and verify counts. Never backfill, recalculate, reclassify, or edit historic order tax lines or issued documents.
4. Update runtime to read both old and new representation during the transition.
5. Add validated foreign keys/check constraints and partial unique invariant(s) only after backfill passes.
6. Retire obsolete hardcoded checks in a separate, reviewed migration with no `CASCADE`.
7. Regenerate Prisma/database types after the user applies each approved migration.

Every `org_*` object requires `tenant_org_id`, RLS, tenant indexes, and composite references where they strengthen isolation.

## 5. Tenant implementation work packages

### WP-T0 — Mandatory implementation discipline and documentation lifecycle

Before every implementation step, read and follow the active project's `CLAUDE.md`, `AGENTS.md`, applicable local rules, and the required skills for the work being performed. Use the required agents/subagents for exploration, multi-file implementation, debugging, review, and testing exactly as the active project instructions require. Do not carry assumptions across a `cleanmatex`/`cleanmatexsaas` context switch.

For UI work, inventory the existing Cmx/reusable component and feature patterns first. Reuse an existing component where it satisfies the requirement. Create/extend a reusable Cmx component only when the behavior is genuinely cross-feature reusable; otherwise keep the component feature-owned. Never bypass the design system with raw/shadow UI primitives.

After **each completed task, work package, migration review checkpoint, test run, or blocked decision**, update this implementation plan plus the feature documentation status artifacts with completed/pending/blocked status, owner, evidence, validation result, risk, and next action. Create the status artifacts when the first implementation task begins; do not wait for release.

Required ongoing documentation artifacts: `README.md`, `progress_summary.md`, `current_status.md`, `developer_guide.md`, `user_guide.md`, `deploy_guide.md`, `testing_guide_and_scenarios.md`, `CHANGELOG.md`, `version.txt`, and needed `technical_docs/` records. At the final release-documentation step, invoke the `/documentation` skill to create/refresh the complete relevant pack, cross-link it, and validate status/progress consistency.

### WP-T1 — Canonical domain contracts and permission audit

- Define shared tenant-domain constants/types from database values; do not duplicate catalog codes in Zod, UI, and services.
- Retain `tax:view_config` and `tax:manage_config`; introduce a period-close permission only if an approved RBAC migration seeds it.
- Review every server action and API route for explicit authorization, tenant predicate, safe error handling, and user-facing localization.
- Remove or repair dead legacy endpoints only after callers are identified.

**Acceptance:** no mutation depends solely on UI hiding or an ID-only write; every mutation has an auditable actor and tenant proof.

### WP-T2 — Catalog and jurisdiction-pack consumption

- Provide a tenant-safe read contract for active tax types and the tenant's allowed policy-pack rules.
- Replace hardcoded `VAT | GST | CUSTOM` selectors/validation with catalog-backed values constrained by the selected policy pack.
- Display verified versus generic-configured status plainly; never calculate an unconfigured enabled jurisdiction.
- Keep user-entered labels bilingual where the profile permits local labeling.

**Acceptance:** adding a supported catalog type requires no UI source edit; unsupported types cannot be selected for a policy pack.

### WP-T3 — Basic Mode screen

- Refactor the actual `TaxSetupClient` path, using Cmx components, `next-intl`, RTL-safe layout and `cmxMessage` feedback.
- Build a focused setup sequence: jurisdiction → registration → price mode → tax stack → preview → activate.
- Support independent percentage taxes and order/item fixed levies, with effective dates and activation/deactivation.
- Present a no-tax configuration safely and block tax-document readiness where registration/rules are incomplete.
- Do not expose advanced-only controls in Basic Mode.

**Acceptance:** a laundry operator can configure VAT plus a municipality levy in one screen and understand the resulting receipt total.

### WP-T4 — Advanced Mode screen

- Add a progressive Advanced section, not a new divergent feature.
- Use Cmx forms/tables/dialogs only; include loading, empty, error, disabled/permission, confirmation and dirty-state behavior.
- Manage scope, profile versions, rule precedence, exemption certificates and tax periods.
- Supply a rule-explanation preview with no money mutation on toggles or dialog close.

**Acceptance:** advanced configuration can express a valid legal rule and explains why an example order is or is not taxed.

### WP-T5 — Mutation and integrity hardening

- Make default-profile selection a single transaction: verify candidate is active/effective/eligible, clear the matching scope only, set the candidate, and enforce uniqueness/concurrency protection.
- Validate rates, fixed amounts, dates, effective-range overlap, treatment/amount compatibility, and tax stack sequence.
- Validate tenant ownership for profile IDs, exemption customer/service references, and uploaded/linked certificate references.
- Soft-deactivate/retire only; never physically delete used configuration.

**Acceptance:** concurrent default changes cannot leave zero or multiple defaults; invalid or cross-tenant IDs never alter records.

### WP-T6 — Engine, snapshot, and document alignment

- Move all tax decisions to one server calculation authority shared by preview and commit.
- Implement Basic and Advanced rule resolution exactly as section 3.3 and the calculation/posting specification, including tax point, timezone, formula, and rounding rules.
- Persist complete calculation snapshots before document issuance; keep existing issued-document correction behavior.
- Ensure finance/tax document totals reconcile separately for TAX versus LEVY/FEE.

**Acceptance:** current configuration changes cannot alter an existing order, receipt, issued document, refund, or credit-note tax outcome.

### WP-T7 — Tenant documentation, translations, and retirement

- Add matching EN/AR namespaces and run i18n parity checks.
- Document Basic versus Advanced behavior, jurisdiction warning text, permissions, and safe upgrade/downgrade rules.
- Retire the duplicate unused tax UI only after feature parity, route/API caller checks, and tests confirm it has no consumer.

## 6. GCC and generic packs

| Pack | Phase-one behavior |
|---|---|
| Saudi Arabia | Verified VAT pack; 15% standard default, configurable legal treatment profiles, tax-document readiness checks; no ZATCA transport. |
| UAE | Verified VAT pack; 5% standard default; no ASP/Peppol transport. |
| Bahrain | Verified VAT pack; 10% standard default. |
| Oman | Verified VAT pack; 5% standard default. |
| Qatar and Kuwait | GCC generic configurable pack, disabled until the tenant configures and accepts a legal-review warning. |
| All other countries | Global generic configurable pack with no claim of statutory compliance. |

Policy packs must be versioned/effective-dated and reviewed against the relevant authority before any production legal-compliance claim. Changes create a new version and never mutate historic order snapshots.

## 7. Test and release plan

### Automated tests

- unit/property vectors: inclusive/exclusive multi-tax formulas, percentage/fixed, item/order basis, treatment, discount base, rounding residuals, effective-date/timezone boundaries, sequencing, and generic-pack guard;
- integration: profile/exemption CRUD, tenant isolation, default uniqueness/concurrency, stale-version rejection, order snapshot, refunds/credits, closed periods, document immutability, and legacy-read compatibility;
- API/action: authentication, each permission boundary, invalid IDs, cross-tenant references, audit events, safe errors;
- UI: Basic and Advanced flows, EN/AR/RTL, preview, empty/error/loading states, no silent money mutation;
- regression: current tax engine tests, payment preview-submit parity, tax-document lifecycle tests, and existing tax-setup E2E coverage.

### Required validation

- targeted tests first; then `cd web-admin && npx eslint . --quiet`, `npm run check:i18n`, `npm run typecheck`, and `npm run build`;
- run build only in a clean branch/worktree expectation because it may update generated inventories;
- perform manual browser smoke tests in EN/AR and at narrow/desktop widths;
- record database migration/backfill verification separately from code tests.

## 8. Non-goals and future work

Not in this plan: external e-invoice submission, authority credentials, provider webhooks, filing/return submission, input-tax recovery, excise/withholding computation, multi-jurisdiction legal entities, or quantity/weight levies. Each needs a separate approved design and release plan.
