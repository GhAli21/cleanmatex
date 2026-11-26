# 03 — Downstream Workflow Stages Audit (Processing, Assembly, QA, Packing, Ready, Delivery, Home Collection)

---

## 1. Stage-by-Stage Comparison Matrix

| Stage | Stage-Command Integrity | Security / Concurrency / Perf | Key Domain / Implementation Gaps |
|---|---|---|---|
| **Processing** | `complete` uses `STAGE_COMMANDS`; `batch-update` calls `executeAction` directly; **`markItemComplete` treats `pending` items as ready!** | `step`/`complete` item routes lack CSRF & rate limit; detail page lacks `<RequireAnyPermission>` | `recordProcessingStep` blocks re-washing an already-completed step; no machine/batch load tracking |
| **Assembly** | `assembly/[id]/complete` uses `STAGE_COMMANDS`; **all 8 `assembly/tasks/*` mutations bypass `WorkflowEngine`**; modal still calls `/transition` | **All 8 task/exception mutations lack CSRF, Zod, rate limit, idempotency, `state_version`**; `GET` mutates DB; `current_load` race & leak | **Tracks order lines, not pieces** (scanning 1 of 5 shirts marks all 5 scanned!); `current_load` never decremented; dashboard counts `READY` while completion writes `COMPLETE` |
| **QA** | `pass`/`fail` use `STAGE_COMMANDS`; **bypassable** via `/actions` & `/transition` without 10-char reason; `qa/[id]/page.tsx` still calls `/transition` | `pass`/`fail` lack rate limit; detail page lacks `<RequireAnyPermission>` | No structured QA checklist; no piece-level rework targeting (fails whole order) |
| **Packing** | `packing/[id]/complete` uses `STAGE_COMMANDS`; **double-transition race** (`batch-update` auto-completes + legacy `/transition`) | `complete` lacks rate limit; detail page lacks `<RequireAnyPermission>` | Detail UI only edits `rackLocation` — omits bag/hanger counts, locker code, packaging type, packing label print |
| **Ready / Pickup** | `release-*` & `pickup/orders/[orderId]/complete` are atomic/gold-standard; **CRITICAL BYPASS**: `/actions` & `/transition` do NOT block `CONFIRM_PICKUP` | `pickup/complete` & `ready/*` lack rate limit; detail page lacks `<RequireAnyPermission>` | Partial pickup explicitly blocked (`PICKUP_PARTIAL_RELEASE_UNSUPPORTED`); no customer pickup OTP; no rack-slot release |
| **Delivery** | **Strongest stage**: `CONFIRM_DELIVERY` blocked on both `/actions` & `/transition` | Unbounded `limit` on `GET /delivery/routes`; `stops/[stopId]/complete` lacks UUID validation & bearer-auth CSRF bypass; no rate limit | OTP POD explicitly disabled (`code: { not: 'OTP' }`); no time-slot scheduling or failed-delivery re-attempt workflow |
| **Home Collection** | `assign`/`fail` use `STAGE_COMMANDS`; `complete` is atomic; **BYPASS**: `CONFIRM_HOME_COLLECTION` blocked on `/actions` **but NOT on `/transition`** | Lacks rate limit; detail page properly wrapped in `<RequireAnyPermission>` | No driver/route/time-slot assignment on `assign`; no bag-count/photo proof on collection |
| **Orders List & Detail** | `/actions` & `/transition` generic adapters | **`GET /api/v1/orders/[id]` has NO RBAC check**; unbounded `limit`; `/actions` & `/transition` lack CSRF & rate limit | Floor worklist sort mismatch (`customer_name`, `total_items`, `status`) between `stage-worklist-query.service.ts` and `orders/route.ts` |

---

## 2. Ranked Findings & Recommendations

### CRITICAL

1. **`ItemProcessingService.markItemComplete` treats `pending` items as ready — premature `COMPLETE_PROCESSING`**
   - **Files:** `web-admin/lib/services/item-processing-service.ts:304-306,335,373`
   - **Issue:** `allItemsReady` checks `item.item_status === 'ready' || item.item_status === 'pending'`. Completing 1 item on a multi-item order while all others are `pending` auto-completes the order's processing stage. Also `idempotencyKey: item-auto-ready:${tenantId}:${orderId}` omits `stateVersion`, breaking QA-fail rework loops.
   - **Recommendation:** Remove `|| item.item_status === 'pending'` and append `:${available.stateVersion}` to the idempotency key.
   - **[YOUR NOTE]:** 

2. **`CONFIRM_PICKUP` bypassed on both `/actions` and `/transition`**
   - **Files:** `web-admin/app/api/v1/orders/[id]/actions/route.ts:70-75`, `transition/route.ts:98-100`
   - **Issue:** Allows skipping `completePickup()` (`pickup-completion.service.ts:413`), bypassing `org_wf_release_mst` fulfillment, `PICKUP_PROOF` locking, `allow_direct_counter_pickup`, and CSRF.
   - **Recommendation:** Add `staff-pickup-command-guard.ts` blocking `CONFIRM_PICKUP` on both `/actions` and `/transition`.
   - **[YOUR NOTE]:** 

3. **`CONFIRM_HOME_COLLECTION` bypassed on `/transition`**
   - **Files:** `web-admin/app/api/v1/orders/[id]/transition/route.ts:98-100`
   - **Issue:** Leaves `physical_intake_status` and `received_at` unstamped.
   - **Recommendation:** Add `isStaffHomeCollectionBypassAction(actionCode)` guard to `/transition`.
   - **[YOUR NOTE]:** 

---

### HIGH

4. **Assembly tracks order lines instead of garment pieces + `current_load` race/leak**
   - **Files:** `web-admin/lib/services/assembly-service.ts:254-316,386-426,545-625,1284-1329,1679-1720`
   - **Issue:**
     - `createAssemblyTask` inserts 1 `org_asm_items_dtl` row per line (not per piece) — scanning 1 of 5 shirts marks all 5 scanned.
     - `startAssemblyTask` increments `org_asm_locations_mst.current_load` non-atomically *before* checking if task is already `IN_PROGRESS`/`COMPLETE`, and never decrements `current_load` on completion/release.
     - `GET /api/v1/assembly/tasks/[taskId]` mutates DB (`ensureAssemblyItemsForTask` INSERT + `syncTaskItemCounters` UPDATE).
     - `getAssemblyDashboard` runs 5 sequential counts, uses server-local `setHours(0,0,0,0)`, and counts `task_status = 'READY'` while completion writes `'COMPLETE'`.
     - Multi-table writes in `createAssemblyTask`, `performQA`, and `packOrder` are non-transactional.
   - **Recommendation:** Move Assembly to piece-level items, fix atomic `current_load` increment/decrement, remove writes from `GET`, wrap mutations in transactions, and unify completion via `STAGE_COMMANDS`.
   - **[YOUR NOTE]:** 

5. **Double-transition race on Packing Detail + legacy `/transition` still wired in QA, Packing, Assembly**
   - **Files:** `web-admin/app/dashboard/packing/[id]/page.tsx:169-181`, `qa/[id]/page.tsx:151,182`, `src/features/assembly/ui/assembly-task-modal.tsx:65`
   - **Issue:** `packing/[id]/page.tsx` calls `batch-update` (which auto-runs `COMPLETE_PACKING`) and immediately calls legacy `/transition`. QA and Packing also show duplicate transition buttons alongside `WorkflowActionBar`.
   - **Recommendation:** Remove legacy `useOrderTransition` calls from QA, Packing, and Assembly; route exclusively through `WorkflowActionBar` / `STAGE_COMMANDS`.
   - **[YOUR NOTE]:** 

6. **Missing CSRF across 12+ stage mutation routes + zero rate-limiting on stage commands**
   - **Files:** `actions/route.ts`, `transition/route.ts`, `items/[itemId]/{step,complete}/route.ts`, all 8 `assembly/tasks/*` & `exceptions/*` routes, `workflow-stage-command-route.ts`
   - **Recommendation:** Enforce `validateCSRF(request)` (with `usesBearerAuthentication` exemption where mobile drivers apply) and `checkAPIRateLimitTenant(tenantId)` consistently.
   - **[YOUR NOTE]:** 

7. **Unbounded `limit` on `GET /api/v1/delivery/routes` + missing `<RequireAnyPermission>` on 5 stage detail pages**
   - **Files:** `app/api/v1/delivery/routes/route.ts:28`, `dashboard/{processing,assembly,qa,packing,ready}/[id]/page.tsx`
   - **Recommendation:** Clamp `limit <= 100` and wrap all 5 detail pages in `<RequireAnyPermission permissions={[ORDERS_PERMISSIONS.READ]}>`.
   - **[YOUR NOTE]:** 

---

### MEDIUM & LOW

- **Explicit `tenant_org_id` missing on nested joins:** `delivery-route-query.service.ts:284`, `item-processing-service.ts:292`, `assembly-service.ts` (8 locations) — add explicit `tenant_org_id` predicates per CRITICAL RULE #4.
- **Sequential DB loops on every worklist load:** `stage-worklist-query.service.ts:265-298` runs `for (const pair of profilePairs) await loadSemanticArtifactForScope(pair)` sequentially; cache or batch with `Promise.all`.
- **Floor worklist sort mismatch:** `stage-worklist-query.service.ts:192-223` vs `orders/route.ts:388-406` scrambles `customer_name`, `total_items`, `status` sorting.
- **Delivery API polish:** Add `usesBearerAuthentication` CSRF check and UUID validation + header `Idempotency-Key` support on `delivery/stops/[stopId]/complete/route.ts`.
- **[YOUR NOTE]:** 
