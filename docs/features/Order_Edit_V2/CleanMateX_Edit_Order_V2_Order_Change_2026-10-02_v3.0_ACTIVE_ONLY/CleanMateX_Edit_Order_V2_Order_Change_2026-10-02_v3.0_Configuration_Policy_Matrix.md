# CleanMateX Edit Order V2 — Configuration & Policy Matrix

**Version:** 3.0  
**Date:** 2026-10-02  
**Status:** AUTHORITATIVE CONFIGURATION OWNERSHIP FOR V2  
**Applies to:** Edit Order V2 / Order Change

---

## 1. Purpose

Edit Order V2 must be configurable, but configuration must remain owned by the correct CleanMateX domain. The solution must not create one giant Edit policy table or duplicate Pricing, Tax, Finance, Delivery, Workflow, Notification, or RBAC configuration.

The effective policy model is:

```text
HQ Feature / Entitlement
        ↓
Tenant Setting (only Edit-specific behavior)
        ↓
Branch override (only where a real branch-level need exists)
        ↓
Workflow Profile / Commercial Operation Policy
        ↓
Existing domain policy
   Pricing / Discount / Tax / Finance / Delivery / Notification
        ↓
Per-order Edit access state
        ↓
Actor permissions + target facts
        ↓
Effective Change decision
```

The final decision for an operation is never produced by one setting alone.

---

## 2. Configuration ownership rules

1. **HQ / SaaS availability** decides whether the V2 capability is exposed/enabled for the tenant/cohort.
2. **Tenant settings** hold only small Edit-specific business choices that do not naturally belong to another domain.
3. **Workflow profile / operation policy** decides whether a specific commercial operation on a specific target is allowed at the current workflow state and what warning/reason/override requirements apply.
4. **Per-order access fields** block or reopen Edit for one order. They are state, not configuration.
5. **Pricing, Discount, Tax, Finance, Delivery and Notification** keep their own existing policy/configuration. Edit asks those domains; it does not copy their rules.
6. **RBAC** answers who may perform Edit or sensitive overrides.
7. Missing policy/configuration must fail closed where money, tax, identity, or protected workflow state is involved.
8. No Edit-specific setting may silently rewrite historical commercial or settlement facts.
9. Do not build `org_order_change_policy_cf` / `org_order_amendment_policy_cf` for V1 unless the existing settings/profile frameworks are proven insufficient after implementation evidence.
10. Do not add settings that enable V1 features explicitly frozen as disabled/deferred, such as post-commit customer identity reassignment or branch reassignment.

---

## 3. Authoritative Configuration & Policy Matrix

| ID | Policy / behavior | Owner / storage | Level | Proposed / existing code | Allowed values / meaning | Default / V1 decision | Enforcement point | UI effect | Phase |
|---|---|---|---|---|---|---|---|---|---|
| CFG-001 | Edit Order V2 SaaS availability / rollout | Existing HQ feature-flag system (`hq_ff_feature_flags_mst` / current effective-flag machinery) | HQ → tenant/cohort | **NEW flag code; exact code follows current naming**, recommended `order_edit_v2` | OFF / ON or existing entitlement semantics | **OFF during build/pilot; ON only after release gates** | route/access contract + feature entitlement resolver | Hide/disable V2 entry for non-enabled cohorts | WP05, WP19 |
| CFG-002 | Tenant may use Edit V2 | Effective feature/plan entitlement | Tenant | Reuse existing feature/plan evaluation | enabled / disabled | Must not bypass HQ/plan restriction | server route and access contract | entry unavailable when disabled | WP05 |
| CFG-003 | Per-order Edit access | `org_orders_mst.edit_access_status` + block fields | Order state, not config | **NEW fields** | OPEN / TEMPORARILY_BLOCKED / PERMANENTLY_BLOCKED | OPEN unless explicitly blocked after migration policy | Change context, Preview, Apply | show reason / blocked state | WP02–WP05 |
| CFG-004 | Temporary block expiry | `org_orders_mst.edit_block_until` | Order state | **NEW** | timestamp or NULL | expiry triggers re-evaluation; never bypasses workflow/domain policy | capability service | show blocked-until time when present | WP02–WP05 |
| CFG-005 | Base Edit permission | RBAC catalog (`sys_auth_permissions` + current role mappings) | HQ catalog / tenant role | **NEW `orders:edit`** | actor has / does not have permission | deny without permission | context/Preview/Apply | hide/disable Edit action as appropriate | WP05 |
| CFG-006 | Edit override permission | RBAC catalog | HQ catalog / tenant role | **NEW `orders:edit_override`** | actor has / does not have permission | no override without permission | capability proof / Apply | offer override UI only when allowed | WP05 |
| CFG-007 | Price override | Existing Pricing RBAC + Pricing domain | Tenant/user | existing `pricing:override` | domain-defined | reuse existing | Pricing adapter + Apply | reason/override fields only when capability exists | WP08 |
| CFG-008 | Operation allowed at workflow state | Existing workflow profile/policy family (`sys_wf_*` and current semantic profile runtime); exact commercial binding storage to be finalized in WP05 | Workflow profile / status / operation / target | **EXTEND current policy; do not create parallel Edit rules engine** | ALLOW / ALLOW_WITH_WARNING / REQUIRE_OVERRIDE / DENY | missing binding = DENY | Change capability evaluator | enable/disable operation with explanation | WP05 |
| CFG-009 | Operation reason requirement | Same commercial operation policy binding | Workflow profile / op | extend existing `requires_reason` / `min_reason_length` concept | required yes/no + min length | operation-specific | Preview/Apply proof | require reason in Review Changes | WP05 |
| CFG-010 | Warning acknowledgement | Existing workflow gate/decision primitives + Change-bound proof | Workflow profile / facts | reuse/extend | warning acknowledgement required | only current bound proof accepted | Preview/Apply | warning + acknowledgement control | WP05, WP10–WP12 |
| CFG-011 | Hard invariant override | Structural/domain invariant | System rule | **not configurable** | never overrideable | DENY | capability/mutation layer | operation unavailable | WP05–WP12 |
| CFG-012 | New item price policy on committed order | HQ `sys_stng_settings_cd` definition + `org_stng_settings_cf` scoped override via current HQ Settings API; legacy settings tables are not the new-key owner | Tenant; branch only if proven needed | **PROPOSED `order_edit_new_item_price_policy`** | CURRENT_PRICE / ORIGINAL_ORDER_CONTEXT (or final domain-approved tokens) | **TBD before WP08**; do not guess | order-change calculation adapter | explanatory review text if policy changes expected price | WP08 |
| CFG-013 | Changed item repricing policy | same tenant settings framework, only if separate behavior is required | Tenant | **OPTIONAL proposed `order_edit_changed_item_price_policy`** | PRESERVE_COMMITTED / REPRICE_CURRENT / approved alternative | default should preserve unchanged lines; exact changed-line rule TBD before WP08 | calculation adapter | review shows reprice reason/source | WP08 |
| CFG-014 | Existing manual percent discount | Discount domain + frozen Change rule | Domain rule, not general setting in V1 | reuse current discount facts | preserve rate; recalc eligible base | **PRESERVE_RATE** | Discount adapter | display recalculated amount | WP08 |
| CFG-015 | Existing fixed discount | Discount domain + frozen Change rule | Domain rule | reuse current discount facts | preserve amount, cap at eligible base | **PRESERVE_CAPPED** | Discount adapter | warn if cap changes amount | WP08 |
| CFG-016 | Existing accepted promotion | Promotion/Discount domain | Domain rule | reuse persisted promotion facts | do not silently drop accepted entitlement; revalidation only per approved domain policy | **PRESERVE unless invalid by explicit rule** | Discount/Promotion adapter | show any explicit revalidation issue | WP08 |
| CFG-017 | Automatic discount behavior after Change | Tenant setting only if current domain cannot infer correct policy | Tenant | **PROPOSED only if needed: `order_edit_auto_discount_policy`** | PRESERVE_CONTEXT / REEVALUATE_CURRENT / approved tokens | **TBD before WP08** | Discount adapter | preview explains change | WP08 |
| CFG-018 | Tax calculation / pricing mode | Existing Tax configuration and persisted tax facts | Jurisdiction/tenant/order | reuse Tax domain; no Edit-specific tax table | TAX_INCLUSIVE / TAX_EXCLUSIVE + tax profiles/rates | existing legal/domain policy; unresolved historical/current-rate question must be decided before WP08/WP09 | Tax adapter | Review shows authoritative tax delta | WP08–WP09 |
| CFG-019 | Tax configuration failure | Tax domain | system/domain | not tenant Edit setting | configured-zero vs resolution failure | **resolution failure blocks Change; no silent zero** | calculation adapter | explicit error | WP08 |
| CFG-020 | Remaining balance after Change | Existing Finance/payment policy resolver and payment-method configuration | Tenant/order/payment context | reuse existing remaining-balance policy; exact storage remains Finance-owned | Existing Create intent tokens NONE / PAY_ON_COLLECTION / CREDIT_INVOICE; Change follow-up maps Finance policy to OUTSTANDING_OPTIONAL / OUTSTANDING_REQUIRED without rewriting original payment type | existing Finance policy | financial-result service / follow-up | route to optional or required collection | WP09, WP16 |
| CFG-021 | Overpayment resolution options | `sys_fin_overpay_res_cd` + existing Finance resolver/source eligibility | HQ catalog + tenant/source/payment context | reuse | RETURN_CASH_CHANGE / VOID_OR_REFUND_EXCESS / SAVE_AS_* / RESTORE_* / other supported existing codes | only proven source-supported dispositions | Finance Resolution service | show only eligible actions | WP09, WP16 |
| CFG-022 | Gateway refund automation | Existing Refund/Payment Gateway domain | gateway/tenant | reuse; current support may be manual/partial | automatic only where implemented; otherwise manual/pending | **do not imply unsupported automation** | Finance follow-up | supported/manual status | WP16 |
| CFG-023 | Stored-value restoration | Existing Gift Card/Wallet/Stored Value domains | source-specific | reuse; gaps wired in Finance | source-qualified | only when lineage proves restoration eligibility | Finance follow-up | eligible restoration option | WP16 |
| CFG-024 | B2B / AR edit eligibility | Existing B2B/AR/Finance policy | Tenant/contract/document state | reuse | draft/open supported states vs issued/posted unsupported states | unsupported issued states DENY until correction policy implemented | capability + Finance adapter | explain block/correction requirement | WP09 |
| CFG-025 | Fiscal document correction | Fiscal/Tax domain | jurisdiction/document state | reuse correction/credit/debit authority | owner-defined | immutable issued documents | Finance/Fiscal follow-up | show correction status, never silently rewrite | WP09, WP16 |
| CFG-026 | Delivery/fulfilment edit policy | Existing workflow/fulfilment policy and Delivery configuration | Workflow profile / tenant / branch/service | reuse existing order-type/fulfilment policy | domain-defined | no Edit-specific duplicate table | capability + Delivery adapter | available fields/slots based on policy | later scoped Change work |
| CFG-027 | Delivery charge after fulfilment change | Pricing + Delivery domain | domain policy | reuse | calculated from approved zone/service facts | server-authoritative | calculation adapter | preview updated charge | later scoped Change work |
| CFG-028 | Post-commit branch change | V1 architecture | not configurable in V1 | **NO setting in V1** | disabled/deferred | **DENY** | contract/capability | branch read-only | V1 |
| CFG-029 | Post-commit customer identity change | V1 architecture | not configurable in V1 | **NO setting in V1** | disabled | **DENY** | contract/capability | customer identity locked | V1 |
| CFG-030 | Customer snapshot correction | Change operation + capability policy | Workflow/permission | operation-policy driven | allow/warn/override/deny | only approved contact/snapshot fields | capability + schema | editable subset only | WP04–WP05 |
| CFG-031 | Quick Drop post-commit detailing | Workflow/operation capability + order subtype | profile/order facts | reuse Change operation policy | ADD_ITEM/PIECE/PREFERENCE as allowed | supported Quick Drop mode | capability | detailing remains available after commit | WP05–WP07 |
| CFG-032 | Preference definitions/kinds | Existing preference catalogs + `org_order_preferences_dtl` | HQ/tenant existing config | reuse | ORDER / ITEM / PIECE + configured kinds | existing config | preference adapter | dynamic preference UI | WP07 |
| CFG-033 | Notification after Change | Existing Notification templates/preferences/outbox | tenant/user/channel | reuse notification domain | existing channel/template policy | event-driven only | outbox consumer | messages according to preference | WP11+ |
| CFG-034 | Generic approval thresholds | none for V1 | deferred | **DO NOT BUILD V1** | future maker/checker/threshold policy | permission + override only in V1 | n/a | n/a | Deferred |
| CFG-035 | Reason code catalog | optional future lookup | HQ/system | optional `sys_order_change_reason_cd` only if free-text becomes insufficient | configured bilingual reasons | **not required for V1**; free text + op policy acceptable | Review/Apply | optional selector later | Deferred |
| CFG-036 | V2 branch-specific policy override | existing settings framework only if a concrete business need appears | Branch | **do not add by default** | same token as tenant setting | inherit tenant | settings resolver | branch-specific only where explicitly supported | Deferred/As needed |
| CFG-037 | Service speed values | commercial service-speed catalog/domain when implemented | HQ/tenant | separate from priority | STANDARD / EXPRESS; SAME_DAY only when configured | STANDARD unless order facts say otherwise | calculation/capability | speed selector | WP02/WP08 |
| CFG-038 | Priority | existing priority/workflow configuration | tenant/workflow | reuse | current operational priority codes | existing | workflow/queue owner | priority selector | Existing |
| CFG-039 | Edit lock/advisory collaboration lock | current order-lock service | tenant/system | current behavior; configuration only if later proven necessary | lock TTL/force-unlock policy | **do not invent setting now** | UI advisory lock, not OCC authority | collaborator warning | Existing/Deferred |
| CFG-040 | Legacy B12 governed amendment flag | existing legacy feature flag | tenant | `order_fin_governed_amendments` | legacy OFF/ON | **must not be reinterpreted as Edit V2 flag** | legacy compatibility only | no V2 semantics | Cutover |

---

## 4. Edit-specific tenant settings allowed in V1

The V1 goal is deliberately small. The settings framework should not become a policy forest.

### Candidate settings that may genuinely be needed

```text
order_edit_new_item_price_policy
order_edit_changed_item_price_policy     # only if product requires distinct changed-line behavior
order_edit_auto_discount_policy          # only if Discount domain cannot infer it
```

A generic `order_edit_reason_policy` should **not** replace per-operation `requires_reason` policy. At most it may later serve as a tenant default/fallback if the workflow policy framework proves it needs one.

### Do not add in V1

```text
order_edit_allow_customer_change
order_edit_allow_branch_change
order_edit_tax_rate
order_edit_refund_method
order_edit_overpayment_policy
order_edit_payment_policy
order_edit_delivery_policy
order_edit_preference_policy
order_edit_approval_threshold
```

Those either conflict with frozen V1 decisions or duplicate an existing domain owner.

---

## 5. Precedence

For an Edit-specific setting that supports multiple scopes, resolve in this order only where each layer actually exists:

```text
Hard system invariant / legal rule
        ↓
HQ entitlement / feature availability
        ↓
Tenant setting
        ↓
Branch override (only explicitly supported keys)
        ↓
Workflow operation policy
        ↓
Existing domain policy
        ↓
Per-order edit_access_status
        ↓
Actor permission / override permission
        ↓
Current target facts
```

Important: this is not a simple “last value wins” chain. A lower layer may make a rule **more restrictive**, but it may not bypass a hard invariant or a domain/legal prohibition.

Examples:

- Tenant enables Edit V2, but the order is `PERMANENTLY_BLOCKED` → DENY.
- Workflow policy says `REMOVE_ITEM = ALLOW`, but the target piece is already protected by processing history → DENY.
- Tenant price policy says CURRENT_PRICE, but Pricing resolution fails → Change fails; never trust client money.
- Finance policy permits later collection, but the selected payment/source requires immediate resolution by a stricter domain rule → stricter rule wins.

---

## 6. Configuration loading contract

The Change context/Preview/Apply layer should receive a normalized server-owned policy snapshot rather than letting UI components call many configuration endpoints independently.

Conceptual result:

```ts
OrderChangePolicyContext {
  featureEnabled
  editAccess
  permissions
  workflowPolicyBinding
  pricingPolicy
  discountPolicy
  taxPolicy
  financePolicy
  deliveryPolicy
  preferenceCapabilities
  policyFingerprint
}
```

Rules:

- The browser never supplies policy values as authority.
- Preview returns the effective decisions used for review.
- Apply reloads/revalidates current policy/facts.
- If relevant policy/catalog changes after Preview, Apply requires re-review instead of silently changing money or permissions.
- The policy fingerprint is evidence for review consistency, not a substitute for authoritative reload.

---

## 7. UI configuration behavior

The Edit UI should react to server-resolved capabilities, not reimplement policy.

Examples:

```text
ADD_ITEM = ALLOW            -> enabled
REMOVE_ITEM = DENY          -> disabled + reason
CHANGE_SERVICE_SPEED = WARN -> enabled + warning shown in Review
PRICE_OVERRIDE = OVERRIDE   -> override control only for authorized actor
ORDER BLOCKED               -> entire editor read-only/blocked state
```

Do not hard-code workflow status lists in React components.

---

## 8. Implementation impact

### WP02
Add per-order access fields and Change foundation. Do not add a general Edit policy table.

### WP05
This is the main configuration work package:

- seed `orders:edit` and `orders:edit_override`,
- register V2 rollout flag if approved,
- implement commercial operation policy binding over the existing workflow/profile framework,
- define server precedence/effective policy resolver,
- default missing sensitive operation policy to DENY.

### WP08
Resolve and implement the small tenant pricing/discount settings actually needed after current calculation semantics are verified.

### WP09 / WP16
Reuse Finance configuration. Do not duplicate remaining-balance, overpayment, refund, stored-value or fiscal policies in Edit settings.

### WP19
Use the dedicated V2 rollout flag for pilot/default cutover. Never repurpose B12's `order_fin_governed_amendments`.

---

## 9. Frozen configuration invariants

1. No monolithic Edit policy table in V1.
2. No duplicate Pricing/Tax/Finance/Delivery configuration.
3. Workflow operation policy replaces hard-coded editable status arrays as V2 authority.
4. Per-order Edit blocking is order state, not tenant configuration.
5. Missing sensitive operation policy fails closed.
6. `orders:edit` and `orders:edit_override` are separate capabilities.
7. Price override reuses `pricing:override`.
8. Additional-due policy remains Finance-owned.
9. Overpayment disposition remains Finance-owned.
10. Issued fiscal-document behavior remains Fiscal/Tax-owned.
11. Customer identity change is not configurable in V1; it is denied.
12. Branch reassignment is not configurable in V1; it is denied/deferred.
13. Generic maker/checker/amount-threshold approval is deferred.
14. V2 rollout uses its own feature flag, not B12's legacy flag.
15. UI consumes resolved capabilities; it does not calculate policy.
16. Apply revalidates relevant policy and requires re-review on material policy/money drift.


## 10. Required V1 implementation fields

Every effective configuration object returned to EditOrderController must identify **source and effective value**, not value alone, so support can explain behavior:

```text
code
value
effectiveSource = HQ | TENANT | BRANCH | WORKFLOW | ORDER | DOMAIN
sourceRecordId/version where available
isDefaulted
```

A missing required policy must not silently degrade to legacy full replacement.

## 11. Edit-specific setting names

Use `order_edit_*` naming for new V1 settings, not legacy `amendment_*` terminology. Candidate settings must be created only if the current settings framework does not already express the behavior.

The currently justified family is deliberately small:

- `order_edit_new_item_price_policy` — blocked from final seed until the pricing-context owner decision is approved.
- `order_edit_auto_discount_policy` — optional only where Discount cannot infer approved preserve/re-evaluate intent; CFG-014–016 already freeze accepted manual/promotion behavior.
- `order_edit_reason_policy` — deferred global fallback only if operation policy proves insufficient; not a required V1 seed. CFG-009 owns reason requirements.
- optional `order_edit_changed_item_price_policy` only if changed-item and new-item pricing truly need separate business policies.

Do not create branch/customer/overpayment/tax/payment/delivery duplicate knobs when existing domain configuration already owns those rules.


## 12. Current-code reconciliation and configuration loading acceptance (2026-10-02)

The matrix identifies ownership, not proof that proposed codes are deployed. Current Prisma has both legacy `sys_tenant_settings_cd` / `org_tenant_settings_cf` and canonical `sys_stng_settings_cd` / `org_stng_settings_cf` (`web-admin/prisma/schema.prisma:2760`, `:2879`, `:5883`, `:5952`). New Edit settings use the canonical HQ-owned catalog/override API; do not seed a second definition into the legacy tables. `web-admin/app/api/settings/tenants/[tenantId]/effective/route.ts:67` calls `hqApiClient.getEffectiveSettings`; `web-admin/lib/api/hq-api-client.ts:46` preserves source layer, source ID and computed time. Existing source layers include SYSTEM_DEFAULT, SYSTEM_PROFILE, PLAN_CONSTRAINT, FEATURE_FLAG, TENANT_OVERRIDE, BRANCH_OVERRIDE and USER_OVERRIDE. Keep the original source layer in addition to the normalized effectiveSource; do not collapse a plan restriction into a tenant override.

`TenantSettingsService.getAllResolvedSettings` (`web-admin/lib/services/tenant-settings.service.ts:88`) flattens RPC values and returns an empty map on dependency failure (`:103`, `:114`). It cannot by itself prove the required source/default/error contract. The V2 resolver must preserve typed dependency failure versus an absent optional setting, use server-derived tenant/actor and the persisted order branch, validate allowed scopes, and fail closed for required values. Reuse HQ API resolution before entering Apply's transaction; inside the transaction use validated explicit inputs and revalidate the material policy fingerprint. Do not perform HQ HTTP inside the locked transaction or trust browser policy/source values.

The existing flag resolver (`web-admin/lib/services/feature-flags.service.ts:151`) calls HQ effective-flag RPC and has a five-minute cache (`:26`) and default fallback (`:161`). The HQ flag ownership remains valid; the current access transport/cache is implementation evidence, not automatic permission to copy its freshness/fallback behavior into Change Apply. The dedicated V2 flag must default OFF, and Apply must detect revoked entitlement/policy using the agreed freshness contract. Any HQ API-versus-existing-RPC integration choice follows the repository integration contract rather than adding direct catalog queries.

CFG-020 does not claim a deployed generic ALLOW_LATER/REQUIRE_NOW setting. Canonical Create uses NONE / PAY_ON_COLLECTION / CREDIT_INVOICE (`web-admin/lib/validations/new-order-payment-schemas.ts:25`; `order-submit-orchestrator.service.ts:111`). WP09 must freeze the Finance-owned mapping for Change additional receivables; WP16 must qualify general collection independently from the narrower existing collect-payment path. Method eligibility/change/overpayment/drawer behavior already resolves tenant and branch configuration through `payment-config.service.ts:248`, `:483` and `lib/payments/overpayment-policy.ts:35`; reuse that owner and freeze source-qualified resolution eligibility. Do not turn Create intent tokens into a new Edit configuration family.

Currency configuration comes from tenant `org_currency_cf` and `TenantCurrencyProfileService`, not retired TENANT_CURRENCY/TENANT_DECIMAL_PLACES defaults (`tenant-settings.service.ts:22`, `:222`). Branch/user overrides cannot change the tenant currency. Priority/service-speed and original order currency remain domain-owned facts; normalize only using current verified DB tokens.

Current `orders:edit`, `orders:edit_override` and `order_edit_v2` have no implementation in the reviewed order constants/flag catalog; their rows remain proposed WP05 work. Existing `pricing:override` is `ORDERS_PERMISSIONS.PRICING_OVERRIDE` (`web-admin/lib/constants/permissions/orders-perm.ts:41`) and is seeded by migration `0411:183`. New permission/flag/setting registration requires reviewed new migration files and current role mapping; no configuration has been changed by this reconciliation.
