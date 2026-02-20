---
name: ""
overview: ""
todos: []
isProject: false
---

# DB function fix order data + Quick Action → Fix Order Data Modal

## Part 1: Database function — return full, clear details

- **Migration**: `supabase/migrations/0112_fix_order_data_function.sql` (next after 0111).
- **Function**: `fix_order_data(p_tenant_org_id UUID DEFAULT NULL, p_steps TEXT[] DEFAULT NULL, p_order_id UUID DEFAULT NULL) RETURNS JSONB`
  - `p_order_id`: when non-NULL, restrict fixes to order items of that order only.
- **First step**: `complete_order_item_pieces` — ensure piece row count equals `org_order_items_dtl.quantity` (add missing or remove excess).

**Return shape (full, clear details for modal):** The function must return a JSONB that the modal can render per-step with good UI/UX. Use a consistent structure so every step (current and future) fits the same pattern.

Suggested structure:

```json
{
  "overall": "success" | "partial" | "error",
  "steps": [
    {
      "step_id": "complete_order_item_pieces",
      "status": "success" | "error" | "skipped",
      "summary": "3 items adjusted. 5 pieces added, 2 removed.",
      "details": {
        "items_adjusted": 3,
        "pieces_added": 5,
        "pieces_removed": 2,
        "item_results": [
          { "order_item_id": "uuid", "order_item_srno": "1", "action": "added_pieces", "count": 2 },
          { "order_item_id": "uuid", "order_item_srno": "2", "action": "removed_pieces", "count": 1 }
        ]
      },
      "error_message": null
    }
  ]
}
```

- **success**: `details` holds counts and, where useful, per-item breakdown (`item_results`). For "no changes", `summary` = "No changes needed." and `details.items_adjusted` = 0.
- **error**: `status` = "error", `error_message` = clear text (e.g. constraint violation or which item failed), `details` can be null or partial.
- **skipped**: step was not run (e.g. not in `p_steps`). Optional; can omit from `steps` instead.

Implement the first step so it fills `summary`, `details` (items_adjusted, pieces_added, pieces_removed, and optionally `item_results` for each affected order item). This gives the modal everything needed to show **what happened** under each step.

- **Security**: SECURITY DEFINER; GRANT EXECUTE to service_role.

---

## Part 2: Quick Action opens Fix Order Data Modal

### Flow

1. **Order details / Quick Actions**: One button that **opens the fix-order-data modal**.
2. **Modal**: Named **fix-order-data-modal** (component: `FixOrderDataModal`). More fix steps will be added to this modal later (extensible list of steps).
3. User selects which steps to run (for now: one step; later: checkboxes or list), clicks **Run fix**, sees loading then result or error, then Close or Refresh.

### Modal copy (i18n keys and suggested text)

Use these keys under `orders.fixOrderDataModal` (and add AR in `ar.json`). Copy is tuned for clarity and for adding more steps later.

| Key                           | EN (suggested)                                                                                       | AR (suggested)                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `title`                       | Fix order data                                                                                       | إصلاح بيانات الطلب                                                                        |
| `description`                 | Run one or more fixes for this order. Corrects data issues without changing workflow status.         | تشغيل إصلاح واحد أو أكثر لهذا الطلب. يصحح مشاكل البيانات دون تغيير حالة سير العمل.        |
| `stepsLabel`                  | Fixes to run                                                                                         | الإصلاحات المطلوب تشغيلها                                                                 |
| `stepCompleteOrderItemPieces` | Complete order item pieces — add or remove piece rows so each item has the correct number of pieces. | إكمال قطع عناصر الطلب — إضافة أو حذف صفوف القطع بحيث يكون لكل عنصر العدد الصحيح من القطع. |
| `runButton`                   | Run fix                                                                                              | تشغيل الإصلاح                                                                             |
| `running`                     | Running fix…                                                                                         | جاري تشغيل الإصلاح…                                                                       |
| `successTitle`                | Fix completed                                                                                        | تم الإصلاح                                                                                |
| `successNoChanges`            | No changes were needed.                                                                              | لم تكن هناك حاجة لأي تغييرات.                                                             |
| `successWithChanges`          | Done. Items adjusted: {items}. Pieces added: {added}. Pieces removed: {removed}.                     | تم. العناصر المعدلة: {items}. القطع المضافة: {added}. القطع المحذوفة: {removed}.          |
| `errorTitle`                  | Fix failed                                                                                           | فشل الإصلاح                                                                               |
| `errorMessage`                | Something went wrong. Please try again or contact support.                                           | حدث خطأ. يرجى المحاولة مرة أخرى أو الاتصال بالدعم.                                        |
| `close`                       | Close                                                                                                | إغلاق                                                                                     |
| `refreshPage`                 | Refresh page                                                                                         | تحديث الصفحة                                                                              |
| `resultSectionTitle`          | Result                                                                                               | النتيجة                                                                                   |
| `stepStatusSuccess`           | Success                                                                                              | نجح                                                                                       |
| `stepStatusError`             | Error                                                                                                | خطأ                                                                                       |
| `stepStatusSkipped`           | Skipped                                                                                              | تم تخطيه                                                                                  |
| `stepNoChanges`               | No changes needed.                                                                                   | لم تكن هناك حاجة لأي تغييرات.                                                             |
| `stepDetailsLabel`            | Details                                                                                              | التفاصيل                                                                                  |
| `stepItemAdjusted`            | Item {srno}: {action} ({count})                                                                      | العنصر {srno}: {action} ({count})                                                         |
| `stepActionAdded`             | added pieces                                                                                         | إضافة قطع                                                                                 |
| `stepActionRemoved`           | removed pieces                                                                                       | حذف قطع                                                                                   |
| `stepActionAdjusted`          | adjusted                                                                                             | تم تعديله                                                                                 |

Quick Action button (in `orders.actions.buttons`):

| Key            | EN             | AR                 |
| -------------- | -------------- | ------------------ |
| `fixOrderData` | Fix order data | إصلاح بيانات الطلب |

### Where it appears

- **Page**: Order details/full — [order-detail-client.tsx](web-admin/app/dashboard/orders/[id]/order-detail-client.tsx) → Quick Actions → `<OrderActions order={order} />`.
- **OrderActions** ([order-actions.tsx](web-admin/src/features/orders/ui/order-actions.tsx)): Add a Quick Action button "Fix order data" that opens the modal (e.g. `setShowFixOrderDataModal(true)`). Render `<FixOrderDataModal orderId={order.id} open={showFixOrderDataModal} onOpenChange={setShowFixOrderDataModal} onSuccess={() => router.refresh()} />`.

### Implementation

1. **New component: Fix Order Data Modal**

- **File**: `web-admin/src/features/orders/ui/fix-order-data-modal.tsx`.
- **Props**: `orderId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`, optional `onSuccess?: () => void`.
- **Content** (use the modal copy table above for all user-facing text):
  - Dialog title: `orders.fixOrderDataModal.title`.
  - Description: `orders.fixOrderDataModal.description`.
  - **Steps section**: Label `stepsLabel`; list fix steps (for now one: "Complete order item pieces" via `stepCompleteOrderItemPieces`). **Extensible**: when more DB fix steps are added, add more step labels and optionally checkboxes; API accepts `steps` in the body.
  - Primary action: "Run fix" (`runButton`) → `POST /api/v1/orders/[orderId]/fix-order-data` with loading state (`running`).
  - **Result area (under the steps, good UI/UX)**:
    - After run, show a **Result** section (`resultSectionTitle`) below the steps.
    - **Per-step result block**: For each entry in `data.steps`, render a clear block under the corresponding step (or in a vertical list if steps are listed above):
      - **Step name** (e.g. "Complete order item pieces") + **status badge/icon**: Success (green check), Error (red alert), Skipped (muted). Use `stepStatusSuccess`, `stepStatusError`, `stepStatusSkipped`.
      - **Summary line**: Show `step.summary` (e.g. "3 items adjusted. 5 pieces added, 2 removed." or "No changes needed."). If no summary, use `stepNoChanges` when status is success and details show no changes.
      - **Details (optional expand/collapse or always visible)**: If `step.details` exists:
        - Show counts: items_adjusted, pieces_added, pieces_removed (if present).
        - If `step.details.item_results` exists: list each item with `stepItemAdjusted` (srno, action, count) using `stepActionAdded` / `stepActionRemoved` / `stepActionAdjusted` for the action label.
      - **Error**: If `step.status === 'error'`, show `step.error_message` in an alert-style block (destructive or warning) under that step.
    - Use spacing, borders or cards per step so each step’s result is easy to scan. RTL-aware layout.
  - **Overall error**: If API returns `success: false` or `data.overall === 'error'`, show a single error block at top of result area using `errorTitle` + `errorMessage` (or server error text).
  - Footer: Close (`close`); after success, optional "Refresh page" (`refreshPage`) that calls `onSuccess()` and closes.
- Use Cmx design system: `CmxDialog`, `CmxDialogContent`, `CmxDialogHeader`, `CmxDialogTitle`, `CmxDialogDescription`, `CmxDialogFooter`, `CmxButton`, `Alert`/`AlertDescription` for errors (from [web-admin/.clauderc](web-admin/.clauderc) `ui_components`).

1. **API route**

- **Path**: `web-admin/app/api/v1/orders/[id]/fix-order-data/route.ts`
- **Method**: POST. Get tenant via `get_user_tenants`, validate order, call `fix_order_data(tenantId, ['complete_order_item_pieces'], orderId)`.
- **Response**: `{ success: true, data: <JSONB> }` where `data` has the shape from Part 1 (`overall`, `steps` array with per-step `step_id`, `status`, `summary`, `details`, `error_message`). On failure: `{ success: false, error: string }`.

1. **OrderActions**

- Add state: `const [showFixOrderDataModal, setShowFixOrderDataModal] = useState(false)`.
- Add button (e.g. outline): "Fix order data" → `onClick={() => setShowFixOrderDataModal(true)}`.
- Render: `<FixOrderDataModal orderId={order.id} open={showFixOrderDataModal} onOpenChange={setShowFixOrderDataModal} onSuccess={() => { router.refresh(); setShowFixOrderDataModal(false); }} />`.

1. **i18n**

- **Quick Action button**: `orders.actions.buttons.fixOrderData` (see Quick Action button table above).
- **Modal**: All keys under `orders.fixOrderDataModal.` as in the "Modal copy" table above. Search existing messages before adding; reuse `common.close` for Close if it fits, otherwise use `orders.fixOrderDataModal.close`.

### Summary

| Item            | Detail                                                                                |
| --------------- | ------------------------------------------------------------------------------------- |
| Quick Action    | Single button "Fix order data" in Order details Quick Actions                         |
| Modal component | **fix-order-data-modal** (`FixOrderDataModal`) in `web-admin/src/features/orders/ui/` |
| Modal content   | Title, description, steps list, Run button, **per-step result blocks** (status, summary, details, errors), Close / Refresh |
| DB return       | Full details: `overall`, `steps[]` with `step_id`, `status`, `summary`, `details` (counts + optional `item_results`), `error_message` |
| API             | `POST /api/v1/orders/[id]/fix-order-data`; response `data` matches DB return shape    |
| DB              | `fix_order_data(p_tenant_org_id, p_steps, p_order_id)` with `p_order_id = order.id`     |

This keeps the Quick Action lightweight (open modal) and puts the action and **clear per-step results** inside the **fix-order-data-modal**.

### Future: more fix steps in the modal

More fix steps will be added to this modal later. When adding a new step:

1. **DB**: Add a new step inside `fix_order_data` and append to the returned `steps` array with the same shape: `step_id`, `status`, `summary`, `details` (full, clear details), `error_message`.
2. **Modal**: Add a step label (and optionally a checkbox) under `orders.fixOrderDataModal.step<StepName>`. Send selected steps in the API request body.
3. **Result area**: The existing per-step result UI (status badge, summary, details, error block) already displays whatever the function returns for each step; ensure the new step’s `summary` and `details` are human-readable so the modal shows what happened without code changes to the result layout.
