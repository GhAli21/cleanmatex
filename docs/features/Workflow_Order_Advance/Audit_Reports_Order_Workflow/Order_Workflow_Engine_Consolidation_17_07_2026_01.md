# Order Workflow Engine Consolidation Analysis

**Document ID:** Order_Workflow_Engine_Consolidation_17_07_2026_01  
**Date:** 17 July 2026  
**Type:** Analysis and recommendations only (no code or schema changes)

---

## 1. Document control

| Field | Value |
|-------|-------|
| Title | CleanMateX Workflow Engine Consolidation Analysis |
| Starting evidence | `docs/Audit_Reports/Order_Workflow/Order_Workflow_Current_17_07_2026_01.md` |
| Verification | Executable code, migrations, local DB function definitions, API/UI callers, tests |
| Local DB note | Local `org_orders_mst` empty; production drift/template usage **not measured** — discovery SQL provided |
| Exclusions | Implementation, migrations, settings edits |

---

## 2. Scope and sources

**In scope:** Legacy vs Enhanced transition engines, selection logic, callers, status fields, vocabulary, templates, gates, permissions, audit, migration options.

**Primary sources verified:**
- `web-admin/lib/services/workflow-service.ts`, `workflow-service-enhanced.ts`
- `web-admin/app/api/v1/orders/[id]/transition/route.ts`
- `web-admin/lib/config/workflow-config.ts`
- `supabase/migrations/0023_*.sql`, `0075_*.sql`, `0130_*.sql`, `0018_*.sql`
- Local live `cmx_ord_execute_transition` definition (MCP read)
- Caller grep across `web-admin/**/*.{ts,tsx}`

**Starting report corrections (verified):**
1. Cancel/return RPCs **do** dual-write `status` + `current_status` (`0130`); only `cmx_ord_execute_transition` omits `status`.
2. Screen contracts for cancel/return were added in `0130` (not only `0075`).
3. Route enters Enhanced whenever `screen` is set **and** `useOldWfCodeOrNew !== false` (including `undefined`); env default false causes most UI screens to pass `false` and stay on Legacy at the route layer.
4. Direct writers exist that bypass **both** engines (`batch-update` auto-ready).

---

## 3. Verified current state

Two transition engines coexist behind one HTTP endpoint. **Default production-safe posture in code is Legacy** (`NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM` absent/false). Cancel and customer-return dialogs **force Enhanced**. Delivery POD and several APIs **always call Legacy** `WorkflowService.changeStatus`. Enhanced’s full path adds app-layer gates but writes **`current_status`/`current_stage` only** on normal stage transitions, creating dual-column drift risk. Screen-contract stage permission codes (`orders:preparation:complete`, etc.) are **not seeded** into RBAC; enabling Enhanced stage transitions would fail permission checks for normal roles.

---

## 4. Legacy engine

| Area | Legacy |
|------|--------|
| Entry point | `WorkflowService.changeStatus` / `transitionOrder` |
| Transition authority | Template edges via `cmx_order_transition` + `cmx_validate_transition` |
| Next-status calculation | Caller supplies `toStatus` |
| Validation location | DB function (edges, rack gate for ready) |
| Database function | `cmx_order_transition` |
| Status fields written | `status` **and** `current_status` (+ stage/timestamps per branch) — `0023` |
| History written | `log_order_action` / STATUS_CHANGE via RPC |
| Permission enforcement | API `orders:transition` (route); not stage-specific in RPC |
| Feature/config | Workflow templates, tenant template assignment |
| Idempotency | Not in `changeStatus` RPC call |
| Optimistic concurrency | Not passed from `changeStatus` |
| Error behavior | `{ success:false, error, blockers? }` |
| Main callers | Transition fallback; delivery POD; confirm-intake; public confirm-received; PATCH status; bulk-status; item auto-ready; Enhanced when flag false |
| Test coverage | `workflow-service.test.ts`; SQL `workflow_functions.test.sql` |

Evidence: `workflow-service.ts:68-169`; `0023_workflow_transition_function.sql:253-317`.

---

## 5. Enhanced engine

| Area | Enhanced |
|------|----------|
| Entry point | `WorkflowServiceEnhanced.executeScreenTransition` |
| Transition authority | Screen membership + app rules; **not** template edges on write |
| Next-status calculation | `input.to_status` or hard-coded `resolveNextStatus(screen, flags)` |
| Validation location | App (flags, settings soft-fail, pieces, QA input, cancel disposition) + basic DB integrity |
| Database function | `cmx_ord_execute_transition`; cancel → `cmx_ord_canceling_transition`; return → `cmx_ord_returning_transition` |
| Status fields written | Execute: **`current_status`/`current_stage` only** (verified live function). Cancel/return: **both** `status` and `current_status` |
| History written | `org_order_history` STATUS_CHANGE (cancel/return also ORDER_CANCELLED / CUSTOMER_RETURN per `0133`) |
| Permission enforcement | API `orders:transition` **plus** screen-contract permission list via `getUserPermissions` (role **defaults** only) |
| Feature/config | HQ `USE_NEW_WORKFLOW_SYSTEM`, plan flags `*_workflow`, settings `workflow.{screen}.enabled`, template **flags** RPC |
| Idempotency | `p_idempotency_key` on execute/cancel/return |
| Optimistic concurrency | `p_expected_updated_at` |
| Error behavior | Typed errors (Validation/Permission/FeatureFlag/QualityGate/…) |
| Main callers | Transition when `screen` + flag≠false; cancel/return force true; Enhanced internal fallback to Legacy |
| Test coverage | tenant-isolation, cancel-guard (often exercises Legacy fallback when HQ flag empty) |

Evidence: `workflow-service-enhanced.ts:120-452,672-709`; live `cmx_ord_execute_transition`; `0130_cmx_ord_canceling_returning_functions.sql`.

### Engine comparison matrix

| Area | Legacy | Enhanced |
|------|--------|----------|
| Entry point | `changeStatus` | `executeScreenTransition` |
| Transition authority | Template edges | Screen + app; write ignores edges |
| Next-status calculation | Caller | `resolveNextStatus` / input |
| Validation location | DB | App + basic DB |
| Database function | `cmx_order_transition` | `cmx_ord_execute_transition` (+ cancel/return) |
| Status fields written | `status` + `current_*` | Execute: `current_*` only; cancel/return: both |
| History written | Yes | Yes (+ cancel/return action types) |
| Permission enforcement | `orders:transition` | + screen codes (often unseeded) |
| Feature/config dependencies | Templates | Env/HQ/plan/settings/flags |
| Idempotency | No | Yes (keyed) |
| Optimistic concurrency | No | Yes |
| Error behavior | Soft result object | Thrown typed errors |
| Main callers | Default + delivery + direct APIs | Forced cancel/return; opt-in screens |
| Test coverage | Unit + SQL | Partial unit |

---

## 6. Runtime selection logic

### Decision table

| Runtime condition | Engine selected | Evidence | Confidence |
|-------------------|-----------------|----------|------------|
| Env absent / false; UI passes `useOldWfCodeOrNew: false`; `screen` set | **Legacy** at route (never enters Enhanced) | `workflow-config.ts:20-29`; `transition/route.ts:51`; screen pages | High |
| Env true; UI passes `true`; `screen` set | Route → Enhanced; Enhanced new path if options true | Same | High |
| `screen` set; `useOldWfCodeOrNew` **undefined** | Route treats as Enhanced entry (`!== false`) | `transition/route.ts:51` | High |
| `screen` omitted (processing-table mark-ready) | **Legacy** always | `processing-table.tsx:469-478` | High |
| Cancel / return dialogs | Enhanced forced (`true`) | `cancel-order-dialog.tsx:102`; `customer-return-order-dialog.tsx:72` | High |
| Enhanced entered but internal flag false | Enhanced wrapper → **Legacy** `changeStatus` (cancel disposition still applied) | `workflow-service-enhanced.ts:180-198` | High |
| HQ `USE_NEW_WORKFLOW_SYSTEM` missing when options omit flag | Internal default **false** → Legacy | `getFeatureFlag` fail-safe false `:503` | High |
| Plan flag off for assembly/qa/packing | Enhanced new path **throws** FeatureFlagError | `:266-274` | High |
| Direct `PATCH /api/orders/[orderId]/status` | Legacy | `status/route.ts` | High |
| Bulk status | Legacy | `bulk-status/route.ts` | High |
| Delivery `capturePOD` | Legacy `changeStatus` | `delivery-service.ts:647-654` | High |
| Prep legacy complete API | Neither engine — DB/action path | prep complete route | High |
| `batch-update` all items ready | **Bypass both** — direct update | `batch-update/route.ts:331-342` | High |
| Confirm physical intake / public confirm-received | Legacy | respective routes | High |

### Frontend vs backend mismatch risk

| Risk | Detail |
|------|--------|
| List filter vs transition | `useScreenOrders` treats `useOldWfCodeOrNew !== false` as “new filters”. Pages pass env boolean consistently today; if a caller omits the field, **lists use contracts while transitions may use Legacy**. |
| Naming confusion | Field `useOldWfCodeOrNew`: **true means use new path**. Easy caller mistake. |
| Ready screen vs contract key | UI uses screen `ready` / `delivery`; contracts define `ready_release` / `driver_delivery`. List filters may not match contract keys for those screens. |

---

## 7. Caller inventory

| Caller | Business action | Engine | Screen? | Status written | Importance |
|--------|-----------------|--------|---------|----------------|------------|
| Prep FastItemizer | Prep → processing | Config | Yes `preparation` | Via engine | Critical |
| Processing detail | Complete stage | Config | Yes `processing` | Via engine | Critical |
| Processing-table quick ready | → ready | **Legacy always** | No | Dual (legacy) | High |
| Assembly / QA / Packing / Ready detail | Stage advance | Config | Yes | Via engine | High |
| Delivery page mark delivered | → delivered | Config | Yes `delivery` | Via engine | High |
| DeliveryService.capturePOD | POD complete | **Legacy** | No | Dual | Critical |
| CancelOrderDialog | Cancel | **Enhanced forced** | `canceling` | Dual (cancel RPC) | Critical |
| CustomerReturnOrderDialog | Return | **Enhanced forced** | `returning` | Dual | High |
| OrderActions | Manual status | Config (needs contract) | Optional | Via engine | Medium |
| confirm-physical-intake | draft → next | Legacy | No | Dual | Medium |
| public confirm-received | Intake confirm | Legacy | No | Dual | Medium |
| PATCH `/api/orders/.../status` | Direct status | Legacy | No | Dual | Legacy/uncertain |
| POST `/api/orders/bulk-status` | Bulk | Legacy | No | Dual | Medium |
| ItemProcessingService auto-ready | All items ready | Legacy via `transitionOrder` | No | Dual | High |
| batch-update auto-ready | All items ready | **Bypass** | — | Direct both fields | High |
| Prep complete API / server action | Prep done | Bypass/legacy DB | — | processing | Medium |
| submit-order / OrderService create | Initial status | Neither (create path) | — | Both set at create | Critical |
| Background jobs | — | **Not found** | — | — | — |

**Always Legacy:** no-screen transition, delivery POD, direct/bulk status APIs, most default-env screen transitions.  
**Always Enhanced (forced):** cancel, return dialogs.  
**Config-dependent:** dashboard stage screens when env true.  
**Bypass both:** `batch-update` direct update; prep complete side paths; create-time status.

---

## 8. Status source-of-truth analysis

| Field | Writers | Readers | Engine behavior | Current authority | Drift risk |
|-------|---------|---------|-----------------|-------------------|------------|
| `current_status` | Create; both engines; cancel/return; batch-update | Orders list `status_filter`; transition from; screens; state API | Both write | **De facto list/UI authority** | Medium |
| `status` | Create; Legacy RPC; cancel/return; batch-update; **not** execute RPC | Fallback in transition (`current \|\| status`); some older code | Legacy dual; Enhanced execute skips | Compatibility / secondary | **High** if Enhanced execute used |
| `current_stage` | Create; Enhanced execute (= to status); Legacy branches | Filters secondary | Often mirrored to status | Weak / overloaded | Medium |
| `preparation_status` | Create; Enhanced `markPreparationCompleted` | Prep UI | Side field | Prep-specific | Low |
| `physical_intake_status` | Create; confirm-intake | Intake flows | Outside stage engine | Intake | Low |
| Item/piece status | Item/piece services | Processing/assembly | Parallel to order | Item/piece SoT | Medium |
| Delivery stop/route | DeliveryService | Delivery UI | Separate from order | Delivery SoT | Low if order not updated |
| `payment_status` | Finance services | Ready UI | Not updated by engines | Finance SoT | — |

**Answers:**
- Legacy updates **both** `status` and `current_status` — yes.
- Enhanced execute updates **only** `current_status`/`current_stage` — yes (verified live function).
- Screen lists filter **`current_status`** (`orders/route.ts:349-358`).
- Different screens **can** disagree if something still reads `status` after Enhanced-only writes.
- Sync logic / triggers aligning the two columns: **not found**.
- **Canonical recommendation:** `current_status` for workflow stage; keep dual-writing `status` as compatibility alias until all readers migrate.
- `current_stage`: keep as projection (today often equal to status); do not treat as independent SoT until product defines stage≠status.

---

## 9. Vocabulary compatibility

| Literal | Written by | Read by | DB/template | Meaning | Concern |
|---------|------------|---------|-------------|---------|---------|
| `preparing` | Create Quick Drop | Prep screen/contract | Comment mentions; **not** in seeded stage lists | Prep queue | Canonical prep status |
| `preparation` | Enum TS; some item sync in `0023` | workflow.ts meta | Not seeded as order stage | Same intent as preparing | Alias / drift |
| `processing` | Create; transitions | Processing | In STANDARD/ASSEMBLY templates | Plant work | OK |
| `assembly`/`qa` | Transitions | Screens | WF_ASSEMBLY_QA only | Optional stages | Template-dependent |
| `packing` | UI/Enhanced resolve | Packing screen | **No seeded template stage** | Optional pack | Enhanced can select packing; Legacy edge often missing |
| `ready` | Transitions | Ready | All templates | Ready for release | OK |
| `out_for_delivery` | Delivery flows | Delivery | WF_PICKUP_DELIVERY | Out | OK |
| `delivered` | Handover/POD | Lists | Terminal in templates | Done | Canonical terminal for laundry |
| `closed` | Retail-only create | Return contract | — | Retail terminal | Keep; ≠ delivered |
| `cancelled` | Cancel/return | — | — | Terminal | OK |
| `draft` | Remote intake | new_order contract | — | Pre-intake | OK |
| `intake` | Stage/legacy create | Contracts/legacy filters | Template first stage | Intake | Dual use as status+stage |
| `pending`/`completed` | order-types.ts | Possible filters | Not workflow.ts | UI shorthand | Do not use as engine status |
| `issue_to_solve`/`reprocess` | Template only | — | WF_ISSUE_REPROCESS | Issue path | Template-only; TS enum gap |

**Canonical vocabulary (recommended):**  
`draft | intake | preparing | processing | assembly | qa | packing | ready | out_for_delivery | delivered | closed | cancelled`

**Compatibility map:**  
`preparation` → `preparing`; `completed` → `delivered` (laundry) or `closed` (retail); ignore `pending` as workflow status.

---

## 10. Workflow-template dependencies

| Concern | Legacy | Enhanced | Compatibility risk |
|---------|--------|----------|--------------------|
| Transition edges | Enforced in RPC | **Bypassed** on execute | Enhanced can write statuses not on template graph |
| Next status | Caller must match edge | `resolveNextStatus` uses **flags** from template stages | Can choose `packing` when no packing stage → Legacy would reject same move |
| Stage enablement | Implicit in edges | `cmx_ord_order_workflow_flags` | Shared concept; different enforcement |
| Prep / packing in seeds | No preparing/packing stages in live seeds | Screens expect preparing/packing | Prep uses `preparing` status outside template graph |
| Existing orders | Bound via `workflow_template_id` | Uses flags from order template or WF_SIMPLE fallback | Null template → SIMPLE flags |
| Template versions | `sys_ord_workflow_template_versions` exists | Not driving execute RPC | Uncertain runtime use |
| Changing template | Affects new validations for Legacy | Affects flags for Enhanced next-status | Mid-flight orders can diverge |

**Live seeded templates (local DB):**

| Code | Stages |
|------|--------|
| WF_SIMPLE | intake > ready > delivered |
| WF_STANDARD | intake > processing > ready > delivered |
| WF_ASSEMBLY_QA | intake > processing > assembly > qa > ready > delivered |
| WF_PICKUP_DELIVERY | intake > processing > ready > out_for_delivery > delivered |
| WF_ISSUE_REPROCESS | … + issue_to_solve > reprocess |

### Production discovery SQL (read-only)

```sql
-- Tenant template assignments
SELECT tenant_org_id, template_id, is_default
FROM org_tenant_workflow_templates_cf;

-- Orders by template
SELECT workflow_template_id, COUNT(*)
FROM org_orders_mst GROUP BY 1;

-- Null template active orders
SELECT COUNT(*) FROM org_orders_mst
WHERE workflow_template_id IS NULL
  AND COALESCE(current_status, status) NOT IN ('delivered','cancelled','closed');

-- Status drift
SELECT COUNT(*) AS drift
FROM org_orders_mst
WHERE status IS DISTINCT FROM current_status;

-- Status histogram
SELECT COALESCE(current_status, status) AS s, COUNT(*)
FROM org_orders_mst GROUP BY 1 ORDER BY 2 DESC;

-- Unsupported vs canonical set
SELECT DISTINCT current_status FROM org_orders_mst
WHERE current_status NOT IN (
  'draft','intake','preparing','preparation','processing','sorting','washing',
  'drying','finishing','assembly','qa','packing','ready','out_for_delivery',
  'delivered','closed','cancelled'
);

-- Ready with balance (adjust column names to live financial snapshot)
SELECT id, order_no, current_status, payment_status,
       total_amount, total_paid_amount
FROM org_orders_mst
WHERE current_status = 'ready'
  AND COALESCE(total_amount,0) - COALESCE(total_paid_amount,0) > 0.001;

-- Out for delivery without stop
SELECT o.id FROM org_orders_mst o
WHERE o.current_status = 'out_for_delivery'
  AND NOT EXISTS (
    SELECT 1 FROM org_dlv_stops_dtl s
    WHERE s.order_id = o.id AND s.stop_status_code NOT IN ('cancelled','delivered')
  );
```

---

## 11. Gate comparison

| Gate | Legacy | Enhanced | UI only | DB enforced | Bypass path |
|------|--------|----------|---------|-------------|-------------|
| Template edge | Yes | No | — | Legacy RPC | Enhanced execute; batch-update; direct PATCH |
| Screen membership | No | Yes | List filters | Contract SQL | No-screen callers |
| Prep completion | Partial | markPreparationCompleted | FastItemizer | prep fields | Legacy prep API |
| Piece scanning | No | Assembly screen | — | App | Legacy assembly path |
| Assembly complete | canMoveToReady unused | Quality gate if flag | — | App | Legacy to ready |
| QA inspection data | No | If action=pass | — | App | Legacy QA |
| Blocking issues | canMoveToReady unused | Ready quality gate | — | App | Legacy |
| Packing | — | resolve may skip | Packing UI | — | Flags false |
| Rack for ready | Yes | Not in execute RPC | Processing UI | Legacy RPC | Enhanced execute; batch-update |
| Payment before release | No | No | Ready page | No | Direct transition / POD |
| B2B credit | Create-time | No on transition | Account receipt link | Create | — |
| Delivery / POD | Legacy changeStatus | Optional screen | Delivery UI | Stop table | POD without transition failure handling soft |
| Cancel disposition | Via Enhanced entry only | Yes (before fork) | Dialog | App + unwind | Legacy cancel without Enhanced entry |
| Return reason | Enhanced | Yes | Dialog | App | — |
| Permission | orders:transition | + screen codes | — | App | Direct status weaker auth |
| Tenant isolation | RPC + filters | Order fetch by id (tenant from order) | — | Mixed | Must verify all RPCs |
| Plan/feature | No | Yes (new path) | — | App | Legacy path |

**Material bypasses:** processing-table (no screen), delivery POD (Legacy, no payment gate), batch-update (direct write), PATCH/bulk status, Enhanced execute skipping rack + template edges, Ready payment gate UI-only.

---

## 12. Permissions and security

| Action | Legacy | Enhanced | Seeded? | Backend | DB |
|--------|--------|----------|---------|---------|-----|
| Transition API | `orders:transition` | same + screen list | `orders:transition` yes | requirePermission | RLS on tables |
| Prep complete (contract) | — | `orders:preparation:complete` | **No seed found** | Enhanced check | No |
| Processing/assembly/qa/packing/ready/delivery stage codes | — | screen codes | **No seed found** | Enhanced check | No |
| Cancel | — | `orders:cancel` | Yes (`0035`) | Enhanced + dialog | Cancel RPC |
| Return | — | `orders:return` | Yes (`0131`) | Enhanced | Return RPC |
| Collect payment | N/A | N/A | Yes | collect-payment API | — |
| KEEP_ON_ACCOUNT | — | `orders:approve_refund` | Yes | hasPermissionServer | — |
| Direct PATCH status | Session only | — | — | Weak vs transition | — |

**Critical:** Enabling Enhanced full path for stage screens without seeding stage permissions (or remapping them to `orders:transition`) will reject legitimate operators.  
**Also:** `getUserPermissions` reads **`sys_auth_role_default_permissions` only**, not tenant custom role grants — Enhanced permission checks can disagree with real tenant RBAC.

---

## 13. Audit and events

| Behavior | Legacy | Enhanced | Difference/risk |
|----------|--------|----------|-----------------|
| History table | `org_order_history` | Same | Shared |
| Action type | STATUS_CHANGE | STATUS_CHANGE; cancel/return specialized types (`0133`) | Timeline must handle both |
| Before/after | from/to in history | Same | Drift if `status`≠`current_status` in payload vs column |
| Actor | user id | user id | OK |
| Idempotency | No | Key in payload | Replay safer on Enhanced |
| Notifications | ready/cancelled from transition route | Same route emissions | Switching engines OK if route stays |
| Double notify risk | If facade calls both engines | Same | Migration must single-emit |
| Financial unwind | Only when cancel via Enhanced entry | After cancel RPC | Legacy-only cancel skips FN-02 unwind |

---

## 14. Existing-order compatibility

Local DB has **0 orders** — production shape unknown. Conceptual groups:

| Group | Legacy continue? | Enhanced continue? | Normalization needed? |
|-------|------------------|--------------------|-----------------------|
| `status = current_status` | Yes | Yes if screen membership OK | No |
| `status ≠ current_status` | fromStatus prefers current | Uses current | Align `status` ← `current_status` after dual-write fix |
| Null `current_status` | Falls back to `status` | Screen check may fail | Backfill from `status` |
| `preparing` | Prep lists yes; template edges may lack | Prep contract yes | Keep |
| `preparation` | Partial | Cancel contract includes; prep screen may not | Map → preparing |
| `packing` without template stage | Legacy edge fail | Screen OK; flags false often | Template or disable packing |
| `out_for_delivery` + active stop | POD Legacy | delivery screen | Keep Legacy POD until migrated |
| Ready + outstanding balance | Transition allows | Transition allows | UI gate only — preserve behavior consciously |
| Split children | Status engines unaware of parent | Same | Separate editability rules |
| Quick Drop preparing | Prep path | Prep path | OK |
| Cancelled/delivered/closed | Terminal | Return only from delivered/closed | Do not reopen via engine |

---

## 15. Production dependency matrix

| Dependency | Legacy | Enhanced | Both | Unknown |
|------------|-------:|---------:|-----:|--------:|
| Preparation | ✓ (default) | ✓ (if flag) | ✓ | |
| Processing | ✓ | ✓ | ✓ | |
| Assembly | ✓ | ✓ | ✓ | |
| QA | ✓ | ✓ | ✓ | |
| Packing | | ✓ UI | | template gap |
| Ready | ✓ | ✓ | ✓ | |
| Delivery POD | ✓ | | | |
| Collection (Ready UI) | | | payment UI | |
| Cancellation | | ✓ forced | disposition | |
| Return | | ✓ forced | | |
| Split | neither (OrderService) | | | |
| Notifications | | | ✓ route | |
| Audit timeline | | | ✓ | |
| Tests | ✓ heavier | ✓ partial | | |
| External clients | | | | ✓ PATCH usage |

**Blocks immediate removal of Legacy:** default env, delivery POD, no-screen callers, direct/bulk APIs, item auto-ready, dual-write safety, template-edge behavior operators rely on.  
**Blocks immediate sole use of Enhanced:** unseeded stage permissions, status column omit, packing/template mismatch, permission source (defaults only), missing rack on execute.

---

## 16. Consolidation options

### Option A — Legacy authoritative; Enhanced UI metadata only

| Criterion | Assessment |
|-----------|------------|
| Production safety | High short-term |
| Existing-order compatibility | High |
| Code changes | Medium (strip Enhanced writes; keep cancel?) |
| Database changes | Low |
| Migration complexity | Low |
| Rollback | Easy |
| Testing | Moderate |
| Tenant impact | Low |
| Long-term maintainability | **Poor** (loses cancel disposition path quality, app gates) |
| Main risks | Loses FN-02 cancel path unless specially kept; duplicates remain |

### Option B — Enhanced authoritative immediately

| Criterion | Assessment |
|-----------|------------|
| Production safety | **Low** today |
| Existing-order compatibility | Medium–low (drift, packing, permissions) |
| Code changes | High |
| Database changes | Medium (dual-write fix, perms, templates) |
| Migration complexity | High |
| Rollback | Hard if drift already written |
| Testing | High |
| Tenant impact | High if flag flipped |
| Long-term maintainability | Good **after** prerequisites |
| Main risks | Unseeded perms; `status` stale; template bypass; POD still Legacy |

### Option C — Unified facade (recommended)

Single application command (e.g. `OrderTransitionService.transition`) used by all callers; internally routes Legacy/Enhanced by explicit policy; later makes Enhanced the only writer **after** dual-write + permission + caller migration.

| Criterion | Assessment |
|-----------|------------|
| Production safety | **Highest** |
| Existing-order compatibility | High (behavior preserved initially) |
| Code changes | Medium staged |
| Database changes | Deferred then controlled |
| Migration complexity | Medium (phased) |
| Rollback | Flag/policy per tenant |
| Testing | Incremental |
| Tenant impact | Controlled |
| Long-term maintainability | Best |
| Main risks | Facade half-adopted; bypass writers if not closed |

### Option D — Compatibility dual-write wrapper on Legacy RPC

Make `cmx_order_transition` the only writer; Enhanced becomes validation preprocessor calling Legacy write. Safer write path than B, but keeps template-edge rigidity and underuses Enhanced execute.

| Criterion | Assessment |
|-----------|------------|
| Production safety | High after wiring |
| Maintainability | Medium (two validation styles) |
| Main risks | Template missing prep/packing edges blocks UI flows |

---

## 17. Expert decision

**Selected option: C — Unified workflow facade**, with **Enhanced becoming the long-term authoritative engine** only after prerequisites below. Interim write authority remains **Legacy RPC** (or Enhanced execute patched to dual-write) for stage moves; **cancel/return stay on dedicated Enhanced RPCs**.

| Decision | Choice |
|----------|--------|
| Authoritative long-term engine | Enhanced (app validation + atomic RPC), after fixes |
| Interim write for stage moves | Legacy `cmx_order_transition` **or** fixed dual-write execute |
| Facade required? | **Yes** — single entry; no new direct status writers |
| Canonical status field | `current_status` |
| Canonical stage field | `current_stage` (projection; align with status until product splits) |
| Legacy `status` | Compatibility alias — **dual-write forever until reader audit = 0** |
| Canonical vocabulary | Lowercase set in §9; map `preparation`→`preparing` |
| Templates role | Source of **allowed edges + stage flags**; Enhanced must enforce edges (or flags-only with explicit product sign-off) |
| Screen contracts role | Screen membership + UX filters; permissions remapped to seeded codes |
| Transition validation | Facade → Enhanced rules + template edge check → single writer |
| Financial release validation | Move Ready outstanding-balance check into facade (not UI-only) as policy |
| Direct status APIs | Deprecate behind facade; require `orders:transition`; block bulk without audit |
| Existing active orders | No mass rewrite day-1; normalize only measured drift; continue via facade |

**Why safest for CleanMateX:** Default today is Legacy; cancel/finance already depend on Enhanced entry; flipping Enhanced alone breaks permissions and drifts `status`. Facade preserves behavior while closing bypasses and enabling tenant-scoped rollout.

---

## 18. Phased migration plan

| Phase | Goal | Required changes | Validation | Rollback | Exit criteria |
|-------|------|------------------|------------|----------|---------------|
| **0** Evidence | Know production shape | Run discovery SQL; inventory env/HQ flags; caller telemetry plan | Query results reviewed | N/A | Drift %, templates, flag values known |
| **1** Observability | See engine choice | Structured logs: engine, screen, from/to, template, tenant, caller | Log sampling | Disable logs | ≥95% transitions logged |
| **2** Facade | One API surface | Introduce facade; route existing engines; ban new bypasses | Unit + API tests | Facade → old route | All web-admin callers use facade |
| **3** Canonical state | Dual-write + vocab | Patch execute to dual-write `status`; map preparing; reader audit | Drift metrics ↓ | Stop patch | Drift rate below threshold; dual-write verified |
| **4** Shadow | Compare engines | Evaluate Enhanced allow/deny without write; log mismatches | Shadow dashboard | Disable shadow | Mismatch rate acceptable |
| **5** Rollout | Tenant flip | Per-tenant “writer=enhanced” flag; pilots | Pilot KPIs | Flip tenant back to Legacy writer | Pilot stable N days |
| **6** Caller removal | No Legacy-only entries | Migrate POD, processing-table, PATCH, bulk, batch-update | E2E suite | Re-enable Legacy adapters | Zero Legacy-direct callers |
| **7** Retire | Remove Legacy code | Compatibility wrapper period; later drop RPC | Usage metrics = 0 | Restore wrapper from archive | 30–90 days zero Legacy invocations |

---

## 19. Database migration safety

**Approach (no SQL executed here):**
1. Measure drift and illegal literals before any UPDATE.
2. Backfill `current_status` from `status` where null; then dual-write going forward.
3. Normalize `preparation`→`preparing` only where no open Legacy edge depends on literal (measure first).
4. Do not delete template edges; **add** missing prep/packing edges if product requires those screens.
5. Assign default template to null-template **active** orders only after confirming tenant default.
6. Terminal orders (`delivered`/`cancelled`/`closed`): leave unless reporting requires.
7. Split children: update independently; never cascade parent status blindly.
8. Delivery-in-progress: migrate POD writer before flipping those tenants.
9. Ready with balance: do not auto-transition; preserve financial state.
10. History: append-only; never rewrite STATUS_CHANGE rows; optional annotation payload for normalization jobs.
11. RLS: all backfills filter `tenant_org_id`; batch by tenant.
12. Migrations idempotent; batched (`LIMIT` loops); reversible only by compensating UPDATEs (no silent DROP).

Use §10 read-only queries before any write migration.

---

## 20. Rollout and rollback

| Control | Definition |
|---------|------------|
| Flags | Keep `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM`; add server `workflow_writer=legacy\|enhanced` per tenant; shadow `workflow_shadow_enhanced` |
| Telemetry | engine, writer, shadow_delta, gate_code, tenant, order_id, screen |
| Error thresholds | e.g. transition 5xx > 1% or gate reject spike > baseline → auto rollback tenant |
| Rollback | Flip tenant writer to legacy; facade remains |
| In-flight transitions | Optimistic lock failures → client retry; no dual apply |
| Double history | Facade single writer only |
| Double notifications | Emit only in facade/route once |
| Double financial unwind | Unwind remains idempotent; cancel only via cancel RPC path |

---

## 21. Test and verification matrix

| Scenario | Legacy expected | Target (facade→enhanced writer) | Must stay compatible? | Test location |
|----------|-----------------|----------------------------------|----------------------|---------------|
| Itemized create → processing | Dual status processing | Same | Yes | submit-order + unit |
| Quick Drop → preparing → processing | Prep then processing | Same | Yes | prep E2E |
| Processing → ready (STANDARD) | Edge + rack | Same + dual-write | Yes | workflow SQL + API |
| ASSEMBLY_QA path | Edges enforced | Flags + **edges** | Yes | template tests |
| Packing enabled | Often blocked by edge | Explicit product rule | Decide | packing E2E |
| QA reject → processing | Allowed | Same + issue | Yes | qa page E2E |
| Ready deliver with balance | UI blocks | Facade policy same | Yes | ready E2E |
| POD deliver | Legacy changeStatus | Facade same result | Yes | delivery tests |
| Cancel with paid | Disposition + unwind | Same | Yes | cancel-guard |
| Return delivered | Returning RPC | Same | Yes | cancel-return E2E |
| Split child | Parent link | Unaffected | Yes | split API |
| Drifted status≠current | Prefers current | Dual-write heals | Yes | data fixture |
| Concurrent transition | Last write / error | expected_updated_at | Yes | concurrency test |
| Idempotent cancel | Soft | Keyed | Yes | cancel tests |
| Notify ready/cancelled | Once | Once | Yes | transition route |
| RLS cross-tenant | Denied | Denied | Yes | enhanced isolation test |

---

## 22. Risk register

| ID | Risk | Evidence | Prob. | Impact | Mitigation |
|----|------|----------|-------|--------|------------|
| R01 | Unknown prod flag values | Env default false only | High | High | Phase 0 inventory |
| R02 | status/current_status drift | Execute omits status | High if Enhanced on | High | Dual-write before flip |
| R03 | Mixed vocabulary | preparing vs preparation | Med | Med | Compatibility map |
| R04 | Direct status / batch-update bypass | batch-update:331 | High | High | Facade + ban direct |
| R05 | Stage perms not seeded | Screen SQL vs no perm seed | **High** | **Critical** | Remap to `orders:transition` or seed |
| R06 | getUserPermissions ignores tenant roles | enhanced.ts:540-543 | High | High | Use real permission service |
| R07 | UI-only payment gate | ready page | High | Med | Facade policy |
| R08 | Delivery always Legacy | delivery-service:647 | High | Med | Migrate POD to facade |
| R09 | Packing not in templates | Local seed list | High | Med | Add edges or disable UI |
| R10 | Multi-template tenants | 5 templates | Med | Med | Per-tenant shadow |
| R11 | Double history/notify during migration | Dual route risk | Med | Med | Single facade emit |
| R12 | Tests cover one engine | cancel tests often Legacy fallback | High | Med | Dual-path CI matrix |

---

## 23. Unknown production facts

| Unknown | How to verify |
|---------|----------------|
| Deployed `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM` | Inspect hosting env / build |
| HQ `USE_NEW_WORKFLOW_SYSTEM` per tenant | HQ feature-flag API / DB |
| Live status drift % | §10 SQL on prod (read-only) |
| Template assignment distribution | §10 SQL |
| Whether any client uses PATCH/bulk-status | Access logs / APM |
| Tenant custom roles vs default permission mismatch | Compare org role grants vs Enhanced checker |
| Real packing usage | Orders with current_status=packing |

---

## 24. Decision summary

### Current factual state
Legacy is the default stage writer (template edges, dual-column update). Enhanced is forced for cancel/return and optional for screens when flags allow; its normal execute path does not update `status` and enforces unseeded stage permissions. Multiple callers bypass one or both engines.

### Selected consolidation decision
**Option C — Unified facade**, migrate writers carefully toward **Enhanced as long-term authority**, keeping Legacy (or dual-write-compatible RPC) until prerequisites pass.

### Canonical ownership
| Concern | Owner |
|---------|-------|
| Transition entry | Facade service (only) |
| Status field | `current_status` |
| Stage field | `current_stage` (aligned projection) |
| Vocabulary | §9 canonical set |
| Validation | App (Enhanced rules) + template edges |
| Templates | Edges + enablement flags |
| Screen contracts | Membership / UX; permissions remapped |
| Audit | `org_order_history` append-only |

### Do-not-remove-yet list
- `cmx_order_transition` / `cmx_validate_transition`
- `WorkflowService.changeStatus`
- `status` column dual-write
- Direct status endpoints (until replaced)
- Delivery POD Legacy call path
- Cancel/return Enhanced RPCs
- Env/HQ selection flags

### Removal prerequisites (measurable)
1. Facade adoption = 100% of transition callers.  
2. Dual-write active; drift ≈ 0 for active orders.  
3. Stage permissions fixed (seeded or remapped); tenant role checker fixed.  
4. Template edges cover all enabled screens OR packing disabled.  
5. Shadow mismatch below agreed threshold for 14+ days on pilots.  
6. Legacy RPC invocation count = 0 for 30+ days.  
7. Test matrix green for both writer modes then Enhanced-only.

### Immediate next work package
**“Workflow Transition Facade — Design & Caller Map (no cutover)”**: specify facade interface, map every caller in §7, define dual-write patch requirements for `cmx_ord_execute_transition`, decide permission remap vs seed, and produce Phase 0 production SQL results checklist. **Do not implement cutover in that package.**

---

## 25. Key files and symbols

| Path | Symbol / role |
|------|----------------|
| `web-admin/lib/config/workflow-config.ts` | `getWorkflowSystemMode` |
| `web-admin/app/api/v1/orders/[id]/transition/route.ts` | Engine fork |
| `web-admin/lib/services/workflow-service.ts` | `changeStatus` |
| `web-admin/lib/services/workflow-service-enhanced.ts` | `executeScreenTransition`, `resolveNextStatus`, `checkQualityGates` |
| `web-admin/lib/services/delivery-service.ts` | `capturePOD` → Legacy |
| `web-admin/src/features/workflow/ui/processing-table.tsx` | No-screen Legacy ready |
| `web-admin/src/features/orders/ui/cancel-order-dialog.tsx` | Force Enhanced |
| `web-admin/app/api/v1/orders/[id]/batch-update/route.ts` | Bypass writer |
| `supabase/migrations/0023_workflow_transition_function.sql` | Legacy RPC |
| `supabase/migrations/0075_screen_contract_functions_simplified.sql` | Execute + contracts |
| `supabase/migrations/0130_cmx_ord_canceling_returning_functions.sql` | Cancel/return + contract extension |
| `supabase/migrations/0018_workflow_templates.sql` | Template seeds |

---

*Analysis only. No source code, migrations, settings, or tests were modified.*
