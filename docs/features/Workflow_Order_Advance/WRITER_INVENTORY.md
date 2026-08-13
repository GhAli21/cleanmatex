# Writer inventory — Workflow Order Advance V1.0

Track every path that mutates order operational status. Exit criterion: all production writers go through `WorkflowEngine.executeAction` (or are explicitly retired).

| Writer | Path | V1.0 status |
|--------|------|------------------|
| Prep complete | `POST /api/v1/preparation/[id]/complete` | Engine-only `COMPLETE_PREPARATION` |
| Transition hook | `useOrderTransition` | Engine via `/actions`; compatibility fields are ignored by the server authority |
| Transition API | `POST /api/v1/orders/[id]/transition` | Engine-only compatibility adapter; raw status without a mappable action is rejected |
| Actions API | `POST /api/v1/orders/[id]/actions` | ✅ Engine |
| Stage screens | processing / assembly / qa / packing Complete buttons | ✅ Via `useOrderTransition` + `WorkflowActionBar` |
| Ready | `/dashboard/ready/[id]` | ✅ Action bar RELEASE_* |
| POD capture | `DeliveryService.capturePOD` | Engine-only `CONFIRM_DELIVERY` |
| Physical intake | `POST …/confirm-physical-intake` | Engine-only `CONFIRM_PHYSICAL_INTAKE` |
| Batch auto-ready | `POST …/batch-update` | Engine `COMPLETE_PACKING` when enabled; otherwise safely skips |
| Public confirm-received | `POST /api/v1/public/…/confirm-received` | Engine-only `CONFIRM_DELIVERY` + system actor; delivered is idempotent |
| Legacy status API | `PATCH /api/orders/[orderId]/status` | Retired with authenticated `410 USE_WORKFLOW_ACTIONS` |
| Legacy bulk status | `POST /api/orders/bulk-status` | Retired with authenticated `410 USE_WORKFLOW_ACTIONS` |
| Legacy/Enhanced RPCs | `cmx_order_*` / `cmx_ord_*` | No production runtime caller; grants contracted by create-only migration `0442` |
| Cancel/hold/stop | canceling + order_control | Engine-only narrow cancel and HOLD/RESUME/STOP; return V1.1 deferred |
| Item processing | piece step writers | Item-level writes only; order auto-ready uses engine |
| Split sub-order creation | `OrderService.splitOrder` | Creation-time child initialization at `processing`; does not transition an existing order and remains a V1.1 modeling follow-up |

The HQ/client flag remains for UI exposure and rollout controls, but post-create server-side workflow transitions no longer fall back to Legacy/Enhanced RPCs.

## Do not remove yet

- Legacy SQL functions and `workflow-service-enhanced.ts` remain as non-runtime rollback evidence until post-deploy acceptance is signed.
- Generated database type declarations remain until the schema is regenerated after migration promotion.
- Read-only history, overdue, workflow statistics, and template helpers in `WorkflowService` remain active and tenant-scoped.
- `log_order_action` and `cmx_ord_pref_append_notes_followup` are unrelated and are not part of RPC retirement.

**Skip edges:** `0434` applied. **Rack:** `0435` applied — packing→ready requires rack; ActionBar + Ready detail can set rack.
