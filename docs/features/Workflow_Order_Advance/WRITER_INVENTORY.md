# Writer inventory — Workflow Order Advance V1.0

Track every path that mutates order operational status. Exit criterion: all production writers go through `WorkflowEngine.executeAction` (or are explicitly retired).

| Writer | Path | V2 canary status |
|--------|------|------------------|
| Prep complete | `POST /api/v1/preparation/[id]/complete` | ✅ Engine when flag; legacy → `processing` (no sorting) |
| Transition hook | `useOrderTransition` | ✅ Engine via `/actions` when `NEXT_PUBLIC_WORKFLOW_ENGINE_V2` (client canary) |
| Transition API | `POST /api/v1/orders/[id]/transition` | ✅ Engine when `actionCode` + server flag; else Legacy/Enhanced |
| Actions API | `POST /api/v1/orders/[id]/actions` | ✅ Engine |
| Stage screens | processing / assembly / qa / packing Complete buttons | ✅ Via `useOrderTransition` + `WorkflowActionBar` |
| Ready | `/dashboard/ready/[id]` | ✅ Action bar RELEASE_* |
| POD capture | `DeliveryService.capturePOD` | ✅ `CONFIRM_DELIVERY` when flag |
| Physical intake | `POST …/confirm-physical-intake` | ✅ Engine when flag |
| Batch auto-ready | `POST …/batch-update` | ✅ `COMPLETE_PACKING` when available + flag; else skip |
| Public confirm-received | `POST /api/v1/public/…/confirm-received` | ✅ Engine `CONFIRM_DELIVERY` + system actor when flag on (migration `0437`); Legacy fallback |
| Legacy status API | `PATCH /api/orders/[orderId]/status` | ✅ Gated 410 when V2 on (`ENGINE_V2_USE_ACTIONS`) |
| Legacy bulk status | `POST /api/orders/bulk-status` | ✅ Gated 410 when V2 on (`ENGINE_V2_USE_ACTIONS`) |
| Enhanced RPC | `cmx_ord_execute_transition` | ⏳ Used when flag off / no actionCode |
| Cancel/hold/stop | canceling + order_control | ✅ Engine: narrow cancel (no Fin unwind); HOLD/RESUME/STOP; return V1.1 deferred; Enhanced cancel when flag off |
| Item processing | piece step writers | ⏳ Item-level only (OK if order status unchanged) |

Flag: HQ `workflow_engine_v2` / `WORKFLOW_ENGINE_V2` / `NEXT_PUBLIC_WORKFLOW_ENGINE_V2`.

**Skip edges:** `0434` applied. **Rack:** `0435` applied — packing→ready requires rack; ActionBar + Ready detail can set rack.
