# Writer inventory — Workflow Order Advance V1.0

Track every path that mutates order operational status. Exit criterion: all production writers go through `WorkflowEngine.executeAction` (or are explicitly retired).

| Writer | Path | V2 canary status |
|--------|------|------------------|
| Prep complete | `POST /api/v1/preparation/[id]/complete` | ✅ Engine when flag; legacy → `processing` (no sorting) |
| Transition | `POST /api/v1/orders/[id]/transition` | ✅ Engine when `actionCode` + flag; else Legacy/Enhanced |
| Actions API | `POST /api/v1/orders/[id]/actions` | ✅ Engine |
| POD capture | `DeliveryService.capturePOD` | ✅ `CONFIRM_DELIVERY` when flag |
| Physical intake | `POST …/confirm-physical-intake` | ✅ Engine when flag |
| Batch auto-ready | `POST …/batch-update` | ✅ `COMPLETE_PACKING` when available + flag; else skip (no bypass) |
| Public confirm-received | `POST /api/v1/public/…/confirm-received` | ⏳ Legacy (no auth user for engine actor) — P4 |
| Legacy status API | `POST /api/orders/[orderId]/status` | ⏳ Open |
| Enhanced RPC | `cmx_ord_execute_transition` via WorkflowServiceEnhanced | ⏳ Still used when flag off / no actionCode |
| Cancel/return RPCs | canceling/returning screens | ⏳ Open |
| Item processing | piece step writers | ⏳ Item-level; order status may still bypass |
| Workflow stats / other | misc | ⏳ Audit |

Flag: `WORKFLOW_ENGINE_V2=true`.
