# Submit Order — BVM Wiring Integration (Phase 1B)

**Feature:** Submit Order via Business Voucher Wiring — Phase 1B  
**Reference doc:** `docs/features/Order_Fin/CleanMateX_Final_Refined_Submit_Order_Flow_v1_1.md` *(concept guide — adapted to project conventions, not followed literally)*  
**Status:** Ready for Implementation  
**Created:** 2026-05-22  
**Phase 1A:** Complete ✅

---

## Context

Phase 1A built the BVM wiring handlers and orchestrator (`postAndWireBizVoucher`). The gap: `create-with-payment/route.ts` still direct-writes `org_order_payments_dtl` and `org_order_credit_apps_dtl` inside `settleOrder()`. This violates the non-duplication rule — if voucher wiring ever runs for the same order, both paths write the same fact rows.

Phase 1B closes this gap. The Submit Order route inserts a **voucher creation + posting + wiring** step between its two existing transactions. `settleOrder()` then runs with `wiringMode: true` — skipping the direct writes that wiring already handled.

**Why this ordering matters (Production safety rule §2):**
```
WRONG: settleOrder direct-writes → then voucher wiring runs → duplicate rows
RIGHT: voucher wiring runs → settleOrder(wiringMode: true) → snapshot only
```

---

## What Already Exists (Do Not Rebuild)

| Item | File |
|---|---|
| `postAndWireBizVoucher()` | `lib/services/voucher-wiring.service.ts` |
| `createBizVoucher()` | `lib/services/voucher-biz.service.ts` |
| `addVoucherLine()` — supports all fields needed | `lib/services/voucher-line.service.ts` |
| `settleOrder(wiringMode: true)` guard | `lib/services/order-settlement.service.ts` |
| `PAYMENT_NATURE` constants | `lib/constants/order-financial.ts` |
| `LINE_ROLE.ORDER_PAYMENT` + `ORDER_CREDIT_APPLICATION` | `lib/constants/voucher.ts` |
| `ResolvedSettlementLeg` + `SettlementOption` types | `lib/types/order-financial.ts` |
| `CreateVoucherLineInput` with all payment fields | `lib/types/voucher.ts` |
| `PaymentLeg` type (request schema) | `lib/validations/new-order-payment-schemas.ts` |

**Current create-with-payment route structure (lines to modify at bottom):**
- Line ~399: tx1 — order + invoice + promo + gift card  
- Lines ~229-238: `resolvedLegs: PaymentLeg[]` built from request ← **carry to planner (check fields)**
- Lines ~489-528: Resolve `org_payment_methods_cf` → build `ResolvedSettlementLeg[]`
- Lines ~530-575: Build `breakdown`, `taxLines`, `discountLines`
- Lines ~590-601: `settleOrder()` call ← **INSERT voucher step just before this**
- Lines ~604-619: Update invoice status ← **UNCHANGED, must remain after settleOrder**

---

## DB Migrations — Conditional

All Phase 1A schema exists (0318, 0319). Two conditional migrations may be needed depending on Step 0 findings:
- `0320_bvm_wiring_phase1b_line_type.sql` — only if `LINE_TYPE.CREDIT_APPLICATION` is missing from DB constraint (Step 0b)
- `0321_payment_method_status_config.sql` — only if `org_payment_methods_cf` lacks payment status config columns (Step 0g)

In both cases: write migration file → STOP → wait for user confirmation of successful application before continuing.

---

## New Endpoint and Orchestrator

| Item | Path | Decision |
|---|---|---|
| New endpoint | `app/api/v1/orders/submit-order/route.ts` | Thin route — auth, parse, call orchestrator, return JSON |
| Orchestrator service | `lib/services/order-submit-orchestrator.service.ts` | All business logic lives here |
| Old endpoint | `app/api/v1/orders/_legacy_create-with-payment/route.ts` | **FROZEN** — renamed (Step 5), `@deprecated` annotated, ESLint-barricaded, not served by Next.js |

**Orchestrator pattern:**
- Route is a thin shell: CSRF → auth → parse → call `submitOrder()` → return
- All business logic extracted from `create-with-payment` into `submitOrder()` — nothing left behind
- Old route is renamed to `_legacy_create-with-payment` after all callers are updated (Step 5) — frozen, `@deprecated`-annotated, ESLint-barricaded, not served by Next.js
- ADR documents the canonical path decision; ESLint rule makes reuse a build-time error
- No double maintenance. No accidental fallback. One path to reason about.

---

## Known Design Decisions

### D1. Permissions — no new checks at route level
Flow doc §5 lists `fin_vouchers:create` and `fin_vouchers:post` as required (note: the project uses two-part `resource:action` codes, not the three-part format `finance:vouchers:post` the doc suggests). Decision: keep single `orders:create` gate at the route. The voucher is an internal settlement mechanism triggered by order submission, not a standalone user action. The `fin_vouchers:post` gate on `/api/v1/finance/vouchers/.../post` is for manual voucher management only. **Do not add extra permission checks.**

### D2. `validateVoucherLine` with no userRole
`addVoucherLine` accepts `userRole?: string`. When called programmatically (undefined), `validateVoucherLine` should use the full role set, not restrict to cashier-only line roles. **Verify this in Step 0 by reading `validateVoucherLine`** before writing the planner.

### D3. `changeReturnedAmount` — let the service compute it
`addVoucherLine` auto-computes change for CASH lines (`tendered_amount - amount`). Do NOT pass `changeReturnedAmount` in `CreateVoucherLineInput` — it's an internal field not exposed in the input type. The `RealPaymentLeg.changeReturnedAmount` field is for informational purposes only; it is not mapped to any voucher line field.

### D4. `check*` fields — zip original `PaymentLeg[]` by index
`checkNumber`, `checkBank`, `checkDate` exist on the original `PaymentLeg[]` (from the request) but are dropped when building `ResolvedSettlementLeg[]`. The planner must also accept `originalLegs: PaymentLeg[]` and zip by index to populate check fields on `RealPaymentLeg`.

### D5. `wiringMode: plan.shouldCreateReceiptVoucher` (not hardcoded `true`)
If the order has only deferred legs (PAY_ON_COLLECTION / INVOICE only), `shouldCreateReceiptVoucher = false` and no voucher is created. `settleOrder` runs in legacy direct-write mode. This preserves the existing path for invoice-only orders.

### D6. Stored-value debits stay in `settleOrder`
Wallet, advance, credit-note, and loyalty point redemptions happen in `settleOrder` (not in the voucher step). With `wiringMode: true`, `settleOrder` still debits stored values — it only skips creating the fact rows (which wiring already created). **Known limitation:** If `settleOrder` fails after wiring, the fact row exists but the stored-value balance was not debited. Acceptable for Phase 1B. Phase 2 consolidates stored-value debits into the voucher transaction.

### D7. Gift card via `input.giftCardId` stays in tx1 (no change)
Gift card as `input.giftCardId` reduces `finalTotal` and is debited in tx1. It does NOT appear in `settlementLegs` and does NOT create a voucher line in Phase 1B. This gap is Phase 2 scope.

### D8. Idempotency key derivation
- Voucher creation: `${input.idempotencyKey}_vch`
- Post+wire: `${input.idempotencyKey}_vch_post`
- Each real payment line: `${input.idempotencyKey}_vl_rp_${legIndex}`
- Each credit app line: `${input.idempotencyKey}_vl_ca_${legIndex}`
Use index (not legId UUID) to keep keys deterministic across retries.

### D9. Payment status — dual-table config-driven with hardcoded fallback

**Architecture:** Two-level config hierarchy:
- **`sys_payment_method_cd`** — global system defaults per payment method type (added once for all tenants)
- **`org_payment_methods_cf`** — per-tenant override layer; all new columns are `NULLABLE` — `NULL` = inherit from sys

At query time use `COALESCE(org.column, sys.column)` so tenant overrides win but system defaults are always the safety net.

**Columns added to BOTH tables (sys first, then org inherits):**

| Column | Type | Default | Purpose |
|---|---|---|---|
| `default_creation_status` | TEXT | `'PENDING'` | COMPLETED \| PENDING \| PROCESSING at payment creation |
| `allow_status_override` | BOOLEAN | `FALSE` | User can pass custom `paymentStatus` in request |
| `is_show_in_order_pos` | BOOLEAN | `TRUE` | Show in POS order creation flow |
| `is_allow_from_cmx_mobile_apps` | BOOLEAN | `FALSE` | Allowed from CleanMateX mobile apps |
| `is_allow_for_outside_integration` | BOOLEAN | `FALSE` | Allowed via external API / third-party integration |
| `is_user_id_required` | BOOLEAN | `FALSE` | Require cashier/user identity to be recorded |
| `requires_reference` | BOOLEAN | `FALSE` | Reference number required (bank transfer, check) |
| `requires_cash_drawer` | BOOLEAN | `FALSE` | Open cash drawer session required |

**Seed data in `sys_payment_method_cd`:**

| Method | status | pos | mobile | outside | user_id | reference | drawer |
|---|---|---|---|---|---|---|---|
| CASH | COMPLETED | TRUE | TRUE | TRUE | FALSE | FALSE | TRUE |
| CARD | COMPLETED | TRUE | TRUE | TRUE | FALSE | FALSE | FALSE |
| BANK_TRANSFER | PENDING | TRUE | FALSE | TRUE | FALSE | TRUE | FALSE |
| CHECK | PENDING | TRUE | FALSE | FALSE | TRUE | TRUE | FALSE |
| HYPERPAY / PAYTABS / STRIPE (gatewayCode set) | PROCESSING | FALSE | TRUE | TRUE | FALSE | FALSE | FALSE |

**`org_payment_methods_cf` population:** After adding nullable columns, `UPDATE org_payment_methods_cf o SET ... FROM sys_payment_method_cd s WHERE o.payment_method_code = s.payment_method_code` to inherit initial values.

**Runtime resolution (in planner):** `COALESCE(org.default_creation_status, sys.default_creation_status)` via JOIN in the `org_payment_methods_cf` lookup query already happening in the route. Soft fallback in code: `resolveDefaultStatus(paymentMethodCode, gatewayCode)` for any method not in sys table.

**Why:** Different tenants have different clearing policies. Hardcoded defaults work out of the box. Per-method config in sys + per-tenant override in org = maximum flexibility without code changes.

### D10. Idempotency key — required on `submit-order`
`submit-order` enforces `idempotencyKey` as required (Zod `.min(1)`) and rejects same-key + different-payload with `IDEMPOTENCY_CONFLICT` (409). No backward compat concern — `create-with-payment` is frozen and not served; no active callers remain after Step 6.

### D11. Idempotency ownership — route only, not orchestrator
The route owns the full idempotency lifecycle: check before calling orchestrator → call orchestrator → store result. The orchestrator is idempotency-unaware — it executes order logic and returns a result. This means: (a) the `idempotency key store` that was inside tx1 in `create-with-payment` is removed from the orchestrator's tx1, (b) the route checks idempotency BEFORE calling `submitOrder()`, and (c) the route stores the `SubmitOrderResult` after a successful call. Sub-idempotency keys (`_vch`, `_vch_post`, `_vl_rp_N`, `_vl_ca_N`) remain in the orchestrator at the service level for voucher-specific retry safety — those are separate from the route-level idempotency.

---

## Implementation Steps

---

### STEP 0 — Pre-Implementation Verifications (Read-Only)

Run these checks before writing any code. If any check fails, resolve first.

**0a. Verify `VOUCHER_TYPE.RECEIPT_VOUCHER` constant:**
Read `web-admin/lib/constants/voucher.ts` and confirm the exact string value for receipt voucher type. The DB-mirror rule requires the constant value matches exactly what the DB constraint allows. If `'RECEIPT_VOUCHER'` is correct, proceed. If different, use the exact DB value in all code below.

**0b. Verify `LINE_TYPE` constants include `'RECEIPT'` and `'CREDIT_APPLICATION'`:**
Read `web-admin/lib/constants/voucher.ts` `LINE_TYPE` object. Confirm both `'RECEIPT'` and `'CREDIT_APPLICATION'` are valid values. If `'CREDIT_APPLICATION'` is missing:
1. Add it to `LINE_TYPE` constant in `lib/constants/voucher.ts`
2. Check the DB constraint: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'org_fin_voucher_trx_lines_dtl'::regclass AND conname LIKE '%line_type%';`
3. If the DB constraint also needs updating, write migration `0320_bvm_wiring_phase1b_line_type.sql` (same DROP+ADD pattern as 0318 for `chk_vch_trx_ln_role`). STOP and wait for confirmation before continuing.

**0c. Verify `validateVoucherLine` with undefined userRole:**
Read `web-admin/lib/services/voucher-validation.service.ts` — specifically `validateVoucherLine()`. Confirm it does NOT throw when `userRole` is `undefined`. If it restricts `ORDER_CREDIT_APPLICATION` to cashier-only and rejects undefined, the fix is to pass `'branch_manager'` as the role for programmatic calls (or add a `'system'` bypass).

**0d. Confirm `PaymentLeg` has `checkNumber`, `checkBank`, `checkDate`:**
Read `web-admin/lib/validations/new-order-payment-schemas.ts` to confirm `PaymentLeg` type fields. Needed for Step 1 planner signature.

**0e. Check `gateway_transaction_id` on voucher lines:**
Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'org_fin_voucher_trx_lines_dtl' AND column_name LIKE '%gateway%';`
If only `gateway_code` and `gateway_reference` exist, `gateway_transaction_id` from the flow doc maps to `gateway_reference` — no new column needed, document the mapping. If it exists as a separate column, add it to `CreateVoucherLineInput` and `RealPaymentLeg`.

**0f. Credit application type constraint — VALUES CONFIRMED BY USER:**
Constraint `chk_org_order_credit_apps_type` on `org_order_credit_apps_dtl`:
```sql
CHECK (credit_type IN ('GIFT_CARD','WALLET','CUSTOMER_CREDIT','LOYALTY_CREDIT','CUSTOMER_ADVANCE'))
```
Update `CREDIT_APPLICATION_TYPES` constant in `lib/constants/order-financial.ts` to exactly:
```typescript
export const CREDIT_APPLICATION_TYPES = {
  GIFT_CARD:        'GIFT_CARD',
  WALLET:           'WALLET',
  CUSTOMER_CREDIT:  'CUSTOMER_CREDIT',
  LOYALTY_CREDIT:   'LOYALTY_CREDIT',    // NOT LOYALTY_POINTS or LOYALTY_VALUE
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',  // NOT ADVANCE or CREDIT_NOTE
} as const;
```
No migration needed for this constraint — values already exist. `CREDIT_NOTE` and `LOYALTY_POINTS` from old code/docs are WRONG — use exact DB values above.

**0g. Check both tables for payment method config columns (D9 dual-table architecture):**
Run:
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('sys_payment_method_cd','org_payment_methods_cf')
  AND column_name IN ('default_creation_status','allow_status_override','is_show_in_order_pos',
                      'is_allow_from_cmx_mobile_apps','is_allow_for_outside_integration',
                      'is_user_id_required','requires_reference','requires_cash_drawer')
ORDER BY table_name, column_name;
```
- If all columns exist on both tables: verify seed data is present, proceed to Step 1.
- If missing: write migration `0321_payment_method_config_enrichment.sql`:

```sql
-- 1. Add columns to sys_payment_method_cd (global defaults, NOT NULL with sensible defaults)
ALTER TABLE sys_payment_method_cd
  ADD COLUMN IF NOT EXISTS default_creation_status          TEXT    NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS allow_status_override            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_show_in_order_pos             BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_allow_from_cmx_mobile_apps    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_allow_for_outside_integration  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_user_id_required               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_reference                BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_cash_drawer              BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Seed sys_payment_method_cd with known defaults per method
UPDATE sys_payment_method_cd SET
  default_creation_status = 'COMPLETED', is_show_in_order_pos = TRUE,
  is_allow_from_cmx_mobile_apps = TRUE,  is_allow_for_outside_integration = TRUE,
  requires_cash_drawer = TRUE
WHERE payment_method_code = 'CASH';

UPDATE sys_payment_method_cd SET
  default_creation_status = 'COMPLETED', is_show_in_order_pos = TRUE,
  is_allow_from_cmx_mobile_apps = TRUE,  is_allow_for_outside_integration = TRUE
WHERE payment_method_code = 'CARD';

UPDATE sys_payment_method_cd SET
  default_creation_status = 'PENDING', is_show_in_order_pos = TRUE,
  is_allow_for_outside_integration = TRUE, requires_reference = TRUE
WHERE payment_method_code = 'BANK_TRANSFER';

UPDATE sys_payment_method_cd SET
  default_creation_status = 'PENDING', is_show_in_order_pos = TRUE,
  is_user_id_required = TRUE, requires_reference = TRUE
WHERE payment_method_code = 'CHECK';

-- Gateway methods (HYPERPAY, PAYTABS, STRIPE, etc. — all with gateway_code set)
UPDATE sys_payment_method_cd SET
  default_creation_status = 'PROCESSING', is_show_in_order_pos = FALSE,
  is_allow_from_cmx_mobile_apps = TRUE, is_allow_for_outside_integration = TRUE
WHERE gateway_code IS NOT NULL;

-- 3. Add same columns to org_payment_methods_cf (NULLABLE = tenant override; NULL = inherit from sys)
ALTER TABLE org_payment_methods_cf
  ADD COLUMN IF NOT EXISTS default_creation_status          TEXT,
  ADD COLUMN IF NOT EXISTS allow_status_override            BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_show_in_order_pos             BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_allow_from_cmx_mobile_apps    BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_allow_for_outside_integration  BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_user_id_required               BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_reference                BOOLEAN,
  ADD COLUMN IF NOT EXISTS requires_cash_drawer              BOOLEAN;

-- 4. Populate org_payment_methods_cf from sys defaults (initial seed — tenants can override after)
UPDATE org_payment_methods_cf o
SET
  default_creation_status          = s.default_creation_status,
  allow_status_override            = s.allow_status_override,
  is_show_in_order_pos             = s.is_show_in_order_pos,
  is_allow_from_cmx_mobile_apps    = s.is_allow_from_cmx_mobile_apps,
  is_allow_for_outside_integration  = s.is_allow_for_outside_integration,
  is_user_id_required               = s.is_user_id_required,
  requires_reference                = s.requires_reference,
  requires_cash_drawer              = s.requires_cash_drawer
FROM sys_payment_method_cd s
WHERE o.payment_method_code = s.payment_method_code;
```
STOP and wait for confirmation of successful application before continuing.

**At query time:** The `org_payment_methods_cf` lookup in the route must JOIN `sys_payment_method_cd` and use `COALESCE(o.column, s.column)` to resolve effective values. This ensures tenant overrides win, system defaults are the fallback, and no NULL leaks into the planner.

**0h. Update Prisma schema + regenerate client (Gap C fix):**
After migration 0321 is applied, update `web-admin/prisma/schema.prisma` for both `sys_payment_method_cd` and `org_payment_methods_cf` models to add the 8 new columns (Gap C). Run `npx prisma generate` to regenerate the client. This must happen BEFORE writing the orchestrator code that references these fields via Prisma.

**Progress:** `[ ]`  
**→ After completing:** Check all Step 0 sub-items in the plan checklist. If migration 0320 or 0321 was applied, note it in `IMPLEMENTATION_STATUS.md`.

---

### STEP 1 — New Types: `lib/types/settlement-plan.ts`

**New file.** Defines the structured output of the settlement planner.

```typescript
import type { PaymentLeg } from '../validations/new-order-payment-schemas';

export interface RealPaymentLeg {
  legIndex: number;                 // original index in resolvedLegs array (for idempotency keys)
  paymentMethodCode: string;
  orgPaymentMethodId: string;       // FK to org_payment_methods_cf.id
  amount: number;
  currencyCode: string;
  cashDrawerSessionId?: string;     // set when option.requiresCashDrawer && session provided
  tenderedAmount?: number;          // for CASH
  // Note: changeReturnedAmount is auto-computed by addVoucherLine — do NOT map to line input
  cardBrandCode?: string;
  cardLast4?: string;
  gatewayCode?: string;
  gatewayReference?: string;        // maps to gateway_transaction_id from flow doc (verified Step 0e)
  bankReference?: string;
  checkNumber?: string;             // from original PaymentLeg (not in ResolvedSettlementLeg)
  checkBank?: string;
  checkDate?: string;
  terminalId?: string;
  // Payment status config (from org_payment_methods_cf — D9)
  defaultCreationStatus: string;    // COMPLETED | PENDING | PROCESSING — from DB config
  allowStatusOverride: boolean;     // if true and request provides paymentStatus, use override
  resolvedPaymentStatus: string;    // final resolved status for this leg (passed to wiring handler)
}

export interface CreditApplicationLeg {
  legIndex: number;
  // Exact DB values (chk_org_order_credit_apps_type): GIFT_CARD | WALLET | CUSTOMER_CREDIT | LOYALTY_CREDIT | CUSTOMER_ADVANCE
  creditType: string;
  amount: number;
  currencyCode: string;
  creditReferenceId?: string;
}

export interface SettlementPlan {
  orderId: string;
  totalAmount: number;
  realPaymentLegs: RealPaymentLeg[];
  creditApplicationLegs: CreditApplicationLeg[];
  realPaymentAmount: number;
  creditAppliedAmount: number;
  immediateSettlementAmount: number;
  outstandingAmount: number;
  // PAY_ON_DELIVERY removed — planner never assigns it; keep only values the planner actually sets
  outstandingPolicy: 'NONE' | 'PAY_ON_COLLECTION' | 'CREDIT_INVOICE';
  shouldCreateReceiptVoucher: boolean;
  shouldCreateArInvoice: boolean;
}
```

---

#### Step 1b — Update `lib/types/order-financial.ts`: Add D9 config fields to `SettlementOption`

**Gap A fix.** The planner reads `option.default_creation_status`, `option.allow_status_override`, `option.requiresCashDrawer`, `option.requiresReference` from `SettlementOption`. These come from the new D9 config columns. Add them to the type so the planner compiles:

```typescript
// In SettlementOption (inside lib/types/order-financial.ts):
export interface SettlementOption {
  // ... existing fields ...
  // D9 config fields — resolved via COALESCE(org.column, sys.column) at query time
  default_creation_status: string;   // COMPLETED | PENDING | PROCESSING
  allow_status_override: boolean;
  requires_cash_drawer: boolean;
  requires_reference: boolean;
  is_user_id_required: boolean;
}
```

Also confirm `cardBrandCode` and `cardLast4` source: these come from `PaymentLeg` (request body) — confirm they exist on `PaymentLeg` in Step 0d. If present, add them to the planner loop mapping alongside check fields (Gap G fix):

```typescript
// Inside planner loop, for real payment legs:
cardBrandCode: orig?.cardBrandCode ?? undefined,
cardLast4:     orig?.cardLast4     ?? undefined,
```

---

#### Step 1c — Create `submitOrderRequestSchema` in `lib/validations/new-order-payment-schemas.ts`

**Gap D fix.** The route (Step 4) references `submitOrderRequestSchema`. Define it by extending the existing request schema:

```typescript
// Append to lib/validations/new-order-payment-schemas.ts
export const submitOrderRequestSchema = createWithPaymentRequestSchema.extend({
  idempotencyKey: z.string().min(1, 'idempotencyKey is required on submit-order'),
});
export type SubmitOrderRequest = z.infer<typeof submitOrderRequestSchema>;
```

Also update `SubmitOrderParams.input` in Step 3 to use `SubmitOrderRequest` instead of `CreateWithPaymentRequest`.

---

**Progress:** `[ ]`  
**→ After completing:** Mark Step 1 (all sub-items 1a, 1b, 1b-card, 1c) done in plan checklist.

---

### STEP 2 — New Service: `lib/services/order-settlement-planner.service.ts`

**New file.** Pure classification function — no DB writes, no side effects. Accepts both leg arrays so check fields can be zipped from the original request legs.

```typescript
import 'server-only';
import { PAYMENT_NATURE, CREDIT_APPLICATION_TYPES } from '../constants/order-financial';
import type { ResolvedSettlementLeg } from '../types/order-financial';
import type { PaymentLeg } from '../validations/new-order-payment-schemas';
import type { SettlementPlan, RealPaymentLeg, CreditApplicationLeg } from '../types/settlement-plan';

const TOLERANCE = 0.001;

/**
 * Classifies resolved settlement legs into real-payment and credit-application buckets.
 * Pure function — no DB access.
 *
 * @param resolvedLegs DB-resolved legs (from org_payment_methods_cf lookup)
 * @param originalLegs Raw request legs — used to recover check fields lost during DB resolution
 */
export function buildSettlementPlan(
  orderId: string,
  totalAmount: number,
  currencyCode: string,
  resolvedLegs: ResolvedSettlementLeg[],
  originalLegs: PaymentLeg[],       // zipped by index with resolvedLegs
  paymentTypeCode: string,
  cashDrawerSessionId?: string
): SettlementPlan {
  const realPaymentLegs: RealPaymentLeg[] = [];
  const creditApplicationLegs: CreditApplicationLeg[] = [];

  for (let i = 0; i < resolvedLegs.length; i++) {
    const leg = resolvedLegs[i];
    const orig = originalLegs[i]; // guaranteed same index — both built from the same resolvedLegs array
    const { settlementOption: option, amount } = leg;

    if (option.paymentNature === PAYMENT_NATURE.REAL_PAYMENT) {
      const defaultCreationStatus = option.default_creation_status ?? resolveDefaultStatus(option.paymentMethodCode, option.gatewayCode);
      const allowStatusOverride   = option.allow_status_override ?? false;
      const resolvedPaymentStatus = allowStatusOverride && orig?.paymentStatus
        ? orig.paymentStatus
        : defaultCreationStatus;

      realPaymentLegs.push({
        legIndex:               i,
        paymentMethodCode:      option.paymentMethodCode,
        orgPaymentMethodId:     option.id,
        amount,
        currencyCode,
        cashDrawerSessionId:    option.requiresCashDrawer ? cashDrawerSessionId : undefined,
        tenderedAmount:         leg.cashTendered,
        // changeReturnedAmount intentionally omitted — auto-derived by addVoucherLine
        gatewayCode:            option.gatewayCode ?? undefined,
        gatewayReference:       leg.reference ?? undefined,
        terminalId:             leg.terminalId ?? undefined,
        checkNumber:            orig?.checkNumber ?? undefined,
        checkBank:              orig?.checkBank ?? undefined,
        checkDate:              orig?.checkDate ?? undefined,
        isCompleted:            resolvedPaymentStatus === 'COMPLETED',
        defaultCreationStatus,
        allowStatusOverride,
        resolvedPaymentStatus,
      });
      continue;
    }

    if (option.paymentNature === PAYMENT_NATURE.CREDIT_APPLICATION) {
      creditApplicationLegs.push({
        legIndex:          i,
        // creditApplicationType on option must be one of: GIFT_CARD | WALLET | CUSTOMER_CREDIT | LOYALTY_CREDIT | CUSTOMER_ADVANCE
        creditType:        option.creditApplicationType ?? CREDIT_APPLICATION_TYPES.WALLET,
        amount,
        currencyCode,
        creditReferenceId: leg.creditReferenceId ?? undefined,
      });
    }
    // DEFERRED_SETTLEMENT / AR_ALLOCATION / INTERNAL_ADJUSTMENT → outstanding; no voucher line
  }

  const realPaymentAmount         = realPaymentLegs.reduce((s, l) => s + l.amount, 0);
  const creditAppliedAmount       = creditApplicationLegs.reduce((s, l) => s + l.amount, 0);
  const immediateSettlementAmount = realPaymentAmount + creditAppliedAmount;
  const outstandingAmount         = Math.max(0, totalAmount - immediateSettlementAmount);

  let outstandingPolicy: SettlementPlan['outstandingPolicy'] = 'NONE';
  if (outstandingAmount > TOLERANCE) {
    if (paymentTypeCode === 'INVOICE' || paymentTypeCode === 'CREDIT_INVOICE') {
      outstandingPolicy = 'CREDIT_INVOICE';
    } else {
      outstandingPolicy = 'PAY_ON_COLLECTION';
    }
  }

  return {
    orderId,
    totalAmount,
    realPaymentLegs,
    creditApplicationLegs,
    realPaymentAmount,
    creditAppliedAmount,
    immediateSettlementAmount,
    outstandingAmount,
    outstandingPolicy,
    shouldCreateReceiptVoucher: realPaymentLegs.length > 0 || creditApplicationLegs.length > 0,
    shouldCreateArInvoice:      outstandingPolicy === 'CREDIT_INVOICE',
  };
}
```

#### Fallback status resolver (inside planner service, not exported)

```typescript
function resolveDefaultStatus(paymentMethodCode: string, gatewayCode?: string | null): string {
  if (gatewayCode) return 'PROCESSING';
  if (paymentMethodCode === 'CASH' || paymentMethodCode === 'CARD') return 'COMPLETED';
  return 'PENDING'; // BANK_TRANSFER, CHECK, and any unknown method
}
```

#### `validateSettlementPlan` — async, DB-touching, runs BEFORE voucher creation

```typescript
export async function validateSettlementPlan(
  plan: SettlementPlan,
  tenantOrgId: string
): Promise<void> {
  return withTenantContext(tenantOrgId, async () => {
    for (const leg of plan.realPaymentLegs) {
      // Cash drawer must be open for CASH legs
      if (leg.cashDrawerSessionId) {
        const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
          where:  { id: leg.cashDrawerSessionId, tenant_org_id: tenantOrgId },
          select: { session_status: true },
        });
        if (!session) throw new Error('CASH_DRAWER_SESSION_REQUIRED');
        if (session.session_status !== 'OPEN') throw new Error('CASH_DRAWER_SESSION_CLOSED');
      }
      // Cash tendered >= leg amount
      if (leg.paymentMethodCode === 'CASH' && leg.tenderedAmount !== undefined) {
        if (leg.tenderedAmount < leg.amount) throw new Error('CASH_TENDERED_LESS_THAN_AMOUNT');
      }
      // Gateway must be configured if gatewayCode present
      if (leg.gatewayCode) {
        const gwConfig = await prisma.org_payment_gateway_cf.findFirst({
          where: { tenant_org_id: tenantOrgId, gateway_code: leg.gatewayCode, is_active: true },
          select: { id: true },
        });
        if (!gwConfig) throw new Error('GATEWAY_NOT_CONFIGURED');
      }
      // Reference required for BANK_TRANSFER / CHECK (Gap E fix)
      if (leg.requiresReference && !leg.gatewayReference && !leg.checkNumber && !leg.bankReference) {
        throw new Error('PAYMENT_REFERENCE_REQUIRED');
      }
      // User identity required (CHECK with is_user_id_required) — userId already captured from auth
      // No throw needed here — userId comes from auth token, always present; log if missing
    }
    // Credit balances are validated inside settleOrder (stored-value debits) — Phase 2 will move them here
  });
}
```

**Note:** Credit balance validation stays in `settleOrder` for Phase 1B (D6 limitation). Infrastructure checks here (drawer open, tendered amount, gateway config, reference required) are the pre-wiring guards — these are the ones that would leave orphaned DRAFT vouchers if they failed after voucher creation.

Add `requiresReference` to `RealPaymentLeg` type (Step 1b): pulled from `option.requires_reference` in the planner loop alongside other config fields.

**Progress:** `[ ]`  
**→ After completing:** Mark Step 2 (2a, 2b) done in plan checklist.

---

### STEP 3 — Create `lib/services/order-submit-orchestrator.service.ts`

**New file.** Extract all business logic from `create-with-payment/route.ts` into a single callable function. Both the new and old routes will call this.

#### Orchestrator function signature

```typescript
import 'server-only';
import type { CreateWithPaymentRequest } from '@/lib/validations/new-order-payment-schemas';
import type { RequestAuditContext } from '@/lib/utils/request-audit';

export interface SubmitOrderParams {
  tenantId:     string;
  userId:       string;
  userName:     string;
  branchId?:    string;        // resolved from request before calling orchestrator
  input:        CreateWithPaymentRequest;
  requestAudit: RequestAuditContext;
}

export interface SubmitOrderResult {
  order: {
    id:                       string;
    orderNo:                  string;
    currentStatus:            string;
    totalAmount:              string;
    totalPaidAmount:          string;
    totalCreditAppliedAmount: string;
    outstandingAmount:        string;
    paymentStatus:            string;
    paymentTypeCode:          string;
  };
  voucher?: {
    id:           string;
    voucherNo:    string;
    status:       string;
    wiringStatus: 'WIRED' | 'PARTIALLY_WIRED';
  };
  effects: {
    orderPayments:       Array<{ id: string; amount: unknown; paymentMethodCode: string; paymentStatus: string }>;
    creditApplications:  Array<{ id: string; amount: unknown; creditType: string }>;
    cashMovements:       Array<{ id: string; amount: unknown; sessionId: string | null }>;
  };
  warnings: string[];   // e.g. 'BANK_TRANSFER_PENDING_CONFIRMATION', 'GATEWAY_PAYMENT_PROCESSING'
}

export async function submitOrder(params: SubmitOrderParams): Promise<SubmitOrderResult>
```

#### What moves into the orchestrator (extracted from `create-with-payment/route.ts`)

All logic after branch resolution and before the final `return NextResponse.json(...)`:

1. `calculateOrderTotals()` — server-side totals
2. `buildDifferences()` — amount mismatch check
3. Leg resolution (DEFERRED_METHODS, `isInvoiceOnly`, `amountToCharge` validation)
4. Check leg validation
5. tx1 — `prisma.$transaction`: `createOrderInTransaction`, `createInvoice`, `applyPromoCodeTx`, `redeemGiftCardTx`
   - **Idempotency ownership (Gap I fix):** idempotency key is checked and stored in the ROUTE (Step 4), NOT in tx1. Remove the idempotency key store from tx1 in the orchestrator — the route owns full idempotency lifecycle (check → call orchestrator → store result). The orchestrator is idempotency-unaware; it just executes the order logic.
6. `org_payment_methods_cf` lookup → `settlementLegs: ResolvedSettlementLeg[]`
   - **Gap B fix — JOIN `sys_payment_method_cd` for effective config values:** The existing raw query returns only `org_payment_methods_cf` columns. Update to JOIN `sys_payment_method_cd` on `payment_method_code` and COALESCE all D9 config columns:
   ```sql
   SELECT
     o.*,
     COALESCE(o.default_creation_status,    s.default_creation_status)    AS effective_creation_status,
     COALESCE(o.allow_status_override,      s.allow_status_override)      AS effective_allow_override,
     COALESCE(o.requires_cash_drawer,       s.requires_cash_drawer)       AS effective_requires_drawer,
     COALESCE(o.requires_reference,         s.requires_reference)         AS effective_requires_reference,
     COALESCE(o.is_user_id_required,        s.is_user_id_required)        AS effective_user_id_required
   FROM org_payment_methods_cf o
   JOIN sys_payment_method_cd s ON s.payment_method_code = o.payment_method_code
   WHERE o.tenant_org_id = :tenantId
     AND o.id = ANY(:legIds)
   ```
   Map effective values into `SettlementOption.default_creation_status`, `.allow_status_override`, `.requires_cash_drawer`, `.requires_reference`, `.is_user_id_required` — these are the fields added in Step 1b.
7. `breakdown`, `taxLines`, `financialDiscountLines` build
8. **NEW:** `buildSettlementPlan()` — classify legs, resolve payment statuses via D9 config
9. **NEW:** `validateSettlementPlan()` — verify balances, drawer state, gateway config, reference required BEFORE voucher creation
10. **NEW:** voucher create + lines + `postAndWireBizVoucher()` (only if `plan.shouldCreateReceiptVoucher`)
11. `settleOrder({ wiringMode: plan.shouldCreateReceiptVoucher })`
12. Invoice status update
13. Read final `org_orders_mst` snapshot for response `order.*` fields
14. Returns `SubmitOrderResult` (not `NextResponse` — the route wraps this)

The orchestrator returns `SubmitOrderResult`. Error handling (try/catch) moves in — throws typed errors the route catches and maps to HTTP responses. Error codes: `AMOUNT_MISMATCH`, `PRODUCT_NOT_FOUND`, `CASH_DRAWER_SESSION_REQUIRED`, `CASH_DRAWER_SESSION_CLOSED`, `CASH_TENDERED_LESS_THAN_AMOUNT`, `GATEWAY_NOT_CONFIGURED`, `PAYMENT_REFERENCE_REQUIRED`.

#### `resolveOrderBranch` helper (Gap — extract explicitly)

Extract `resolveOrderBranch(tenantId: string, branchId?: string): Promise<string | undefined>` from `create-with-payment` lines 148–166 into a named helper in the orchestrator file (not inline in the route). Both the route and any future callers use this helper.

```typescript
// Inside order-submit-orchestrator.service.ts — exported so route can call before delegating
export async function resolveOrderBranch(tenantId: string, branchId?: string): Promise<string | undefined> {
  // ... branch lookup logic from lines 148–166
}
```

#### Imports needed in orchestrator

```typescript
import { createBizVoucher } from '@/lib/services/voucher-biz.service';
import { addVoucherLine } from '@/lib/services/voucher-line.service';
import { postAndWireBizVoucher, getVoucherLinkedEffects } from '@/lib/services/voucher-wiring.service';
import { buildSettlementPlan, validateSettlementPlan } from '@/lib/services/order-settlement-planner.service';
import { LINE_ROLE, VOUCHER_TYPE } from '@/lib/constants/voucher';
import type { PostAndWireResult } from '@/lib/types/voucher-wiring';
// ... all existing imports from create-with-payment/route.ts
```

#### Voucher step inside orchestrator (insert between steps 7 and 9 above)

```typescript
// ── Settlement Plan ──────────────────────────────────────────────────────────
const plan = buildSettlementPlan(
  result.orderId,
  serverTotals.finalTotal,
  serverTotals.currencyCode,
  settlementLegs,    // ResolvedSettlementLeg[] — payment nature + amounts + payment method config
  resolvedLegs,      // PaymentLeg[] — check fields (zip by index)
  getPaymentTypeFromMethod(input.paymentMethod),
  input.cashDrawerSessionId ?? undefined
);

// ── Validate settlement plan BEFORE creating any DB rows (D9 — fail-fast, no orphaned vouchers)
await validateSettlementPlan(plan, tenantId);
// throws typed errors: CREDIT_BALANCE_INSUFFICIENT | CASH_TENDERED_LESS_THAN_AMOUNT |
//                      CASH_DRAWER_SESSION_CLOSED | CASH_DRAWER_SESSION_REQUIRED |
//                      GATEWAY_NOT_CONFIGURED | PAYMENT_REFERENCE_REQUIRED

const warnings: string[] = [];
// Collect PENDING/PROCESSING legs as warnings for client awareness
for (const leg of plan.realPaymentLegs) {
  if (leg.resolvedPaymentStatus === 'PENDING') warnings.push(`${leg.paymentMethodCode}_PENDING_CONFIRMATION`);
  if (leg.resolvedPaymentStatus === 'PROCESSING') warnings.push(`GATEWAY_PAYMENT_PROCESSING`);
}

let voucherPostResult: PostAndWireResult | null = null;

if (plan.shouldCreateReceiptVoucher) {
  const voucher = await withTenantContext(tenantId, () =>
    createBizVoucher(tenantId, {
      voucher_type:    VOUCHER_TYPE.RECEIPT_VOUCHER,  // verified in Step 0a
      direction:       'IN',
      party_type:      'CUSTOMER',
      customer_id:     input.customerId ?? undefined,
      source_module:   'ORDERS',
      source_ref_type: 'ORDER',
      source_ref_id:   result.orderId,
      currency_code:   serverTotals.currencyCode,
      total_amount:    plan.immediateSettlementAmount,
      branch_id:       branchId,
      idempotency_key: input.idempotencyKey ? `${input.idempotencyKey}_vch` : undefined,
    }, userId)
  );

  for (const leg of plan.realPaymentLegs) {
    await withTenantContext(tenantId, () =>
      addVoucherLine(tenantId, voucher.id, {
        line_type:              'RECEIPT',
        line_role:              LINE_ROLE.ORDER_PAYMENT,
        direction:              'IN',
        target_type:            'ORDER',
        order_id:               result.orderId,
        customer_id:            input.customerId ?? undefined,
        branch_id:              branchId,
        payment_method_code:    leg.paymentMethodCode,
        org_payment_method_id:  leg.orgPaymentMethodId,
        amount:                 leg.amount,
        currency_code:          leg.currencyCode,
        cash_drawer_session_id: leg.cashDrawerSessionId,
        tendered_amount:        leg.tenderedAmount,
        // changeReturnedAmount intentionally omitted — auto-derived by addVoucherLine for CASH
        payment_status:         leg.resolvedPaymentStatus,  // D9: config-driven, not hardcoded
        gateway_code:           leg.gatewayCode,
        gateway_reference:      leg.gatewayReference,
        bank_reference:         leg.bankReference,
        check_number:           leg.checkNumber,
        check_bank:             leg.checkBank,
        check_date:             leg.checkDate,
        payment_terminal_id:    leg.terminalId,
        idempotency_key: input.idempotencyKey
          ? `${input.idempotencyKey}_vl_rp_${leg.legIndex}`
          : undefined,
      }, userId)
    );
  }

  for (const leg of plan.creditApplicationLegs) {
    await withTenantContext(tenantId, () =>
      addVoucherLine(tenantId, voucher.id, {
        line_type:               'CREDIT_APPLICATION',  // verified in Step 0b
        line_role:               LINE_ROLE.ORDER_CREDIT_APPLICATION,
        direction:               'NEUTRAL',
        target_type:             'ORDER',
        order_id:                result.orderId,
        customer_id:             input.customerId ?? undefined,
        branch_id:               branchId,
        amount:                  leg.amount,
        currency_code:           leg.currencyCode,
        credit_application_type: leg.creditType,
        idempotency_key: input.idempotencyKey
          ? `${input.idempotencyKey}_vl_ca_${leg.legIndex}`
          : undefined,
      }, userId)
    );
  }

  voucherPostResult = await withTenantContext(tenantId, () =>
    postAndWireBizVoucher(
      tenantId,
      voucher.id,
      userId,
      input.idempotencyKey ? `${input.idempotencyKey}_vch_post` : undefined
    )
  );
}
```

#### `settleOrder` call inside orchestrator — add `wiringMode`

```typescript
await withTenantContext(tenantId, () =>
  settleOrder({
    orderId:             result.orderId,
    tenantId,
    breakdown,
    chargeLines:         [],
    taxLines,
    discountLines:       financialDiscountLines,
    settlementLegs,
    cashDrawerSessionId: input.cashDrawerSessionId ?? undefined,
    settledBy:           userId,
    wiringMode:          plan.shouldCreateReceiptVoucher,
  })
);
```

**What `settleOrder` still does with `wiringMode: true`:**
- ✅ Writes `org_order_charges_dtl`, `org_order_taxes_dtl`, `org_order_discounts_dtl`
- ✅ Redeems wallet/advance/credit-note/loyalty stored-value balances
- ✅ Recalculates `org_orders_mst` snapshot from actual fact rows
- ✅ Emits outbox events and queues loyalty earn
- ❌ Skips `org_order_payments_dtl.create()` — wiring already created this
- ❌ Skips `org_order_credit_apps_dtl.create()` — wiring already created this

#### Invoice status update — keep inside orchestrator, unchanged

Move the existing invoice update block (currently lines 604–619) into the orchestrator. It uses `amountToCharge` and `hasImmediatePayment` which are already computed in orchestrator scope.

#### Orchestrator return value

```typescript
const wiringLinesTotal = voucherPostResult
  ? voucherPostResult.wiring.linesWired + voucherPostResult.wiring.linesSkipped
  : 0;

// Read final order snapshot for response (single read after settleOrder recalculated)
const finalOrder = await withTenantContext(tenantId, () =>
  prisma.org_orders_mst.findFirstOrThrow({
    where:  { id: result.orderId, tenant_org_id: tenantId },
    select: {
      id: true, order_no: true, order_status: true,
      total_amount: true, total_paid_amount: true,
      total_credit_applied_amount: true, outstanding_amount: true,
      payment_status: true, payment_type_code: true,
    },
  })
);

// Collect effects from wiring result for response (no extra DB query — effects already in memory)
const linkedEffects = voucherPostResult
  ? await withTenantContext(tenantId, () =>
      getVoucherLinkedEffects(tenantId, voucherPostResult!.voucherId)
    )
  : null;

return {
  order: {
    id:                       finalOrder.id,
    orderNo:                  finalOrder.order_no,
    currentStatus:            finalOrder.order_status,
    totalAmount:              String(finalOrder.total_amount),
    totalPaidAmount:          String(finalOrder.total_paid_amount ?? 0),
    totalCreditAppliedAmount: String(finalOrder.total_credit_applied_amount ?? 0),
    outstandingAmount:        String(finalOrder.outstanding_amount ?? 0),
    paymentStatus:            finalOrder.payment_status ?? '',
    paymentTypeCode:          finalOrder.payment_type_code ?? '',
  },
  ...(voucherPostResult && {
    voucher: {
      id:           voucherPostResult.voucherId,
      voucherNo:    voucherPostResult.voucher_no,
      status:       voucherPostResult.voucher_status,
      wiringStatus: voucherPostResult.wiring.linesWired === wiringLinesTotal
        ? 'WIRED'
        : 'PARTIALLY_WIRED',
    },
  }),
  effects: {
    orderPayments:      linkedEffects?.orderPayments ?? [],
    creditApplications: linkedEffects?.creditApplications ?? [],
    cashMovements:      linkedEffects?.cashMovements ?? [],
  },
  warnings,
};
```

**Progress:** `[ ]`  
**→ After completing:** Mark Step 3 (3a–3i) done in plan checklist. Update `IMPLEMENTATION_STATUS.md` — orchestrator complete.

---

### STEP 4 — Create New Endpoint `app/api/v1/orders/submit-order/route.ts`

**New file.** Thin route shell — no business logic.

```typescript
/**
 * POST /api/v1/orders/submit-order
 * Submit an order with immediate or deferred payment settlement.
 * Replaces the deprecated /api/v1/orders/create-with-payment endpoint.
 */
export async function POST(request: NextRequest) {
  // 1. CSRF
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  // 2. Auth
  const authCheck = await requirePermission('orders:create')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId, userId, userName } = authCheck;

  // 3. Parse + validate (D10: idempotencyKey is required on this route)
  const body = await request.json().catch(() => null);
  const parsed = submitOrderRequestSchema.safeParse(body); // extends createWithPaymentRequestSchema with idempotencyKey: z.string().min(1)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
  }

  // 4. Idempotency — required on this route
  // Fast-path: same key + same payload → return cached result
  // Conflict: same key + different payload hash → 409 IDEMPOTENCY_CONFLICT
  const idempotencyResult = await checkIdempotency(tenantId, parsed.data.idempotencyKey, body);
  if (idempotencyResult.fromCache) return NextResponse.json({ success: true, data: idempotencyResult.data });
  if (idempotencyResult.conflict)  return NextResponse.json({ success: false, error: 'IDEMPOTENCY_CONFLICT' }, { status: 409 });

  // 5. Resolve branch
  const branchId = await resolveOrderBranch(tenantId, parsed.data.branchId);

  // 6. Delegate to orchestrator
  try {
    const result = await submitOrder({
      tenantId,
      userId,
      userName: userName ?? 'User',
      branchId,
      input: parsed.data,
      requestAudit: getRequestAuditContext(request),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // ... same error handling as create-with-payment (AMOUNT_MISMATCH, PRODUCT_NOT_FOUND, etc.)
  }
}
```

**Note:** Extract `resolveOrderBranch(tenantId, branchId?)` as a small helper in the orchestrator — it's the branch-lookup logic currently at lines 148–166 of `create-with-payment`.

**Progress:** `[ ]`  
**→ After completing:** Mark Step 4 (4a, 4b) done in plan checklist. Update `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` — Steps 1–4 complete (backend fully implemented).

---

### STEP 4B — Code Documentation (invoke `/code-documentation` skill)

**Trigger after Steps 1–4 are all written.** Run the `/code-documentation` skill against each new file so JSDoc/TSDoc blocks and inline comments are added before the code is reviewed or deployed.

#### Files requiring code documentation

| File | What to document |
|---|---|
| `lib/types/settlement-plan.ts` | JSDoc for each interface + field-level comments for non-obvious fields (`requiresReference`, `resolvedPaymentStatus`, `outstandingPolicy`) |
| `lib/types/order-financial.ts` (D9 additions) | JSDoc for the new D9 config fields added to `SettlementOption` |
| `lib/validations/new-order-payment-schemas.ts` (1c addition) | JSDoc for `submitOrderRequestSchema` — note it requires `idempotencyKey` unlike the base schema |
| `lib/services/order-settlement-planner.service.ts` | Full JSDoc for `buildSettlementPlan()` (@param, @returns, @throws none — pure), full JSDoc for `validateSettlementPlan()` (@throws error codes), inline comment on `resolveDefaultStatus()` fallback logic |
| `lib/services/order-submit-orchestrator.service.ts` | JSDoc for `submitOrder()` including @throws list (`AMOUNT_MISMATCH`, `CASH_DRAWER_SESSION_CLOSED`, etc.), JSDoc for `resolveOrderBranch()`, inline comment on idempotency-unaware design (D11) |
| `app/api/v1/orders/submit-order/route.ts` | File-level JSDoc (canonical path comment from Step 5E), JSDoc for `POST` handler |

#### How to invoke

```
/code-documentation lib/services/order-settlement-planner.service.ts
/code-documentation lib/services/order-submit-orchestrator.service.ts
/code-documentation lib/types/settlement-plan.ts
/code-documentation app/api/v1/orders/submit-order/route.ts
```

**Progress:** `[ ]`  
**→ After completing:** Mark Step 4B done in plan checklist. Update `IMPLEMENTATION_STATUS.md` — code documentation complete.

---

### STEP 5 — Deprecation Governance for `create-with-payment`

**Goal:** Make `submit-order` the canonical path with zero ambiguity. The legacy route is NOT deleted — it is frozen, annotated, and barricaded so it cannot accidentally be used again without triggering a visible violation.

All sub-steps below run AFTER Step 6 (frontend callers switched) so the legacy route has zero active callers at the time governance is applied.

---

#### 5A. Audit — find every reference before touching anything
```bash
grep -r "create-with-payment" web-admin --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" -l
```
List each file. Every non-legacy reference must be resolved in Step 6 first. Only the legacy route file itself should remain after Step 6 is done.

---

#### 5B. Rename the route folder to signal legacy status

Rename:
```
web-admin/app/api/v1/orders/create-with-payment/
  →
web-admin/app/api/v1/orders/_legacy_create-with-payment/
```

The leading underscore prefix (`_legacy_`) is the project convention for frozen/deprecated Next.js route segments that must not be served. This immediately removes it from Next.js routing without deleting source history.

> **Note:** Next.js does NOT serve folders prefixed with `_` as API routes. The route becomes inaccessible at runtime while the file is preserved in source for reference and git history.

---

#### 5C. Add deprecation header to the legacy route file

Open `_legacy_create-with-payment/route.ts` and add at the top of the file:

```typescript
/**
 * @deprecated FROZEN — do not modify, do not add callers.
 *
 * This route has been superseded by POST /api/v1/orders/submit-order.
 * It is preserved for reference only and is NOT served by Next.js (folder prefix `_legacy_`).
 *
 * Canonical path: app/api/v1/orders/submit-order/route.ts
 * Orchestrator:   lib/services/order-submit-orchestrator.service.ts
 *
 * Any new order submission logic MUST go into the orchestrator, not here.
 * See: docs/features/Order_Fin/ADR_submit_order_canonical_path.md
 */
```

Also add above the `POST` function declaration:
```typescript
/** @deprecated Use submitOrder() orchestrator via /api/v1/orders/submit-order instead. */
export async function POST(request: NextRequest) {
```

---

#### 5D. ESLint `no-restricted-imports` — barricade against accidental reuse

Add to `web-admin/.eslintrc.js` (or `eslint.config.js` — check which exists):

```javascript
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['**/api/v1/orders/create-with-payment/**', '**/api/v1/orders/_legacy_create-with-payment/**'],
          message: 'Legacy order route is frozen. Use /api/v1/orders/submit-order and the submitOrder() orchestrator instead.',
        },
      ],
    }],
  },
}
```

This makes any new TypeScript import of the legacy path a **build-time error** — impossible to re-introduce accidentally.

---

#### 5E. Code ownership rule — declare canonical path in a comments block

Add to `web-admin/app/api/v1/orders/submit-order/route.ts` at the top, just below the file-level import block:

```typescript
/**
 * CANONICAL ORDER SUBMISSION PATH
 *
 * This is THE entry point for all order creation with payment settlement.
 * All business logic lives in lib/services/order-submit-orchestrator.service.ts.
 *
 * Legacy path (_legacy_create-with-payment) is frozen and not served.
 * Do not split logic between this route and any other route file.
 */
```

---

#### 5F. Write ADR

Create: `docs/features/Order_Fin/ADR_submit_order_canonical_path.md`

```markdown
# ADR: submit-order as Canonical Order Submission Path

**Date:** {implementation date}
**Status:** Accepted
**Deciders:** Engineering

## Context

Two code paths existed for order submission:
- `POST /api/v1/orders/create-with-payment` — original, all logic inline in route handler
- `POST /api/v1/orders/submit-order` — new, thin route + `order-submit-orchestrator.service.ts`

The BVM Wiring Phase 1B integration required extracting business logic into an orchestrator to support:
- Pre-wiring validation (settlement plan validator)
- Voucher create + post + wire before `settleOrder()`
- Richer response shape (order snapshot, effects, warnings)
- Config-driven payment status resolution

## Decision

`POST /api/v1/orders/submit-order` is the **single canonical path** for order submission.

- All new order submission features go into `order-submit-orchestrator.service.ts`
- `create-with-payment` is renamed to `_legacy_create-with-payment`, frozen, and not served
- ESLint `no-restricted-imports` prevents accidental import of the legacy path
- No new callers, no new features on the legacy route

## Consequences

- **Positive:** One place to read, one place to test, one place to fix
- **Positive:** Orchestrator is reusable — future mobile API or background jobs call `submitOrder()` directly
- **Positive:** Thin routes = easier to add middleware, versioning, or gateway logic later
- **Negative (accepted):** Legacy route preserved in source for reference — minor cognitive overhead, offset by clear naming + ESLint guard
```

---

#### 5G. Inline comment on `settleOrder()` direct-write block

The `org_order_payments_dtl` / `org_order_credit_apps_dtl` direct-write blocks in `order-settlement.service.ts` guarded by `if (!wiringMode)` need a clarity comment — NOT a deprecated marker (the block is still needed for deferred-payment orders):

```typescript
// Direct-write path: only active when wiringMode=false (deferred/PAY_ON_COLLECTION orders).
// Phase 2 will consolidate stored-value debits into the voucher transaction.
if (!wiringMode) {
  // ... existing direct-write code
}
```

---

**Progress:** `[ ]`  
**→ After completing:** Mark Step 5 (5a–5g) done in plan checklist. Update `IMPLEMENTATION_STATUS.md` — legacy route governance complete.

---

### STEP 6 — Frontend UI Changes

Three scopes: order creation form, payment method settings, order detail/confirmation.

---

#### 6A. Find order creation frontend file (read-only first)

Search for the component/action that calls `create-with-payment`:
```
grep -r "create-with-payment" web-admin/src --include="*.tsx" --include="*.ts" -l
grep -r "create-with-payment" web-admin/app --include="*.tsx" --include="*.ts" -l
```
Record the file path. Likely a server action in `app/actions/orders/` or a client component in `src/features/orders/ui/`.

---

#### 6B. Update order creation form — endpoint + response parsing

**Update API call:** Change endpoint from `/api/v1/orders/create-with-payment` to `/api/v1/orders/submit-order`.

**Update response parsing** — new shape from `submit-order`:
```typescript
// OLD (from create-with-payment)
const { orderId, orderNo, currentStatus } = data;

// NEW (from submit-order)
const { order, voucher, effects, warnings } = data;
const { id: orderId, orderNo, currentStatus, paymentStatus, outstandingAmount } = order;
```

**Note:** During transition, the deprecated `create-with-payment` returns BOTH old and new fields merged — so the frontend can be updated incrementally. Once the frontend switches to `submit-order`, the merged shape is no longer needed.

---

#### 6C. Filter payment methods by `is_show_in_order_pos` (Gap F fix)

The payment methods loaded in the POS order form must be filtered so only methods with `is_show_in_order_pos = TRUE` (effective COALESCE value) appear.

**Step 6C-1 — Find the payment method API/service for POS:**
```bash
grep -r "org_payment_methods_cf\|payment_method" web-admin/app/api --include="*.ts" -l
grep -r "paymentMethods\|payment_methods" web-admin/src/features/orders --include="*.ts" --include="*.tsx" -l
```
Record the exact API route and service file.

**Step 6C-2 — Update the payment method query to COALESCE effective values:**
The API query fetching `org_payment_methods_cf` for the POS form must JOIN `sys_payment_method_cd` exactly like the orchestrator (same JOIN pattern from Step 3 sub-step 6). Return `effective_show_in_order_pos` (COALESCE result) in the response. Without the JOIN, `is_show_in_order_pos` will be NULL for uninitialized rows even after migration 0321 seeds them, making the filter unreliable.

**Step 6C-3 — Add frontend filter:**
```typescript
const posPaymentMethods = paymentMethods.filter(m => m.effectiveShowInOrderPos !== false);
```

**Note:** If the payment method API is shared between POS and other contexts (settings, reports), add `context=pos` query param to let the API filter server-side rather than relying on client-side filtering for security-sensitive cases.

---

#### 6D. Warnings display after order submission

When `data.warnings[]` is non-empty, show an info toast after the order is submitted:

| Warning code | UI message (EN) | UI message (AR) |
|---|---|---|
| `BANK_TRANSFER_PENDING_CONFIRMATION` | Payment received. Bank transfer confirmation pending. | تم استلام الدفعة. في انتظار تأكيد التحويل البنكي. |
| `CHECK_PENDING_CONFIRMATION` | Payment received. Cheque clearance pending. | تم استلام الدفعة. في انتظار مقاصة الشيك. |
| `GATEWAY_PAYMENT_PROCESSING` | Online payment is processing. Order will update automatically. | الدفع الإلكتروني قيد المعالجة. سيتم تحديث الطلب تلقائياً. |

**i18n keys** (add to `finance.vouchers.*` or `orders.payment.*` namespace):
```
orders.payment.warnings.BANK_TRANSFER_PENDING_CONFIRMATION
orders.payment.warnings.CHECK_PENDING_CONFIRMATION
orders.payment.warnings.GATEWAY_PAYMENT_PROCESSING
```

---

#### 6E. Voucher info on order confirmation

When `data.voucher` is present in the response, show a confirmation chip/badge on the order success screen:

```
✓ Receipt Voucher {voucherNo} created — {wiringStatus}
```

i18n keys:
```
finance.vouchers.receiptVoucherCreated   → "Receipt Voucher {no} created"
finance.vouchers.wiringStatus            → already exists (Phase 1A)
```

If the order detail page shows payment info, add a link: `View Voucher →` pointing to `/dashboard/internal_fin/vouchers/{voucherId}`.

---

#### 6F. Payment method settings UI (for new config columns)

**Scope for Phase 1B:** Add toggle switches to the existing payment method edit form in Settings:

| Column | UI Control | Label (EN) | Label (AR) |
|---|---|---|---|
| `is_show_in_order_pos` | Toggle | Show in POS Order Form | إظهار في نموذج الطلب |
| `is_allow_from_cmx_mobile_apps` | Toggle | Allow from Mobile App | السماح من التطبيق |
| `is_allow_for_outside_integration` | Toggle | Allow for API Integration | السماح للتكامل الخارجي |
| `is_user_id_required` | Toggle | Require Cashier Identity | يتطلب هوية الكاشير |
| `allow_status_override` | Toggle (admin only) | Allow Status Override | السماح بتجاوز الحالة |
| `default_creation_status` | Dropdown | Default Payment Status | حالة الدفع الافتراضية |
| `requires_reference` | Toggle | Reference Number Required | رقم المرجع مطلوب |
| `requires_cash_drawer` | Toggle | Requires Cash Drawer | يتطلب درج النقد |

**File to modify:** Find the payment method settings form — likely `src/features/settings/payment-methods/ui/` or similar. Add fields to the existing form, backed by a server action that updates `org_payment_methods_cf`.

**i18n keys** (add to `settings.paymentMethods.*` namespace):
```
settings.paymentMethods.isShowInOrderPos
settings.paymentMethods.isAllowFromMobileApps
settings.paymentMethods.isAllowForOutsideIntegration
settings.paymentMethods.isUserIdRequired
settings.paymentMethods.allowStatusOverride
settings.paymentMethods.defaultCreationStatus
settings.paymentMethods.requiresReference
settings.paymentMethods.requiresCashDrawer
settings.paymentMethods.statusOptions.COMPLETED
settings.paymentMethods.statusOptions.PENDING
settings.paymentMethods.statusOptions.PROCESSING
```

---

**Progress:** `[ ]`  
**→ After completing:** Mark Step 6 (6a–6f) done in plan checklist. Update `IMPLEMENTATION_STATUS.md` — frontend complete.

---

### STEP 7 — Build Verification

```bash
cd web-admin
npm run build
```

Must pass with zero TypeScript errors. Run both:
```bash
npm run build
npm run check:i18n
```

Key areas to check:
- `PostAndWireResult` import from `voucher-wiring.ts`
- `buildSettlementPlan` + `validateSettlementPlan` param types
- `PaymentLeg[]` import from validations (check fields: `cardBrandCode`, `cardLast4`, `checkNumber`, `checkBank`, `checkDate` all present — confirmed Step 0d)
- `LINE_ROLE.ORDER_CREDIT_APPLICATION` exists (Phase 1A)
- `VOUCHER_TYPE.RECEIPT_VOUCHER` is a valid key (Step 0a verified)
- `CREDIT_APPLICATION_TYPES` values match DB: `GIFT_CARD | WALLET | CUSTOMER_CREDIT | LOYALTY_CREDIT | CUSTOMER_ADVANCE`
- `RealPaymentLeg.resolvedPaymentStatus` flows through to `addVoucherLine` `payment_status` field
- `RealPaymentLeg.requiresReference` flows into `validateSettlementPlan()` — `PAYMENT_REFERENCE_REQUIRED` thrown when missing
- `SettlementOption.default_creation_status` + D9 fields present (Step 1b type update)
- `submitOrderRequestSchema` compiles and extends `createWithPaymentRequestSchema` correctly (Step 1c)
- `SubmitOrderResult.order.*` fields map correctly from `org_orders_mst` Prisma select
- `SubmitOrderResult.effects.*` arrays typed correctly
- `resolveOrderBranch` exported from orchestrator, called in route
- `SettlementPlan.outstandingPolicy` union does NOT include `'PAY_ON_DELIVERY'` (type narrowed in Step 1)
- `@deprecated` JSDoc present on `_legacy_create-with-payment/route.ts` and its `POST` function
- All new i18n keys pass `check:i18n` (warnings keys, voucher badge keys, settings payment method keys)

**Progress:** `[ ]`  
**→ After completing:** Mark Step 7 (7a, 7b) done in plan checklist. Update `IMPLEMENTATION_STATUS.md` — build + i18n green.

---

### STEP 8 — Manual Smoke Test (6 scenarios)

Test against local Supabase. Verify in DB after each scenario.

1. **CASH payment:**  c8fd03df-f8a2-4b1d-89ee-63306aa35cad -- ORD-20260528-0001
   - Submit order with `paymentMethod = CASH`, `cashDrawerSessionId` set
   - Check `org_fin_vouchers_mst`: 1 POSTED row, `source_ref_id = orderId` 
   - Check `org_order_payments_dtl`: `fin_voucher_trx_line_id` set, `payment_method_code = CASH`
   - Check `org_cash_drawer_movements_dtl`: `fin_voucher_trx_line_id` set, `movement_type = CASH_SALE`
   - Check `org_orders_mst.total_paid_amount` = order total
   - Response: `data.voucher.status = 'POSTED'`, `wiringStatus = 'WIRED'`

Test data :
Order_Id= c8fd03df-f8a2-4b1d-89ee-63306aa35cad

check this many columns null and status conflict i think :
select *
from org_fin_vouchers_mst
where source_ref_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad' 
--and order_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad'
;
| id                                   | tenant_org_id                        | branch_id                            | voucher_no     | voucher_category | voucher_subtype | invoice_id | order_id                             | customer_id                          | total_amount | currency_code | status | issued_at | voided_at | void_reason | reason_code | reversed_by_voucher_id | content_html | content_text | metadata | rec_status | rec_order | rec_notes | is_active | created_at                 | created_by                           | created_info | updated_at                 | updated_by                           | updated_info | voucher_type    | voucher_status | posting_status | voucher_date | voucher_datetime | direction | party_type | supplier_id | employee_id | party_name | currency_ex_rate | subtotal_amount | discount_amount | tax_amount | fee_amount | paid_amount | refunded_amount | outstanding_amount | source_module | source_ref_type | source_ref_id                        | description | notes | approved_at | approved_by | posted_at                  | posted_by                            | reversed_at | reversed_by | reversal_reason | idempotency_key                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | -------------- | ---------------- | --------------- | ---------- | ------------------------------------ | ------------------------------------ | ------------ | ------------- | ------ | --------- | --------- | ----------- | ----------- | ---------------------- | ------------ | ------------ | -------- | ---------- | --------- | --------- | --------- | -------------------------- | ------------------------------------ | ------------ | -------------------------- | ------------------------------------ | ------------ | --------------- | -------------- | -------------- | ------------ | ---------------- | --------- | ---------- | ----------- | ----------- | ---------- | ---------------- | --------------- | --------------- | ---------- | ---------- | ----------- | --------------- | ------------------ | ------------- | --------------- | ------------------------------------ | ----------- | ----- | ----------- | ----------- | -------------------------- | ------------------------------------ | ----------- | ----------- | --------------- | ---------------------------------------- |
| f9d42ed2-99a8-4c01-90a0-e895ba7bf36b | 11111111-1111-1111-1111-111111111111 | 597139c9-633c-43f5-b25f-9012a70893b4 | RV-2026-000010 | CASH_IN          | null            | null       | c8fd03df-f8a2-4b1d-89ee-63306aa35cad | 264a0321-daac-4e88-a17f-d423134c7fad | 5.9480       | OMR           | draft  | null      | null      | null        | null        | null                   | null         | null         | null     | 1          | null      | null      | true      | 2026-05-28 02:56:25.382+00 | 370466e6-8b45-4e7d-b377-f0f9421deb59 | null         | 2026-05-28 02:56:25.909+00 | 370466e6-8b45-4e7d-b377-f0f9421deb59 | null         | RECEIPT_VOUCHER | POSTED         | NOT_POSTED     | null         | null             | IN        | CUSTOMER   | null        | null        | null       | null             | null            | null            | null       | null       | 5.9480      | null            | 0.0000             | ORDERS        | ORDER           | c8fd03df-f8a2-4b1d-89ee-63306aa35cad | null        | null  | null        | null        | 2026-05-28 02:56:25.909+00 | 370466e6-8b45-4e7d-b377-f0f9421deb59 | null        | null        | null            | 202a29b4-ebbf-4132-baf8-2fb86f52d5e4_vch |

check this many columns null:
select *
from org_order_payments_dtl
where order_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad'
;
| id                                   | tenant_org_id                        | branch_id                            | order_id                             | customer_id                          | org_payment_method_id | branch_payment_method_id | payment_terminal_id | cash_drawer_id | cash_drawer_session_id | payment_method_code | payment_method_name_snapshot | payment_status | amount | currency_code | tendered_amount | change_returned_amount | card_brand_code | card_last4 | auth_code | gateway_code | gateway_transaction_id | gateway_reference | check_no | check_bank_name | check_due_date | check_status | bank_reference | idempotency_key | paid_at                    | received_by                          | created_at                 | created_by                           | created_info | updated_at | updated_by | updated_info | rec_status | rec_order | rec_notes | is_active | metadata | payment_nature_snapshot | fin_voucher_id                       | fin_voucher_trx_line_id              |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ | --------------------- | ------------------------ | ------------------- | -------------- | ---------------------- | ------------------- | ---------------------------- | -------------- | ------ | ------------- | --------------- | ---------------------- | --------------- | ---------- | --------- | ------------ | ---------------------- | ----------------- | -------- | --------------- | -------------- | ------------ | -------------- | --------------- | -------------------------- | ------------------------------------ | -------------------------- | ------------------------------------ | ------------ | ---------- | ---------- | ------------ | ---------- | --------- | --------- | --------- | -------- | ----------------------- | ------------------------------------ | ------------------------------------ |
| 5b9e4d42-b7c7-4e18-a74c-14d9b7085abe | 11111111-1111-1111-1111-111111111111 | 597139c9-633c-43f5-b25f-9012a70893b4 | c8fd03df-f8a2-4b1d-89ee-63306aa35cad | 264a0321-daac-4e88-a17f-d423134c7fad | null                  | null                     | null                | null           | null                   | CASH                | null                         | COMPLETED      | 5.9480 | OMR           | null            | null                   | null            | null       | null      | null         | null                   | null              | null     | null            | null           | null         | null           | null            | 2026-05-28 02:56:25.977+00 | 370466e6-8b45-4e7d-b377-f0f9421deb59 | 2026-05-28 02:56:25.978+00 | 370466e6-8b45-4e7d-b377-f0f9421deb59 | null         | null       | null       | null         | 1          | null      | null      | true      | {}       | REAL_PAYMENT            | f9d42ed2-99a8-4c01-90a0-e895ba7bf36b | 67982b9b-ca8b-4ed1-9c20-97166053a005 |

select *
from org_cash_drawer_movements_dtl
where order_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad'
;
No rows returned

select *
from org_cash_drawer_movements_dtl
where fin_voucher_trx_line_id='67982b9b-ca8b-4ed1-9c20-97166053a005'
;
No rows returned

select total_paid_amount
from org_orders_mst
where order_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad'
;
yes `org_orders_mst.total_paid_amount` = order total

select *
from org_orders_mst
where order_id='c8fd03df-f8a2-4b1d-89ee-63306aa35cad'
;
| id                                   | tenant_org_id                        | branch_id                            | customer_id                          | order_type_id | order_no          | status     | priority | total_items | subtotal | discount | tax   | total | payment_status | payment_method_code | paid_amount | paid_at | paid_by | payment_notes | received_at             | ready_by                | ready_at | delivered_at | customer_notes | internal_notes | created_at              | updated_at              | preparation_status | prepared_at | prepared_by | ready_by_override | priority_multiplier | photo_urls | bag_count | qr_code | barcode | service_category_code | workflow_template_id                 | current_status | current_stage | parent_order_id | order_subtype | has_split | is_rejected | rejected_from_stage | issue_id | has_issue | ready_by_at_new            | last_transition_at | last_transition_by | is_order_quick_drop | quick_drop_quantity | rack_location | tax_rate | currency_code | currency_ex_rate | vat_rate | vat_amount | discount_rate | discount_type | promo_code_id | gift_card_id | promo_discount_amount | gift_card_applied_amount | payment_type_code | service_charge | service_charge_type | payment_terms | payment_due_date | is_retail | created_by                           | created_info | updated_by | updated_info | rec_status | rec_order | rec_notes | is_default_customer | customer_mobile_number | customer_email         | customer_name | customer_details | cancelled_at | cancelled_by | cancelled_note | cancellation_reason_code | returned_at | returned_by | return_reason | return_reason_code | b2b_contract_id | cost_center_code | po_number | credit_limit_override_by | credit_limit_override_at | order_source_code | physical_intake_status | physical_intake_at | physical_intake_by | physical_intake_info | received_info | idempotency_key                      | total_charges_amount | total_discount_amount | total_tax_amount | total_credit_applied_amount | total_paid_amount | net_receivable_amount | pay_on_collection_amount | rounding_adjustment_amount | change_returned_amount | outstanding_amount | financial_engine_version |
| ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------------------------------ | ------------- | ----------------- | ---------- | -------- | ----------- | -------- | -------- | ----- | ----- | -------------- | ------------------- | ----------- | ------- | ------- | ------------- | ----------------------- | ----------------------- | -------- | ------------ | -------------- | -------------- | ----------------------- | ----------------------- | ------------------ | ----------- | ----------- | ----------------- | ------------------- | ---------- | --------- | ------- | ------- | --------------------- | ------------------------------------ | -------------- | ------------- | --------------- | ------------- | --------- | ----------- | ------------------- | -------- | --------- | -------------------------- | ------------------ | ------------------ | ------------------- | ------------------- | ------------- | -------- | ------------- | ---------------- | -------- | ---------- | ------------- | ------------- | ------------- | ------------ | --------------------- | ------------------------ | ----------------- | -------------- | ------------------- | ------------- | ---------------- | --------- | ------------------------------------ | ------------ | ---------- | ------------ | ---------- | --------- | --------- | ------------------- | ---------------------- | ---------------------- | ------------- | ---------------- | ------------ | ------------ | -------------- | ------------------------ | ----------- | ----------- | ------------- | ------------------ | --------------- | ---------------- | --------- | ------------------------ | ------------------------ | ----------------- | ---------------------- | ------------------ | ------------------ | -------------------- | ------------- | ------------------------------------ | -------------------- | --------------------- | ---------------- | --------------------------- | ----------------- | --------------------- | ------------------------ | -------------------------- | ---------------------- | ------------------ | ------------------------ |
| c8fd03df-f8a2-4b1d-89ee-63306aa35cad | 11111111-1111-1111-1111-111111111111 | 597139c9-633c-43f5-b25f-9012a70893b4 | 264a0321-daac-4e88-a17f-d423134c7fad | POS           | ORD-20260528-0001 | processing | normal   | 2           | 5.900    | 0.590    | 0.372 | 5.948 | PAID           | CASH                | 0.000       | null    | null    | null          | 2026-05-28 02:56:24.556 | 2026-05-30 02:52:49.989 | null     | null         | null           | null           | 2026-05-28 02:56:24.658 | 2026-05-28 02:56:26.774 | pending            | null        | null        | null              | 1.00                | []         | 1         | null    | null    | WASH_AND_IRON         | f3e242c5-90f9-43d9-a98c-b13dca4d07b7 | processing     | intake        | null            | null          | false     | false       | null                | null     | false     | 2026-05-30 02:52:49.989+00 | null               | null               | false               | null                | null          | 7.006    | OMR           | 1.000000         | 5.00     | 0.2660     | 0.00          | null          | null          | null         | 0.0000                | 0.0000                   | PAY_IN_ADVANCE    | 0.0000         | null                | null          | null             | false     | 370466e6-8b45-4e7d-b377-f0f9421deb59 | null         | null       | null         | 1          | null      | null      | true                | 96662624               | jhtest.dev21@gmail.com | Jh Test dev21 | null             | null         | null         | null           | null                     | null        | null        | null          | null               | null            | null             | null      | null                     | null                     | pos               | received               | null               | null               | null                 | null          | 202a29b4-ebbf-4132-baf8-2fb86f52d5e4 | 0.0000               | 0.5900                | 0.6375           | 0.0000                      | 5.9480            | 5.9480                | null                     | 0.0000                     | null                   | 0.0000             | 2                        |


2. **CARD payment:** 
   - Check `org_order_payments_dtl`: `payment_method_code = CARD`, `fin_voucher_trx_line_id` set =yes
   - Check NO `org_cash_drawer_movements_dtl` row for this order=no
   - Response includes `data.voucher`= yes 

3. **PAY_ON_COLLECTION:** == yes
   - Check NO `org_fin_vouchers_mst` row
   - Check `org_orders_mst.outstanding_amount` = order total
   - Response has NO `data.voucher` field

4. **Multi-leg (CASH 100 + WALLET 50):** = WALLET not yet implemented in payment modal screen v4
   - Check voucher has 2 lines (ORDER_PAYMENT + ORDER_CREDIT_APPLICATION)
   - Check `org_order_payments_dtl` row + `org_order_credit_apps_dtl` row
   - Check wallet balance reduced by 50
   - Check `org_orders_mst.total_paid_amount` = 100 (cash only); `total_credit_applied_amount` = 50

5. **Idempotency retry:** - I don't know how to test this but i think it happen in test point 7 ???
   - POST same request twice with same `idempotencyKey`
   - Second call returns same response; row counts in DB unchanged

6. **Regression — CHECK payment:** when click on payment and check no not entered not showing what is the thing that not allowing click payment button
   - Submit with `paymentMethod = CHECK`, `checkNumber = CHK001`, `checkBank = SomBank`
   - Check `org_fin_voucher_trx_lines_dtl.check_number = 'CHK001'`, `check_bank = 'SomBank'`

7. **`requires_reference` enforcement (Gap E validation):** = No with big Error
   - Submit BANK_TRANSFER payment with NO reference number (`gatewayReference`, `bankReference`, `checkNumber` all absent)
   - Expect 422/400 response with error code `PAYMENT_REFERENCE_REQUIRED`
   - Confirm NO voucher row created (validator fired before `createBizVoucher`)

the test result:
   first time when bank reference was null it say server error 500 and I checked there is voucher , but there is no org_order_* e.g. org_order_payments_dtl , org_order_taxes_dtl ...etc ( order_id=433d736f-7e2b-42fb-886c-0f1281938ece)
   then when I fill the bank reference field and click payment it accept and show message in blue that bank reference come(something like that) and not showing the message order created , but i checked it create another order without voucher but with org_order_* tables data e.g. org_order_payments_dtl , org_order_taxes_dtl ...etc (order_id=d935ddd5-63d6-4be8-a841-78502ca51305)
   
8. **GATEWAY payment (PROCESSING status):** not allowing payment button when try any PAYMENT_GATEWAY e.g. HyperPay
   - Submit order with a gateway payment method (e.g., `gatewayCode = 'HYPERPAY'`)
   - Check `org_order_payments_dtl.payment_status = 'PROCESSING'`
   - Response `data.warnings[]` includes `GATEWAY_PAYMENT_PROCESSING`
   - Confirm UI shows the processing warning toast in the order form

9. **`is_show_in_order_pos` filter in POS form:** = yes
   - Set a payment method's `is_show_in_order_pos = FALSE` in `org_payment_methods_cf`
   - Open the order creation form in POS
   - Confirm that payment method does NOT appear in the payment method selector
   - Confirm it still appears in the Settings → Payment Methods list (filter is POS-specific)

10. **`allow_status_override = true`:** = No I changes it to true from the database but still show completed , by the way this column and some other columns not in the screen of payment setup config and that screen should have the tenant currency because its not allow save without fill currency Code
    - Set `allow_status_override = TRUE` for CARD method in `org_payment_methods_cf`
    - Submit CARD order with `paymentStatus: 'PENDING'` in the request body
    - Check `org_order_payments_dtl.payment_status = 'PENDING'` (override respected) -- No
    - Reset to `FALSE` and retry — expect `payment_status = 'COMPLETED'` (config default wins)

**Progress:** `[ ]`  
**→ After completing:** Mark Step 8 done in plan checklist. Update `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` — smoke tests column updated.

---

### STEP 9 — Create Phase 1B Implementation Documentation

Create new file: `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md`

Following the same format as `bvm_wiring_phase1a_implementation.md`. Must cover:
- Overview (what Phase 1B does — new endpoint, orchestrator, voucher wiring integration)
- Permissions (unchanged — `orders:create` only; design decision D1)
- Navigation tree (none new)
- Tenant settings (none new)
- Feature flags (none new)
- i18n keys (orders.payment.warnings.*, finance.vouchers.receiptVoucherCreated, settings.paymentMethods.*)
- API routes:
  - `POST /api/v1/orders/submit-order` — canonical endpoint; full request schema + response shape: `{ order, voucher?, effects, warnings }`
  - `POST /api/v1/orders/create-with-payment` — **NOT a wrapper** — route folder renamed to `_legacy_create-with-payment`, frozen, not served by Next.js. All callers migrated to `submit-order`.
- **API contract section** (in `docs/features/Order_Fin/technical_docs/tech_api.md` or inline in impl doc):
  ```
  POST /api/v1/orders/submit-order
  Permission: orders:create
  Request: { ...createWithPaymentRequest fields..., idempotencyKey: string (required) }
  Response 200: { success: true, data: SubmitOrderResult }
  Response 409: { success: false, error: 'IDEMPOTENCY_CONFLICT' }
  Response 422: { success: false, error: 'PAYMENT_REFERENCE_REQUIRED' | 'CASH_TENDERED_LESS_THAN_AMOUNT' | 'CASH_DRAWER_SESSION_CLOSED' | 'GATEWAY_NOT_CONFIGURED' }
  Idempotency: required — same key + same payload = cached result; same key + diff payload = 409
  Warnings: BANK_TRANSFER_PENDING_CONFIRMATION | CHECK_PENDING_CONFIRMATION | GATEWAY_PAYMENT_PROCESSING
  ```
- New files: `settlement-plan.ts`, `order-settlement-planner.service.ts`, `order-submit-orchestrator.service.ts`, `submit-order/route.ts`, `ADR_submit_order_canonical_path.md`
- Modified files: `lib/types/order-financial.ts` (D9 fields on `SettlementOption`), `lib/validations/new-order-payment-schemas.ts` (`submitOrderRequestSchema`), `prisma/schema.prisma` (new payment method config columns), `lib/constants/order-financial.ts` (`CREDIT_APPLICATION_TYPES` exact DB values)
- Governance: `_legacy_create-with-payment/route.ts` — `@deprecated` annotated, ESLint `no-restricted-imports` barricade
- Known limitation: gift card via `input.giftCardId` not yet wired (Phase 2)
- Known limitation: stored-value debits in `settleOrder` (Phase 2 consolidation)
- Testing scenarios (all 10 scenarios from Step 8)
- Implementation status checklist (all items checked)

**Progress:** `[ ]`  
**→ After completing:** Mark Step 9 done in plan checklist. Update `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` — implementation doc column updated.

---

### STEP 10 — Update Implementation Status and PRD

**9a.** Update `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` to mark Phase 1B as complete.

**9b.** Update PRD `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md`:
- Mark Phase 1B items as `[x]`
- Carry forward Phase 2 gap notes (gift card, stored-value consolidation)

**Progress:** `[ ]`  
**→ After completing:** Mark Step 10 done in plan checklist. `IMPLEMENTATION_STATUS.md` and PRD are now fully updated — Phase 1B shown as complete.

---

### STEP 11 — Run `/documentation` Skill for Full Feature Docs

Invoke the `/documentation` skill for `BVM Wiring Phase 1B`.

The skill should produce or update documentation in `docs/features/Order_Fin/` covering all documentation checklist sections:
- Permissions (D1 decision documented)
- API contract for both endpoints (`submit-order` + deprecated `create-with-payment`)
- New service files and their responsibilities
- Frontend UI changes (payment method filtering, warnings, voucher badge, settings UI)
- Known limitations and Phase 2 deferred scope

**Progress:** `[ ]`  
**→ After completing:** Mark Step 11 done in plan checklist. Phase 1B is fully complete — all checklist items checked, docs generated, PRD updated.

---

## Key Files Reference

| Purpose | File | Status |
|---|---|---|
| Settlement plan types | `lib/types/settlement-plan.ts` | **New** |
| Settlement planner | `lib/services/order-settlement-planner.service.ts` | **New** |
| Old route (Frozen — renamed) | `app/api/v1/orders/_legacy_create-with-payment/route.ts` | **Governance (Step 5)** |
| ADR — canonical path | `docs/features/Order_Fin/ADR_submit_order_canonical_path.md` | **New (Step 5F)** |
| Wiring orchestrator | `lib/services/voucher-wiring.service.ts` | Existing (Phase 1A) |
| Voucher create | `lib/services/voucher-biz.service.ts` | Existing |
| Voucher line | `lib/services/voucher-line.service.ts` | Existing |
| settleOrder guard | `lib/services/order-settlement.service.ts` | Existing (Phase 1A guard) |
| LINE_ROLE constants | `lib/constants/voucher.ts` | Existing (Phase 1A) |
| Wiring types | `lib/types/voucher-wiring.ts` | Existing (Phase 1A) |
| PaymentLeg type | `lib/validations/new-order-payment-schemas.ts` | Existing |
| Submit order orchestrator | `lib/services/order-submit-orchestrator.service.ts` | **New** |
| New submit-order route | `app/api/v1/orders/submit-order/route.ts` | **New** |
| Order creation form | `src/features/orders/ui/` or `app/actions/orders/` (find in Step 6a) | **Modify** |
| Payment method settings form | `src/features/settings/payment-methods/ui/` (find in Step 6f) | **Modify** |
| Phase 1B impl doc | `docs/features/Order_Fin/bvm_wiring_phase1b_implementation.md` | **New (Step 9)** |

---

## Phase 1B Completion Checklist

```
[ ] Step 0  — Pre-implementation verifications:
    [ ] 0a: VOUCHER_TYPE.RECEIPT_VOUCHER confirmed
    [ ] 0b: LINE_TYPE.CREDIT_APPLICATION confirmed (migration 0320 if needed → STOP)
    [ ] 0c: validateVoucherLine with undefined userRole confirmed
    [ ] 0d: PaymentLeg check + card fields confirmed (checkNumber, checkBank, checkDate, cardBrandCode, cardLast4)
    [ ] 0e: gateway_transaction_id column check — maps to gateway_reference or new column
    [ ] 0f: CREDIT_APPLICATION_TYPES constant updated to exact DB values (GIFT_CARD|WALLET|CUSTOMER_CREDIT|LOYALTY_CREDIT|CUSTOMER_ADVANCE)
    [ ] 0g: sys_payment_method_cd + org_payment_methods_cf config columns check (migration 0321 if needed → STOP)
    [ ] 0h: prisma/schema.prisma updated for both tables + prisma generate run (Gap C — after 0321 applied)
    [ ] plan updated — Step 0 sub-items checked; migrations applied noted in IMPLEMENTATION_STATUS.md
[ ] Step 1  — Types + schema:
    [ ] 1a: lib/types/settlement-plan.ts created (RealPaymentLeg with requiresReference field + outstandingPolicy narrowed — no PAY_ON_DELIVERY)
    [ ] 1b: lib/types/order-financial.ts updated — D9 config fields added to SettlementOption (default_creation_status, allow_status_override, requires_cash_drawer, requires_reference, is_user_id_required)
    [ ] 1b-card: cardBrandCode + cardLast4 mapping added to planner loop (from orig PaymentLeg by index)
    [ ] 1c: submitOrderRequestSchema created in lib/validations/new-order-payment-schemas.ts (extends createWithPaymentRequestSchema + idempotencyKey required)
    [ ] plan updated — Step 1 marked done
[ ] Step 2  — order-settlement-planner.service.ts created:
    [ ] 2a: buildSettlementPlan() with resolveDefaultStatus + config-driven resolvedPaymentStatus + requiresReference mapped from option
    [ ] 2b: validateSettlementPlan() async — drawer open, tendered >= amount, gateway config, requires_reference enforced (PAYMENT_REFERENCE_REQUIRED)
    [ ] plan updated — Step 2 marked done
[ ] Step 3  — order-submit-orchestrator.service.ts created:
    [ ] 3a: SubmitOrderParams (uses SubmitOrderRequest from 1c) + SubmitOrderResult interfaces defined
    [ ] 3b: all business logic extracted from create-with-payment (tx1 WITHOUT idempotency store, leg resolution, breakdown, taxLines)
    [ ] 3b-join: org_payment_methods_cf lookup updated to JOIN sys_payment_method_cd + COALESCE effective D9 values (Gap B)
    [ ] 3c: validateSettlementPlan() called BEFORE createBizVoucher
    [ ] 3d: warnings[] built from PENDING/PROCESSING legs
    [ ] 3e: voucher step (createBizVoucher + addVoucherLine with resolvedPaymentStatus + postAndWireBizVoucher)
    [ ] 3f: settleOrder called with wiringMode: plan.shouldCreateReceiptVoucher
    [ ] 3g: invoice status update block (604–619) moved in unchanged
    [ ] 3h: final org_orders_mst read + getVoucherLinkedEffects → richer SubmitOrderResult returned
    [ ] 3i: resolveOrderBranch exported helper extracted from create-with-payment lines 148–166
    [ ] plan updated — Step 3 marked done; IMPLEMENTATION_STATUS.md updated (orchestrator complete)
[ ] Step 4  — app/api/v1/orders/submit-order/route.ts created:
    [ ] 4a: thin shell — CSRF → auth → parse (submitOrderRequestSchema) → idempotency check+store → resolveOrderBranch → submitOrder → return
    [ ] 4b: idempotency owned entirely in route — orchestrator is idempotency-unaware (Gap I)
    [ ] plan updated — Steps 1–4 marked done; IMPLEMENTATION_STATUS.md updated (backend complete)
[ ] Step 4B — Code documentation (/code-documentation skill):
    [ ] 4B-a: settlement-plan.ts documented (interface + field JSDoc)
    [ ] 4B-b: order-financial.ts D9 additions documented
    [ ] 4B-c: submitOrderRequestSchema documented (note: idempotencyKey required unlike base schema)
    [ ] 4B-d: order-settlement-planner.service.ts documented (buildSettlementPlan + validateSettlementPlan + inline fallback comment)
    [ ] 4B-e: order-submit-orchestrator.service.ts documented (submitOrder @throws list + resolveOrderBranch + D11 idempotency comment)
    [ ] 4B-f: submit-order/route.ts documented (canonical path header + POST handler JSDoc)
    [ ] plan updated — Step 4B marked done; IMPLEMENTATION_STATUS.md updated (code docs complete)
[ ] Step 5  — Deprecation governance for create-with-payment (ALL must be done AFTER Step 6 callers switched):
    [ ] 5a: audit grep — all references found and listed; only legacy file itself remains after Step 6
    [ ] 5b: folder renamed to _legacy_create-with-payment (Next.js won't serve _-prefixed routes)
    [ ] 5c: @deprecated JSDoc block + function-level @deprecated added to legacy route file
    [ ] 5d: ESLint no-restricted-imports rule added — legacy path is a build-time error
    [ ] 5e: canonical path comment block added to submit-order/route.ts
    [ ] 5f: ADR_submit_order_canonical_path.md created in docs/features/Order_Fin/
    [ ] 5g: settleOrder() direct-write block clarity comment added (not deprecated marker)
    [ ] plan updated — Step 5 marked done; IMPLEMENTATION_STATUS.md updated (legacy governance complete)
[ ] Step 6  — Frontend UI changes (ALL must be done before Step 5 governance):
    [ ] 6a: order creation form found — API call updated to /submit-order
    [ ] 6b: response parsing updated (data.order.id, data.order.orderNo, data.effects, data.warnings)
    [ ] 6c-1: payment methods API file identified (grep for org_payment_methods_cf in API routes)
    [ ] 6c-2: payment methods API query updated to JOIN sys_payment_method_cd + return effectiveShowInOrderPos
    [ ] 6c-3: POS form filters by effectiveShowInOrderPos (frontend filter)
    [ ] 6d: warnings[] displayed as info toast after submission (EN + AR i18n keys added)
    [ ] 6e: voucher badge shown on order confirmation when data.voucher present + "View Voucher" link
    [ ] 6f: payment method settings form updated with 8 new config toggles + dropdown + server action update (EN + AR i18n keys added)
    [ ] plan updated — Step 6 marked done; IMPLEMENTATION_STATUS.md updated (frontend complete)
[ ] Step 7  — Build + i18n verification:
    [ ] 7a: npm run build passes — zero TypeScript errors
    [ ] 7b: npm run check:i18n passes — all new keys present in en.json + ar.json
    [ ] plan updated — Step 7 marked done; IMPLEMENTATION_STATUS.md updated (build green)
[ ] Step 8  — 10 manual smoke test scenarios pass:
    [ ] 8-1: CASH payment — voucher POSTED, cash drawer movement created
    [ ] 8-2: CARD payment — voucher POSTED, no drawer movement
    [ ] 8-3: PAY_ON_COLLECTION — no voucher, outstanding_amount = total
    [ ] 8-4: Multi-leg CASH + WALLET — 2 voucher lines, wallet debited, split amounts correct
    [ ] 8-5: Idempotency retry — second call returns same result, zero new DB rows
    [ ] 8-6: CHECK payment — check_number + check_bank on voucher line
    [ ] 8-7: BANK_TRANSFER without reference → PAYMENT_REFERENCE_REQUIRED, no voucher created
    [ ] 8-8: GATEWAY payment → payment_status=PROCESSING, GATEWAY_PAYMENT_PROCESSING warning in response + UI toast
    [ ] 8-9: is_show_in_order_pos=FALSE — method absent from POS form, present in settings list
    [ ] 8-10: allow_status_override=TRUE — custom paymentStatus in request respected on voucher line
    [ ] plan updated — Step 8 marked done; IMPLEMENTATION_STATUS.md updated (smoke tests passed)
[ ] Step 9  — bvm_wiring_phase1b_implementation.md created (correct: _legacy_ frozen, not wrapper) + API contract section added
    [ ] plan updated — Step 9 marked done; IMPLEMENTATION_STATUS.md updated (impl doc complete)
[ ] Step 10 — IMPLEMENTATION_STATUS.md + PRD updated — Phase 1B fully marked complete
    [ ] plan updated — Step 10 marked done
[ ] Step 11 — /documentation skill run — all feature docs in docs/features/Order_Fin/ updated
    [ ] plan updated — Step 11 marked done; Phase 1B fully complete ✅
```

---

## Phase 2–5 Backlog (Not In Scope Now)

- **Phase 2:** Gift card via `input.giftCardId` → ORDER_CREDIT_APPLICATION voucher line; stored-value debits (wallet, advance, credit-note, loyalty) move inside voucher transaction for atomicity
- **Phase 3:** AR Invoice creation for CREDIT_INVOICE via `createArInvoiceFromOrders()` — flow doc §20.3
- **Phase 4:** Reconciliation service (`order-reconciliation.service.ts`) — flow doc §23
- **Phase 5:** History/audit entries (`org_order_history`, `org_order_status_history`) — flow doc §22
