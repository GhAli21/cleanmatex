# 02 — Backend Audit: Orders Core, Workflow Engine V2, Edit/Change, Cancel/Return/Split & Order Finance

---

## 1. Architecture & System Map

### A. Workflow Engine V2
- **Canonical Action Codes** (`web-admin/lib/constants/workflow-actions.ts:8-30`):
  - Intake/Prep: `CONFIRM_PHYSICAL_INTAKE`, `SEND_TO_PREPARATION`, `COMPLETE_PREPARATION`
  - Plant/Processing: `COMPLETE_PROCESSING`, `COMPLETE_ASSEMBLY`, `PASS_QA`, `FAIL_QA`, `COMPLETE_PACKING`, `MARK_READY`
  - Fulfilment: `RELEASE_FOR_PICKUP`, `CONFIRM_PICKUP`, `RELEASE_FOR_DELIVERY`, `CONFIRM_DELIVERY`
  - Home Collection: `ASSIGN_HOME_COLLECTION`, `CONFIRM_HOME_COLLECTION`, `FAIL_HOME_COLLECTION`
  - Control/Terminal: `HOLD_ORDER_WORK`, `RESUME_ORDER_WORK`, `STOP_ORDER_WORK`, `CANCEL_ORDER`, `RETURN_ORDER`
- **Create-Time Presets** (`web-admin/lib/constants/workflow-create-presets.ts:6-90`): `REMOTE_DRAFT`, `POS_IN_HAND`, `POS_QUICK_DROP`, `RETAIL_SOLD`, `STAFF_IN_HAND`, `HOME_COLLECTION_PENDING`, `BRANCH_DEFAULT` (hydrated via `order-create-hydrator.ts`, fail-closed).
- **Profile Resolution** (`workflow-profile-resolution.service.ts`): Ranks `org_wf_profile_assign_cf` by specificity (`branch_id` + `service_code`), fails closed on conflicts; evaluates live `wf_profile_version_id`.
- **16-Gate Evaluator** (`workflow-gate-evaluator.service.ts`): `hard_block`, `soft_warning` (HMAC-SHA256 challenge, 300s TTL), `override_allowed`; `public_web` forced to `hard_block`.
- **Concurrency & Idempotency** (`workflow-engine.service.ts:718-1173`): `org_idempotency_keys` payload-hash staking + `SELECT ... FOR UPDATE` + `state_version` CAS.

### B. Order Creation, Edit V2, Cancel/Split & Financial Integration
- **Create:** `POST /api/v1/orders/submit-order` -> `order-submit-orchestrator.service.ts` -> single `prisma.$transaction` (30s) wrapping order/items/pieces/prefs, optional AR invoice (`CREDIT_INVOICE` only), BVM Receipt Voucher (`RV-*`), stored-value debits, `postAndWireBizVoucher`, cash drawer check, `settleOrderTx`, `SAVEPOINT` tax-doc issuance, and `commitInitialOrderTx`.
- **Edit V2:** `POST /api/v1/orders/[id]/changes` — CSRF, `orders:edit`, `Idempotency-Key`, active tab-scoped Edit Session (`enforceOrderEditSession`), signed `reviewProof`, `edit_state_version` + `state_version` CAS, and `blockCommittedCommercialWrite`.
- **Cancel / Return / Split / Issues:** `CANCEL_ORDER` restricted pre-prep-complete (>=10 char reason, no silent Fin unwind); `RETURN_ORDER` deferred to V1.1 (`422`); `POST /split` creates zero-priced operational sub-orders (`<root>-S<n>`); `POST /issue` supports ORDER/ITEM/PIECE scopes.
- **Finance:** BVM voucher-first (`createBizVoucher` -> `postAndWireBizVoucher` -> ERP Lite auto-post); single snapshot authority (`order-financial-aggregation.ts` -> `recalculateOrderFinancialSnapshotTx`).

---

## 2. Ranked Findings & Recommendations

### HIGH / CRITICAL

#### 1. Unauthenticated-RBAC Force-Unlock & Unprotected Lock Endpoints Break Edit V2 Session Isolation
- **Files:** `web-admin/app/api/v1/orders/[id]/unlock/route.ts:17-60`, `web-admin/lib/services/order-lock.service.ts:144-172`, `web-admin/app/api/v1/orders/[id]/lock/route.ts:17-59`
- **Issue:** Both `/lock` and `/unlock` omit `requirePermission` and `validateCSRF`. `unlock/route.ts:49` forwards client `body.force === true` to `unlockOrder()`, skipping ownership checks without verifying any admin permission. Because legacy `order-lock.service.ts` and modern `order-edit-session.service.ts` share `org_order_edit_locks`, **any authenticated tenant user (or CSRF attack) can forcibly destroy an active Edit V2 session lock**.
- **Recommendation:** Retire or gate `/lock` & `/unlock` with `validateCSRF` + `requirePermission('orders:edit')`, and require `orders:force_unlock` before honoring `force: true`.
- **[YOUR NOTE]:** 

#### 2. Home-Collection & Pickup Stage Bypass Guards Missing on Generic Workflow Routes
- **Files:** `web-admin/app/api/v1/orders/[id]/transition/route.ts:98-100`, `web-admin/app/api/v1/orders/[id]/actions/route.ts:70-75`
- **Issue:** `/transition` omits `isStaffHomeCollectionBypassAction`, and neither `/actions` nor `/transition` blocks `CONFIRM_PICKUP` or `COMPLETE_PREPARATION` or reason-required fail actions (`FAIL_QA`, `FAIL_HOME_COLLECTION`).
- **Recommendation:** Add `isStaffHomeCollectionBypassAction`, `isStaffPickupBypassAction`, and `COMPLETE_PREPARATION` guards to both `/actions` and `/transition`.
- **[YOUR NOTE]:** 

#### 3. Concurrent Partial Refunds Can Over-Refund an Order / Payment / Credit Application
- **Files:** `web-admin/lib/services/order-refund.service.ts:765-857`
- **Issue:** `processRefund` locks only `org_order_refunds_dtl` (`WHERE id = refundId FOR UPDATE`), not the parent `org_orders_mst` row. Two concurrent `APPROVED` partial refunds for the same order/payment both read pre-commit `processedRefunds` and both disburse, exceeding refundable balance or source payment cap.
- **Recommendation:** Lock parent `org_orders_mst` (`FOR UPDATE`) immediately after reading `refund.order_id` and before `getRefundableBalanceSummaryTx`.
- **[YOUR NOTE]:** 

#### 4. Missing RBAC Permission Checks on Order Read & Metadata Endpoints
- **Files:** `web-admin/app/api/v1/orders/[id]/route.ts:28-43`, `web-admin/app/api/v1/orders/[id]/workflow-context/route.ts:22-37`, `web-admin/app/api/v1/orders/[id]/editability/route.ts:18-39`
- **Issue:** All three resolve `tenantId` from session without `requirePermission('orders:read')`. Any authenticated tenant user (regardless of role) can read full order PII, items, and financials.
- **Recommendation:** Add `requirePermission('orders:read')(request)` to all three endpoints.
- **[YOUR NOTE]:** 

#### 5. SaaS Monthly Order Quota (`max_orders_per_month`) Is Dead / Unenforced
- **Files:** `web-admin/lib/services/usage-tracking.service.ts:254,397`, `web-admin/lib/services/order-submit-orchestrator.service.ts`
- **Issue:** `incrementOrderCount()` has zero callers across the codebase; `canCreateOrder()` is not called by `submit-order`; limits are split across `sys_plan_limits`, `sys_pln_subscription_plans_mst`, and feature flags.
- **Recommendation:** Consolidate plan-limit source of truth, enforce quota inside `submit-order`, and atomically increment `org_usage_tracking.orders_count` inside the order-create transaction.
- **[YOUR NOTE]:** 

---

### MEDIUM

#### 6. Swallowed SQL Error Inside Transaction in `workflow-engine.service.ts` Risks `25P02` Cascade
- **Files:** `web-admin/lib/services/workflow/workflow-engine.service.ts:1085-1103`
- **Issue:** `INSERT INTO org_wf_release_mst` is wrapped in JS `try/catch` inside `prisma.$transaction` without a PostgreSQL `SAVEPOINT`. Any SQL error aborts the entire transaction (`25P02`), breaking subsequent queries.
- **Recommendation:** Remove the silent catch or wrap in `SAVEPOINT` / `ROLLBACK TO SAVEPOINT`.
- **[YOUR NOTE]:** 

#### 7. Untrusted Client-Supplied `collectedBy` on Payment Collection Routes
- **Files:** `web-admin/app/api/v1/orders/[id]/collect-payment/route.ts:21,51-56`, `web-admin/app/api/v1/orders/[id]/payments/route.ts:21,64`
- **Issue:** Both accept `collectedBy` from request body and stamp it on financial vouchers instead of forcing authenticated `userId`.
- **Recommendation:** Always stamp authenticated `userId` (ignore client-supplied `collectedBy`).
- **[YOUR NOTE]:** 

#### 8. B2B Credit Limit Check Runs Outside Transaction (TOCTOU Race)
- **Files:** `web-admin/lib/services/order-submit-orchestrator.service.ts:395-408`
- **Issue:** `checkCreditLimit` runs before `prisma.$transaction` (line 694) with no lock. Two concurrent `CREDIT_INVOICE` submissions can exceed a hard-denied credit limit.
- **Recommendation:** Re-verify credit exposure inside `prisma.$transaction` under a customer-scoped row lock.
- **[YOUR NOTE]:** 

#### 9. Legacy `/transition` Defeats Optimistic Concurrency & Idempotency
- **Files:** `web-admin/app/api/v1/orders/[id]/transition/route.ts:102-124`
- **Issue:** Auto-fills latest `state_version` from DB when omitted and generates random `crypto.randomUUID()` when `Idempotency-Key` is omitted.
- **Recommendation:** Deprecate `/transition` (migrate QA, Packing, Assembly, Cancel/Return modals to `STAGE_COMMANDS` / `/actions`) and require `expectedStateVersion` + `Idempotency-Key`.
- **[YOUR NOTE]:** 

#### 10. `executeAction` Skips Idempotency Lookup When Composed in an Outer Transaction
- **Files:** `web-admin/lib/services/workflow/workflow-engine.service.ts:721-772,1143-1170`
- **Issue:** Skips `findIdempotencyHash`/`stakeIdempotencyHash` when `transaction` is passed, yet writes to `org_idempotency_keys` inside `run(tx)`.
- **Recommendation:** Perform idempotency check inside `run(tx)` or enforce pre-tx staking consistently.
- **[YOUR NOTE]:** 

#### 11. Unbounded `limit` and Unescaped PostgREST `.or()` Delimiters on `GET /api/v1/orders`
- **Files:** `web-admin/app/api/v1/orders/route.ts:105-106,360-368`
- **Issue:** No upper/lower clamp or `NaN` guard on `page`/`limit`; `search` leaves `(),.` unstripped before `.or(...)`.
- **Recommendation:** Clamp `page >= 1`, `1 <= limit <= 100` (default `CMX_DEFAULT_PAGE_SIZE`), and strip `(),.` from `search`.
- **[YOUR NOTE]:** 

---

### LOW

- **V1 vs V2 `OrderStatus` Type Drift:** `lib/types/workflow.ts:11-48` omits `preparing`, `on_hold`, `stopped`, `returned`.
- **Missing CSRF on Mutating Order Routes:** `/actions`, `/transition`, `/split`, `/issue`, `/fix-order-data` omit `validateCSRF(request)`.
- **`as any` Casts:** `order-service.ts:623`, `fix-order-data/route.ts:69`, `editability/route.ts:49`, `orders/route.ts:428`.
- **[YOUR NOTE]:** 
