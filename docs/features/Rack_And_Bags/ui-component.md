# Rack & Bags Modal — UI Component

## `RackBagsModal`

**File:** `web-admin/src/features/workflow/ui/rack-bags-modal.tsx`

Standalone dialog: self-fetches its own data via `GET /api/v1/orders/[id]/rack-bags` on `open`, persists via `POST /api/v1/orders/[id]/batch-update`, and reports the saved fields back via `onSaved`. It has no knowledge of "workflow actions" or "execute" — any screen can mount it directly with just an `open` trigger; the caller decides what to do next (retry a blocked action, refresh a list, etc.).

```ts
export interface RackBagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string | null;
  onSaved: (fields: {
    rackLocation: string; lockerLocation: string; lockerCode: string;
    bagCount: number; hangingCount: number;
  }) => void;
}
```

Fields: Rack (required), Locker + Code (optional), Bags picker (`CmxCountPicker`, min 1), Hanging picker (`CmxCountPicker`, min 0, no upper bound). Shows a `CmxSummaryMessage type="warning"` banner when the customer has other active orders already racked/lockered, with the specific order numbers listed for manual verification.

## `CmxCountPicker`

**File:** `web-admin/src/ui/forms/cmx-count-picker.tsx` (exported from `@ui/forms`)

Reusable 0..max chip picker + "Custom" chip revealing a bounded number input. See its own props doc in the component file; used for both bag and hanging counts, and available for any future count field.

## Reach

`RackBagsModal` is wired into `WorkflowActionBar` (`web-admin/src/features/workflow/ui/WorkflowActionBar.tsx`), replacing its old single-field inline rack prompt. It is now reachable from every screen that mounts `WorkflowActionBar` — `ready`, `qa`, `packing`, `processing`, `assembly`, `preparation`, plus `order-actions.tsx`, `home-collection`, and `delivery` — whenever an action is blocked solely by `GATE_RACK_REQUIRED`. No per-screen wiring was needed beyond this one change.

Flow: a rack-blocked-only action is rendered clickable (not HTML-disabled); clicking it opens `RackBagsModal` instead of executing. On save, `WorkflowActionBar` immediately retries the same action with `{ rackLocation: saved.rackLocation }` merged into its execute input (one click total) — the workflow engine's `resolveInputRack` accepts this as a same-request override, so no extra fetch/refresh is needed before the retry. If the retry fails for an unrelated reason, the fields are still saved and `execute()`'s own error toast fires; the action button stays available for a normal follow-up click.
