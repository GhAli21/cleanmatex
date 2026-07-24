# Order Workflow — Status Fields Inventory

**Document ID:** Order_Workflow_status_fields_17_07_2026_01  
**Date:** 17 July 2026  
**Type:** As-is field inventory (how status columns are defined, written, read, and how they relate)

---

## 1. Document control

| Field | Value |
|-------|-------|
| Scope | Order workflow–related status columns and their usage |
| Evidence | Prisma schema, Supabase migrations, live local DB columns, web-admin services/APIs/UI |
| Related reports | `Order_Workflow_Current_17_07_2026_01.md`, `Order_Workflow_Engine_Consolidation_17_07_2026_01.md` |
| Local DB check | Confirmed `org_orders_mst` columns; **no** `previous_status` on orders |

---

## 2. Executive picture

Order workflow state is **not a single column**. The header carries three overlapping workflow fields (`status`, `current_status`, `current_stage`), plus orthogonal intake/prep/payment fields. Items, pieces, assembly tasks, and delivery stops each have their own status vocabularies.

| Layer | Primary fields | Typical authority today |
|-------|----------------|-------------------------|
| Order workflow stage | `current_status` (lists/transitions), `status` (many badges) | Split / dual |
| Order stage synonym | `current_stage` | Often copy of to-status; at create often `intake` while status already advanced |
| Prep side-channel | `preparation_status` | Prep screens |
| Physical intake | `physical_intake_status` | Intake / remote dropoff |
| Payment | `payment_status` | Finance engine (not workflow RPCs) |
| Item | `item_status` / `item_stage` (+ legacy `status`) | Item processing / Legacy item RPC |
| Piece | `piece_status` / `piece_stage` / `scan_state` / `is_ready` | Piece services |
| Assembly | `task_status` / `qa_status` / asm `item_status` | Assembly service |
| Delivery | `route_status_code` / `stop_status_code` | Delivery service |

**Documented intent (migration `0020`):** `current_status` is the workflow authority; `current_stage` is a compatibility synonym.  
**Runtime reality:** lists and editability use `current_status`; many UIs still display `status`; engines do not always keep them equal.

---

## 3. Order header fields (`org_orders_mst`)

### 3.1 Schema snapshot (local DB)

| Column | Type | Default | Nullable | Index |
|--------|------|---------|----------|-------|
| `status` | text | `'intake'` | YES | (legacy indexes may exist) |
| `current_status` | text | none | YES | `idx_orders_current_status`, transition index |
| `current_stage` | text | none | YES | used as secondary filter param |
| `preparation_status` | varchar | `'pending'` | YES | `idx_orders_preparation_status` |
| `physical_intake_status` | varchar | `'received'` | NO | filtered on list API |
| `payment_status` | varchar | `'pending'` | YES | finance readers |
| `last_transition_at` | timestamptz | none | YES | with `current_status` |
| `last_transition_by` | uuid | none | YES | set by transition RPCs |
| `rejected_from_stage` | text | none | YES | reject flows |
| `previous_status` | — | — | — | **Does not exist** on this table |

Evidence: Prisma `org_orders_mst` (~896–963); migration `0020_orders_workflow_extensions.sql:27–34`; local `information_schema`.

### 3.2 `status`

| Aspect | Detail |
|--------|--------|
| Purpose | Original order status column (pre-workflow extensions) |
| Allowed values (practice) | Overlaps workflow literals; DB default `intake` |
| **Writers** | Order create (`order-service.ts` sets `status` + `current_*`); Legacy `cmx_order_transition` (dual-write); cancel/return RPCs; prep-complete paths; batch-update auto-ready; split child create |
| **Not written by** | Enhanced `cmx_ord_execute_transition` (stage path) |
| **Readers** | Order table badges (`order-table.tsx`, `orders-simple-table.tsx`); `order-actions.tsx` `fromStatus`; public tracking page; some reports; PATCH `/api/orders/[orderId]/status` uses `.status` as from |
| Engine | Legacy + cancel/return yes; Enhanced stage **no** |
| Drift risk | **High** if Enhanced stage path is used — lists show `current_status`, badges may show stale `status` |

### 3.3 `current_status`

| Aspect | Detail |
|--------|--------|
| Purpose | Workflow status after PRD/template era (`0020` comment: authoritative) |
| **Writers** | Create; Legacy RPC; Enhanced execute; cancel/return; batch-update auto-ready |
| **Readers** | `GET /api/v1/orders` `status_filter` → `.eq('current_status')` (`orders/route.ts:349–358`); screen queues via `useScreenOrders`; `order-editability.ts`; Enhanced transition from-status; FastItemizer (`current_status \|\| status`); processing-table display |
| Engine | **Both** write |
| De facto role | List filtering and most workflow gating |

### 3.4 `current_stage`

| Aspect | Detail |
|--------|--------|
| Purpose | Documented as synonym for `current_status` (`0020` COMMENT) |
| **Writers** | Create (often set to `'intake'` while `current_status` is already `preparing`/`processing` — `order-service.ts:425–436`); transition RPCs set `current_stage = to_status`; cancel/return → `cancelled` |
| **Readers** | List API accepts `current_stage` query param but still filters **`current_status`** column (`orders/route.ts:350–355`); occasional split/transition helpers |
| Practical role | Weak projection / compatibility; **not** an independent lifecycle |
| Drift at create | Common: `current_status=processing`, `current_stage=intake` |

### 3.5 `previous_status` (orders) — special case

| Aspect | Detail |
|--------|--------|
| Column on `org_orders_mst` | **Absent** (Prisma + local DB) |
| Where `previous_status` exists | e.g. POS session events (`0397`), not orders |
| Enhanced RPC | `cmx_ord_execute_transition` still contains `previous_status = current_status` (`0075:201`, live function body) |
| Implication | Full Enhanced stage execute path would error on UPDATE unless the column is added or the function is fixed — **blocker for Enhanced stage writer** |

### 3.6 `preparation_status`

| Aspect | Detail |
|--------|--------|
| Values | `pending` → `in_progress` → `completed` (prep APIs / comments) |
| **Writers** | Create `pending`; prep start/complete APIs; Enhanced `markPreparationCompleted` after preparation screen transition |
| **Readers** | Preparation queue/detail; prepare page gates; order-editability (prep completed blocks edit when status preparation); UI badges |
| Relation to workflow | Side channel — **not** updated by `cmx_order_transition` / execute RPC themselves |
| Note | Moving `current_status` to `processing` without `markPreparationCompleted` can leave `preparation_status=pending` |

### 3.7 `physical_intake_status`

| Aspect | Detail |
|--------|--------|
| Values (code) | `pending_dropoff` \| `received` \| `not_applicable` |
| Default | `received` |
| **Writers** | Create (remote intake → `pending_dropoff`); confirm-physical-intake → `received` |
| **Readers** | Orders list filter; pending-dropoff UI chips; public customer APIs |
| Relation to workflow | Orthogonal; remote intake often pairs with `draft` / contract status |

### 3.8 `payment_status` (header)

| Aspect | Detail |
|--------|--------|
| Default | `'pending'` (DB) |
| **Writers** | Create (`pending` / `partial`); financial recalculate / settlement (`order-financial-write.service` — Batch 0 uppercase constants) |
| **Readers** | Ready/collect UI, processing paid checks, reports, reconciliation |
| Workflow engines | **Neither** updates this |
| Drift | Create/legacy lowercase vs Batch 0 `UNPAID` / `PAID` / … vocabulary |

### 3.9 Related header markers (not full status enums)

| Field | Role |
|-------|------|
| `last_transition_at` / `last_transition_by` | Set by transition RPCs |
| `rejected_from_stage` | Stage name when rejected |
| `is_rejected` / `has_issue` | Boolean flags |
| `financial_snapshot_status`, `ar_invoice_status`, `tax_document_status` | Finance snapshot — not plant workflow |
| `rec_status` | Soft-delete / record status |

---

## 4. How engines manage header workflow fields

| Path | `status` | `current_status` | `current_stage` | Other |
|------|----------|------------------|-----------------|-------|
| Create (`OrderService`) | Set | Set | Set (may differ) | prep pending; intake; payment pending |
| Legacy `cmx_order_transition` | **Updated** | **Updated** | **Updated** (= to) | May cascade item statuses via `cmx_order_items_transition` |
| Enhanced `cmx_ord_execute_transition` | **Not updated** | **Updated** | **Updated** | Attempts `previous_status` (column missing) |
| Enhanced cancel/return RPCs | **Updated** | **Updated** | **Updated** | `cancelled_at` / return fields; history action types |
| Enhanced prep side-effect | — | — | — | `preparation_status=completed` |
| Delivery POD | Via Legacy `changeStatus` | Dual | Dual | Stop → `delivered` first |
| `batch-update` auto-ready | Direct both | Direct | — | History insert; **bypasses** RPCs |
| Prep complete (legacy API) | Often → processing/sorting | May **not** sync | — | Partial writer |

Transition API read pattern (Legacy fallback):

```text
fromStatus = (order.current_status || order.status).toLowerCase()
```

Evidence: `transition/route.ts:162–173`; `0023` UPDATE branches; live `cmx_ord_execute_transition`; `0130` cancel/return.

---

## 5. Item fields (`org_order_items_dtl`)

| Field | Default | Writers | Readers | Notes |
|-------|---------|---------|---------|-------|
| `status` | `"processing"` (Prisma) | Create often `'pending'` | Some item UIs | Parallel / older column |
| `item_status` | null | Create = initial workflow status; Legacy `cmx_order_items_transition`; `ItemProcessingService.markItemComplete` → `ready` | Assembly/processing auto-ready checks | Primary item workflow field |
| `item_stage` | null | Same RPC / mark complete | Processing UI | Often mirrored to `item_status` |
| `qa_status` | — | QA flows | Enhanced quality gate (`passed`) | Item-level QA |

**Engine note:** Legacy order transition can call item transition helper. Enhanced execute **does not** update item statuses — items can lag the order header after Enhanced stage moves.

---

## 6. Piece fields (`org_order_item_pieces_dtl`)

| Field | Default / values | Writers | Readers |
|-------|------------------|---------|---------|
| `piece_status` | default `processing`; TS union `intake\|processing\|qa\|ready` | Create; piece update/scan/ready helpers; batch-update | Processing UI, badges, piece utils |
| `piece_stage` | nullable | Create null; batch-update | Processing modal (secondary) |
| `scan_state` | create `expected`; scan → `scanned` (+ missing/wrong) | Piece scan API | Enhanced assembly gate (`scan_state==='scanned'`) |
| `is_ready` | `false` | Batch-update / ready helpers | Processing modal; also derived from `piece_status==='ready'` |

Order transition RPCs do **not** own piece fields. Piece readiness is a parallel track that can gate Enhanced assembly.

---

## 7. Assembly and delivery status fields

### Assembly

| Table.field | Values (practice) | Managed by |
|-------------|-------------------|------------|
| `org_asm_tasks_mst.task_status` | PENDING → IN_PROGRESS → READY / QA_* | `assembly-service` |
| `org_asm_tasks_mst.qa_status` | QA_PASSED / … | Assembly + QA paths |
| `org_asm_items_dtl.item_status` | PENDING / SCANNED | Assembly scan — **different** from order-item `item_status` |

Legacy `canMoveToReady` (unused caller) reads assembly task status. Enhanced ready gates prefer order items / issues / piece scans.

### Delivery

| Table.field | Default | Writers | Link to order |
|-------------|---------|---------|---------------|
| `org_dlv_routes_mst.route_status_code` | `planned` | DeliveryService create (+ limited updates) | Separate |
| `org_dlv_stops_dtl.stop_status_code` | `pending` | Create; POD → `delivered` | Then Legacy `changeStatus` order → `delivered` |

Delivery stop completion and order header completion are **two writes**.

---

## 8. Constants and allowed vocabularies

| Domain | Definition location | Notable literals |
|--------|---------------------|------------------|
| Order workflow (TS SoT for transitions) | `lib/types/workflow.ts` `OrderStatus` | includes `preparation`, sorting/washing/…, not `preparing` |
| Simplified UI constants | `lib/constants/order-types.ts` | `preparing`, `pending`, `completed` |
| Create runtime | `order-service.resolveInitialWorkflowStatus` | writes **`preparing`** / **`processing`** |
| Screen contracts | `cmx_ord_screen_pre_conditions` | prep: `preparing`,`intake`; others match stage names |
| Templates | `sys_workflow_template_stages` | intake → … → delivered (no packing/preparing in seeds) |
| Prep | pending / in_progress / completed | |
| Physical intake | pending_dropoff / received / not_applicable | |
| Header payment | Batch 0 uppercase vs create lowercase | |
| Piece | intake / processing / qa / ready | |

---

## 9. Who reads what (UI / API map)

| Surface | Field used |
|---------|------------|
| Workflow screen lists (`useScreenOrders` → orders API) | Filter **`current_status`** |
| Orders main table / simple table badges | Display **`status`** |
| Order actions / allowed next | Often **`status`** |
| Processing table | Display **`current_status`** |
| FastItemizer | `current_status \|\| status` |
| Public tracking | **`status`** |
| Editability | **`current_status`** (+ `preparation_status`) |
| Prep screens | **`preparation_status`** + order status filter |
| Pending dropoff | **`physical_intake_status`** |
| Ready collect / paid checks | **`payment_status`** (+ financial amounts) |
| Piece UI | **`piece_status`**, `scan_state`, `is_ready` |
| Transition API from-status | Prefers **`current_status`**, fallback `status` |

**Practical consequence:** An order can appear in the Ready queue (`current_status=ready`) while a badge still shows an older `status` if Enhanced execute (or another partial writer) ran without dual-write.

---

## 10. History and triggers

| Mechanism | Field used | Table |
|-----------|------------|-------|
| Insert trigger `fn_create_initial_status_history` | `NEW.status` | deprecated `org_order_status_history` |
| Insert trigger `fn_auto_log_order_created` | `NEW.current_status` | canonical `org_order_history` |
| Transition RPCs | from/to status args | `org_order_history` STATUS_CHANGE (cancel/return specialized types) |
| Batch-update auto-ready | manual history insert | `org_order_history` |

**No trigger** keeps `status` synchronized with `current_status`.

---

## 11. Lifecycle examples (field values)

### Normal itemized create → processing

| Field | After create |
|-------|--------------|
| `status` | `processing` |
| `current_status` | `processing` |
| `current_stage` | `intake` (deliberate create pattern) |
| `preparation_status` | `pending` |
| `physical_intake_status` | `received` (typical walk-in) |
| `payment_status` | `pending` or `partial` |
| Item `item_status` | initial status |
| Piece `piece_status` | `processing` (typical) |

### Quick Drop create

| Field | After create |
|-------|--------------|
| `status` / `current_status` | `preparing` |
| `current_stage` | `intake` |
| `is_order_quick_drop` | true |

### Legacy transition processing → ready

All of `status`, `current_status`, `current_stage` → `ready` (plus rack gate in RPC).

### Enhanced execute processing → ready (if path works)

`current_status` / `current_stage` → `ready`; **`status` unchanged**; UPDATE also references missing `previous_status`.

### Cancel (Enhanced cancel RPC)

`status` = `current_status` = `current_stage` = `cancelled` (+ timestamps).

### POD delivered

Stop `stop_status_code=delivered`, then Legacy order transition → header `delivered` (dual-write).

---

## 12. Field relationship diagram

```text
                    ┌─────────────────────────────────────┐
  Create / Legacy   │  org_orders_mst.status              │◄── many UI badges
  Cancel/Return     │                                     │
                    └──────────────▲──────────────────────┘
                                   │ dual-write (Legacy / cancel)
                                   │ NOT written by Enhanced execute
                    ┌──────────────┴──────────────────────┐
  Lists / gates     │  org_orders_mst.current_status      │◄── screen queues, editability
  Both engines      │                                     │
                    └──────────────▲──────────────────────┘
                                   │ usually set equal on transition
                    ┌──────────────┴──────────────────────┐
  Synonym / create  │  org_orders_mst.current_stage       │  (often "intake" at create)
                    └─────────────────────────────────────┘

  preparation_status ── prep screens only (side channel)
  physical_intake_status ── intake / remote dropoff (orthogonal)
  payment_status ── finance engine (orthogonal)

  items.item_status / piece_status / asm.task_status / dlv.stop_status_code
       └── parallel tracks; Legacy may cascade items; Enhanced usually does not
```

---

## 13. Known inconsistencies (facts)

| ID | Issue | Evidence |
|----|-------|----------|
| S01 | Dual header columns with incomplete dual-write | Enhanced execute vs Legacy `0023` |
| S02 | Lists filter `current_status`; many badges use `status` | `orders/route.ts` vs `order-table.tsx` |
| S03 | Create sets `current_stage=intake` while status already advanced | `order-service.ts:425–436` |
| S04 | `preparing` written; TS enum uses `preparation` | create vs `workflow.ts` |
| S05 | Enhanced execute references `previous_status` without column | `0075` + local schema |
| S06 | Item `status` vs `item_status` dual columns | Prisma item model + create |
| S07 | Piece `is_ready` vs `piece_status=ready` dual signals | piece utils / batch-update |
| S08 | Asm item_status ≠ order item_status | different tables |
| S09 | Payment vocabulary lowercase vs Batch 0 uppercase | create vs financial write |
| S10 | Two history insert triggers use different fields | `status` vs `current_status` |
| S11 | Bypass writers (batch-update, prep complete) update subsets | routes / actions |

---

## 14. Discovery SQL (read-only)

```sql
-- Drift between status and current_status
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status IS DISTINCT FROM current_status) AS drift,
       COUNT(*) FILTER (WHERE current_status IS NULL) AS null_current,
       COUNT(*) FILTER (WHERE status IS NULL) AS null_status
FROM org_orders_mst;

-- Create-style stage lag
SELECT COUNT(*) FROM org_orders_mst
WHERE current_stage = 'intake'
  AND current_status IN ('preparing','processing','assembly','qa','packing','ready');

-- Histogram
SELECT current_status, status, current_stage, COUNT(*)
FROM org_orders_mst
GROUP BY 1,2,3
ORDER BY 4 DESC
LIMIT 50;

-- Prep vs workflow mismatch
SELECT COUNT(*) FROM org_orders_mst
WHERE current_status = 'processing'
  AND preparation_status = 'pending'
  AND is_order_quick_drop = true;
```

---

## 15. Key files and symbols

| Path | Role |
|------|------|
| `supabase/migrations/0020_orders_workflow_extensions.sql` | Adds `current_status` / `current_stage`; documents authority |
| `supabase/migrations/0023_workflow_transition_function.sql` | Legacy dual-write |
| `supabase/migrations/0075_screen_contract_functions_simplified.sql` | Enhanced execute (current_* + previous_status) |
| `supabase/migrations/0130_cmx_ord_canceling_returning_functions.sql` | Cancel/return dual-write |
| `web-admin/prisma/schema.prisma` | `org_orders_mst` / items / pieces |
| `web-admin/lib/services/order-service.ts` | Create initial values |
| `web-admin/lib/services/workflow-service.ts` | Legacy `changeStatus` |
| `web-admin/lib/services/workflow-service-enhanced.ts` | Enhanced + prep completed |
| `web-admin/app/api/v1/orders/route.ts` | List filter on `current_status` |
| `web-admin/lib/utils/order-editability.ts` | Gates on `current_status` |
| `web-admin/lib/types/workflow.ts` | `OrderStatus` literals |
| `web-admin/lib/constants/order-types.ts` | Simplified / competing literals |

---

## 16. Short factual summary

- **`current_status`** is the field workflow lists, screen contracts, and most gates treat as the order’s workflow state.  
- **`status`** remains widely displayed and is dual-written by Legacy/cancel paths, but **not** by Enhanced stage execute.  
- **`current_stage`** is documented as a synonym; at create it often stays `intake` while status advances; on transitions it is usually set equal to the new status.  
- Prep, physical intake, and payment each use **separate** status columns outside the transition RPCs.  
- Items, pieces, assembly, and delivery maintain **parallel** status systems with incomplete cascade from the Enhanced order path.  
- There is **no** DB trigger aligning `status` ↔ `current_status`, and Enhanced’s `previous_status` write targets a **non-existent** order column.

---

*End of report.*
