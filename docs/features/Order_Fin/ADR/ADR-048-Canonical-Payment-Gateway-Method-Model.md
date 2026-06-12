# ADR-048 — Canonical Payment Gateway Method Model (Legacy Provider Row Cleanup)

**Date:** 2026-06-11  
**Status:** Accepted (canonical model) — integration deferred via [ADR-049](./ADR-049-Online-Payment-Gateway-Integration.md) until provider chosen  
**Project:** CleanMateX  
**Scope:** Payment Config / Checkout / Order Payments / BVM / ERP-lite posting  
**Depends on:** Migration `0267_v1_payment_config_hq.sql`, `0291_payment_config_seed.sql`, [Payment Config Client Guide](../../Payment_Config_Setup/CleanMateX_V1_Payment_Config_Client_Level_Implementation_Guide.md)

---

## Context

CleanMateX V1 payment config introduced a **two-layer gateway model**:

| Layer | Field | Example |
|-------|--------|---------|
| **Method** (how money is classified) | `payment_method_code` | `PAYMENT_GATEWAY` |
| **Provider** (which gateway integration) | `gateway_code` → `sys_payment_gateway_cd.code` | `HYPERPAY`, `PAYTABS`, `STRIPE` |

Before V1, provider names were modeled as **top-level payment method codes** (`HYPERPAY`, `PAYTABS`, `STRIPE`) in `sys_payment_method_cd` and sometimes in tenant `org_payment_methods_cf`.

Migration **0267** already:

- Marked `HYPERPAY` / `PAYTABS` / `STRIPE` rows in `sys_payment_method_cd` as `is_deprecated = true`, `payment_nature = PROVIDER`, `rec_status = 0`
- Set `replacement_code` → `sys_payment_gateway_cd.<PROVIDER>`
- Inserted canonical `PAYMENT_GATEWAY` method row

Migration **0291** seeds tenant checkout rows as **one `org_payment_methods_cf` row per gateway**:

```text
payment_method_code = PAYMENT_GATEWAY
gateway_code        = HYPERPAY | PAYTABS | STRIPE | ...
```

**Runtime today** still tolerates legacy codes via `normalizePaymentMethodCode()` in `web-admin/lib/constants/payment.ts`, which maps `HYPERPAY` / `PAYTABS` / `STRIPE` → `PAYMENT_GATEWAY` at API boundaries. That normalization is **read/submit compatibility**, not a long-term data model.

**Problem:** Residual legacy rows and constants create drift:

- Tenant `org_payment_methods_cf` rows may still exist with `payment_method_code IN ('HYPERPAY','PAYTABS','STRIPE')` and empty `gateway_code` (pre-0291 tenants or manual config).
- TypeScript still exports `PAYMENT_METHODS.HYPERPAY` et al. alongside canonical `PAYMENT_GATEWAY`.
- `PAYMENT_GATEWAYS` in TS uses lowercase slugs (`hyperpay`) while DB `sys_payment_gateway_cd.code` is **UPPER_SNAKE** (`HYPERPAY`) — separate vocabulary; do not conflate.
- Payment Modal V4 treats gateway legs as metadata/manual settlement today; redirect/capture flow is **out of scope** for this ADR (see [BVM Phase 2 plan](../BVM_PHASE_2_ENTRY_PLAN.md)).

Phase 6 of [Payment Settlement plan](../Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) deferred gateway row cleanup pending this ADR.

### Current state (confirmed 2026-06-11)

**No live order payment transactions use `PAYMENT_GATEWAY` yet.** Gateway methods appear in config/catalog and Payment Modal V4 UI, but checkout submit with gateway capture has not produced `org_order_payments_dtl` rows. Cleanup is therefore **config/catalog hygiene only** — not a historical payment backfill exercise.

Implications:

- `org_order_payments_dtl` backfill is **out of scope for v1** (verify count = 0 in pre-flight; skip Step B unless discovery finds rows).
- Risk is limited to duplicate/conflicting **tenant method rows** and **TypeScript/API vocabulary drift**, not reconciliation of posted gateway money.
- First real gateway transaction after cleanup MUST already use the canonical write path — no migration window for payment rows.

---

## Problem Statement

| Gap | Impact |
|-----|--------|
| Duplicate method vocabulary (provider vs `PAYMENT_GATEWAY`) | Checkout-options may surface wrong rows; config UI confusion |
| Legacy tenant rows not migrated to `PAYMENT_GATEWAY + gateway_code` | FK to `sys_payment_gateway_cd` missing; terminal/gateway config split |
| TS constants export deprecated method codes | New code may bypass normalization before first gateway go-live |
| No explicit config cleanup plan | Ad-hoc fixes risk duplicate active tenant method rows |

**Not a current gap:** historical gateway payment reconciliation — **zero `PAYMENT_GATEWAY` / provider-as-method payment rows exist today.**

---

## Considered Options

1. **Keep provider-as-method forever** — normalize only in TypeScript.  
   - Rejected: DB and HQ catalog already deprecated provider rows; dual model never converges.

2. **Hard-delete `sys_payment_method_cd` provider rows** (`DROP` / delete).  
   - Rejected: breaks audit trail; violates [ADR-045](./ADR-045-Legacy-Column-Drop-Strategy.md) (backfill + code first).

3. **Canonical model for config + forward-only payments** — `PAYMENT_GATEWAY` + `gateway_code`; legacy tenant config rows soft-deactivated; TS aliases read-only then removed. **No payment-row backfill** (no gateway transactions yet).  
   - **Selected.**

4. **Merge gateways into `CARD` method** with metadata.  
   - Rejected: conflates terminal card capture with online gateway lifecycle (`PROCESSING` / callback).

---

## Decision

### Canonical contract (write path)

All **new** configuration and **new** order payment rows MUST use:

```text
payment_method_code = 'PAYMENT_GATEWAY'
gateway_code        = <sys_payment_gateway_cd.code>   -- e.g. 'HYPERPAY'
```

Payment legs (`PaymentLeg.method` / `payment_method_code`) follow the same rule. Provider identity lives **only** in `gateway_code` (and optional `gateway_config` JSON on tenant method row).

### Read path (compatibility window)

Until Phase D (below), inbound payloads and historical DB values MAY still contain `HYPERPAY` / `PAYTABS` / `STRIPE` as method codes. All server boundaries MUST continue calling `normalizePaymentMethodCode()` before validation, config lookup, and persistence.

**Do not** add new features that write provider-as-method codes.

### HQ catalog (`sys_*`)

- **Keep** deprecated `sys_payment_method_cd` provider rows (`is_deprecated = true`, `rec_status = 0`) for lineage — **do not delete** in v1 cleanup.
- **Authoritative provider list:** `sys_payment_gateway_cd` only.
- Tenant seeding pattern (0291 Batch B) remains the reference implementation.

### Tenant config (`org_payment_methods_cf`)

- **One active row per** `(tenant_org_id, PAYMENT_GATEWAY, gateway_code)` for each enabled gateway.
- Legacy rows where `payment_method_code IN ('HYPERPAY','PAYTABS','STRIPE')` MUST be migrated or soft-deactivated (see Migration Impact).
- Checkout / `checkout-options` MUST NOT return deprecated provider-as-method rows after cleanup migration.

### Order payments (`org_order_payments_dtl`)

- **New rows (first gateway go-live):** MUST use `payment_method_code = PAYMENT_GATEWAY` and `gateway_code` from day one.
- **Historical rows:** none expected today. Pre-flight query #3 must return **zero rows** for `PAYMENT_GATEWAY` and provider-as-method codes. If non-zero in any environment, treat as exception and run optional backfill — not the default path.

### TypeScript constants

- **Canonical:** `PAYMENT_METHODS.PAYMENT_GATEWAY` + `gateway_code` on legs/config.
- **Legacy aliases:** `LEGACY_PAYMENT_METHOD_ALIASES` in `normalizePaymentMethodCode()` — retain through Phase C; remove direct `PAYMENT_METHODS.HYPERPAY` usage in feature code in Phase D.
- **`PAYMENT_GATEWAYS` lowercase slugs:** document as **integration/env identifiers only**; DB/API use `sys_payment_gateway_cd.code` (UPPER_SNAKE). Future refactor may align or rename to avoid confusion (non-blocking).

### Gateway checkout UX (explicit non-scope)

This ADR does **not** implement Payment Modal V4 redirect, callback routes, or `PROCESSING` → `COMPLETED` automation. Cleanup proceeds independently so config and persisted payments match V1 before gateway capture work ships.

---

## Architecture

```text
sys_payment_gateway_cd (HYPERPAY, PAYTABS, STRIPE, …)
         │
         ▼
org_payment_methods_cf
  payment_method_code = PAYMENT_GATEWAY
  gateway_code        = HYPERPAY
         │
         ▼
checkout-options / Payment Modal V4
  leg.method          = PAYMENT_GATEWAY
  leg.gateway_code    = HYPERPAY
         │
         ▼
org_order_payments_dtl
  payment_method_code = PAYMENT_GATEWAY
  gateway_code        = HYPERPAY
```

**Normalization (legacy inbound):**

```text
HYPERPAY | PAYTABS | STRIPE  ──normalizePaymentMethodCode──►  PAYMENT_GATEWAY
                                              +
                                    gateway_code from alias map or leg field
```

---

## Pre-flight Results (local DB — 2026-06-11)

Recorded by `Approved_By_Jh` discovery run:

| Query | Result | Verdict |
|-------|--------|---------|
| **1** Legacy `sys_payment_method_cd` | `HYPERPAY`, `PAYTABS`, `STRIPE` — all `is_deprecated=true`, `is_active=false`, `rec_status=0` | ✅ Already correct (0267) |
| **2** Legacy `org_payment_methods_cf` | **0 rows** | ✅ No tenant legacy config |
| **3** Provider-as-method `org_order_payments_dtl` | **0 rows** (`HYPERPAY`/`PAYTABS`/`STRIPE`) | ✅ No historical payments |
| **4** Duplicate canonical tenant rows | **0 duplicates** | ✅ No merge needed |
| **5** Canonical gateway config inventory | 2 tenants × 4 gateways (`HYPERPAY`, `MANUAL`, `PAYTABS`, `STRIPE`) — all `PAYMENT_GATEWAY`, active | ✅ Seeded by 0291; see [ADR-049](./ADR-049-Online-Payment-Gateway-Integration.md) for MANUAL semantics |

**Conclusion:** No **data** migration required for v1 cleanup. Config is ready; **zero integration code** exists. Full gateway program: [ADR-049](./ADR-049-Online-Payment-Gateway-Integration.md).

---

## Migration Impact

**DB migration:** **Not required** when pre-flight queries 2–4 return zero (confirmed local 2026-06-11). Skip `{next_seq}_payment_gateway_method_cleanup.sql` unless a future environment shows legacy tenant rows.

If a non-local environment later shows legacy `org_payment_methods_cf` rows, use the steps below in a new migration only for that environment.

**Pre-flight (read-only — record counts in migration header):**

```sql
-- 1. Legacy sys rows (expected: deprecated, inactive)
SELECT payment_method_code, is_deprecated, is_active, rec_status
FROM sys_payment_method_cd
WHERE payment_method_code IN ('HYPERPAY','PAYTABS','STRIPE');

-- 2. Legacy tenant config rows
SELECT tenant_org_id, payment_method_code, gateway_code, is_active, rec_status
FROM org_payment_methods_cf
WHERE payment_method_code IN ('HYPERPAY','PAYTABS','STRIPE');

-- 3. Gateway order payments (expected: 0 rows today)
SELECT payment_method_code, gateway_code, COUNT(*)
FROM org_order_payments_dtl
WHERE payment_method_code IN ('PAYMENT_GATEWAY','HYPERPAY','PAYTABS','STRIPE')
GROUP BY 1, 2;

-- 4. Duplicate canonical rows after merge candidates
SELECT tenant_org_id, gateway_code, COUNT(*)
FROM org_payment_methods_cf
WHERE payment_method_code = 'PAYMENT_GATEWAY'
  AND gateway_code IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

**Migration steps (config-only v1):**

| Step | Action |
|------|--------|
| A | For each legacy `org_payment_methods_cf` row with `payment_method_code = HYPERPAY` (etc.): if no active `PAYMENT_GATEWAY + same gateway_code` exists, **UPDATE** to canonical; else **soft-deactivate** legacy row (`is_active=false`, `rec_status=0`) |
| B | **Skip** `org_order_payments_dtl` backfill when pre-flight query #3 returns zero (expected). Document count in migration header. |
| C | Re-point FKs / branch overrides if any `org_branch_payment_methods_cf` rows reference legacy tenant method ids (discovery required) |
| D | No change to `sys_payment_method_cd` deprecated rows (already correct from 0267) |

**Rules:**

- Never `DROP` provider method codes or tenant rows in v1 — soft-deactivate only ([ADR-045](./ADR-045-Legacy-Column-Drop-Strategy.md)).
- Every `org_*` statement filters by `tenant_org_id` where applicable.
- No `DROP ... CASCADE` without dependency manifest ([database migration rules](../../../CLAUDE.md)).

---

## Code Impact (post-migration)

| Area | Change |
|------|--------|
| `checkout-config.service.ts` / `payment-config.service.ts` | Exclude deprecated provider-as-method tenant rows from checkout lists |
| `payment-modal-v4.tsx` | Gateway legs already use `PAYMENT_GATEWAY` + `gateway_code`; verify no rail entries keyed by `HYPERPAY` method code |
| `lib/constants/payment.ts` | Phase D: deprecate exported `PAYMENT_METHODS.HYPERPAY` et al.; keep normalizer |
| `payment-service.ts` / `erp-lite-posting.ts` | Route via `normalizePaymentMethodCode` + `gateway_code` for clearing account mapping |
| Tests | Extend `payment-config.service.test.ts`, checkout integration tests |

---

## Phased Rollout

| Phase | Deliverable | Blocks |
|-------|-------------|--------|
| **A — ADR approval** | This document + discovery results (✅ recorded) | Phases C–E |
| **B — DB migration** | **Skip** when queries 2–4 = 0 (local confirmed) | — |
| **C — API/UI guardrails** | Checkout-options excludes deprecated provider-as-method if any appear | ADR approval |
| **D — TS cleanup** | Remove new usage of `PAYMENT_METHODS.HYPERPAY` in feature code | Phase C |
| **E — Gateway capture** | **Deferred** — [ADR-049](./ADR-049-Online-Payment-Gateway-Integration.md) parked until provider chosen; no code work | Provider decision |

---

## Testing and Verification

| Layer | Focus |
|-------|--------|
| Discovery | Pre-flight #3 = 0 gateway payment rows; legacy tenant config counts before/after |
| Unit | `normalizePaymentMethodCode` — legacy in, canonical out |
| Service | `payment-config.service` — checkout list has no `HYPERPAY` method rows |
| Integration | Submit order with `PAYMENT_GATEWAY` + `gateway_code=HYPERPAY` when Phase E ships — first payment row must be canonical |
| Manual | Payment settings UI shows one gateway entry per provider under Payment Gateway |

Extend [test_guide.md](../../Order_Payment_Model/test_guide.md) Scenario 14 (Payment Gateway Method) with canonical row expectations.

---

## Rollback Considerations

- Migration is **config UPDATE / soft-deactivate only** — no payment data to restore when pre-flight #3 is zero.
- Re-enable legacy tenant rows only if canonical duplicates were soft-deactivated (document id mapping in migration).
- Code rollback: keep `normalizePaymentMethodCode()` regardless — safe during transition.

---

## Related Documents

- [CleanMateX V1 Payment Config Client Guide](../../Payment_Config_Setup/CleanMateX_V1_Payment_Config_Client_Level_Implementation_Guide.md)
- [overpayment-contract-implementation-tracker.md](../../Order_Payment_Model/overpayment-contract-implementation-tracker.md) — gateway normalization notes
- [Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md](../Payment_Settlement_And_Receipt_Allocation_IMPLEMENTATION_PLAN.md) — Phase 6 placeholder
- [ADR-045 Legacy Column Drop Strategy](./ADR-045-Legacy-Column-Drop-Strategy.md)
- [ADR-046 Payment Method Overpayment Policy](./ADR-046-Payment-Method-Overpayment-Policy.md)
- Migrations: `0267_v1_payment_config_hq.sql`, `0291_payment_config_seed.sql`, `0269_v1_payment_config_client.sql`

---

## Approval

- [ ] `Approved_By_Jh` — canonical model + phased rollout (no DB migration needed on clean envs)
- [x] Discovery query results recorded (local DB 2026-06-11 — see Pre-flight Results)
