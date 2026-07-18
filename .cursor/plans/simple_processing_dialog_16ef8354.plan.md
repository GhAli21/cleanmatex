---
name: Simple Processing Dialog
overview: Add a production-ready Simple Processing dialog on the Processing list, opened from a new action button between Edit and Mark-ready. It reuses existing batch-update and split APIs, wires Report Issue to the existing issue API, and stubs Send Receipt with a coming-soon toast.
todos:
  - id: entry-button
    content: Add Simple Process icon between Edit and CheckCircle in processing-table (+ mobile card) and page state wiring
    status: completed
  - id: simple-dialog
    content: "Build SimpleProcessingDialog + piece row: notes-only Update, Ready+optional rack, rejected/Un-reject, Split"
    status: completed
  - id: issue-dialog
    content: Build Report Issue nested dialog wired to POST /issue; Send Receipt coming-soon toast
    status: completed
  - id: i18n-access
    content: Add EN/AR processing.simpleModal keys; update orders-access apiDependencies for list route
    status: completed
  - id: validate
    content: eslint, tsc, check:i18n, build; smoke Ready/Split/Issue/Edit coexistence
    status: completed
isProject: false
---

# Simple Processing Window

## Decisions (locked)

- **Split:** Same as full modal — checkbox selects pieces; Update does **not** persist Split; a Separate Split action opens existing [`SplitConfirmationDialog`](web-admin/src/features/workflow/ui/split-confirmation-dialog.tsx) → `POST /api/v1/orders/[id]/split`.
- **Report Issue:** Wire to existing `POST /api/v1/orders/[id]/issue` via a compact nested dialog (API + schema already exist; no reusable order-issue UI today).
- **Send Receipt:** Visible secondary button → `showInfoToast` “coming soon” (no receipt context on this list surface).
- **Edit (pencil)** keeps the full [`ProcessingModal`](web-admin/src/features/workflow/ui/processing-modal.tsx). The new button opens only the Simple dialog.
- **Notes column:** Editable always. **Update saves notes even when no Ready/Split checkbox changed** (notes-only dirty is enough to enable Update). Persist via `batch-update` `notes` field.
- **Piece rack on Ready:** When user checks **Ready** on a piece, reveal an optional inline `rack_location` field for that piece (prefill existing value if any). User may leave it empty. Persist `rackLocation` on that piece in `batch-update` when set. Still **omit order-level `orderRackLocation`** so the order does not auto-transition to Ready (CheckCircle / detail remain order Ready path).
- **Rejected pieces (locked — Simple dialog policy):**
  - Always **show** rejected rows with Rejected badge (never hide).
  - **Ready:** disabled while `is_rejected`; tooltip i18n: “Un-reject before marking ready” (avoids silent progress no-op — rollup counts only `ready AND is_rejected=false`).
  - **Un-reject:** small ghost row action (same intent as full modal `handleUnReject`); sets local `isRejected: false` and persists on Update via `batch-update` `isRejected: false` (or immediate patch if existing piece un-reject API is already used — prefer same path as full modal for consistency).
  - **Split:** still allowed on rejected (peel problem pieces into another order).
  - **Notes:** always editable on rejected rows.

## UX target (from screenshots)

```mermaid
flowchart LR
  ListRow["ProcessingTable row"] -->|new icon between Edit and Check"| SimpleDlg["SimpleProcessingDialog"]
  SimpleDlg -->|Update| BatchAPI["POST batch-update is_ready"]
  SimpleDlg -->|Split selected| SplitDlg["SplitConfirmationDialog"]
  SplitDlg --> SplitAPI["POST split"]
  SimpleDlg -->|Report Issue| IssueDlg["compact issue form"]
  IssueDlg --> IssueAPI["POST issue"]
  SimpleDlg -->|Send Receipt| Toast["coming soon toast"]
```

Layout (Cmx only):

1. **Header:** Title uses real `order_no` (e.g. `ORD-…`), not a synthetic `#7`. Status badge: i18n label **Processing** when `current_status === 'processing'`, else localized status. Secondary **Report Issue** / **Send Receipt** + close.
2. **Metadata grid (3 cols):** Created (`created_at` + relative time; staff/branch only if present on `/state` payload — no fake “Station 1”). Payment: format money + paid/unpaid from `payment_status` / amounts. Edited: Yes if `updated_at` meaningfully differs from `created_at`, else No (fallback “—” if field missing).
3. **Item pieces table:** Per-piece rows — item display name + piece seq | editable Notes | **Ready** (disabled if rejected) | **Split** (allowed if `splitOrderEnabled`, including rejected) | Rejected badge + **Un-reject** when rejected. When Ready is checked, show optional piece **Rack** (keep typed rack if Ready unchecked — no silent clear).
4. **Footer:** Primary **Update** via `CmxButton variant="primary"` + optional green `className`. Enable Update when **any** of: notes, ready, piece rack, or un-reject dirty. Show **Split Order** when `selectedForSplit.size > 0`.

## Entry point

File: [`web-admin/src/features/workflow/ui/processing-table.tsx`](web-admin/src/features/workflow/ui/processing-table.tsx)

- In `OrderRow` STATUS actions, insert a new icon button **between** Edit (`SquarePen`) and CheckCircle (e.g. `ListChecks` / `ClipboardList`).
- Props: `onSimpleProcessClick?(orderId)` (mirror `onEditClick`).
- Also wire mobile `ProcessingOrderCard` if it exposes the same actions.
- Page: [`web-admin/app/dashboard/processing/page.tsx`](web-admin/app/dashboard/processing/page.tsx) — parallel state to `ProcessingModal` (`isSimpleOpen`, `simpleOrderId`).

## New components

| File | Role |
|------|------|
| `web-admin/src/features/workflow/ui/simple-processing-dialog.tsx` | Main dialog: load order+pieces, local piece state, Update, Split, header actions |
| `web-admin/src/features/workflow/ui/simple-processing-issue-dialog.tsx` | Nested CmxDialog: issueCode select + issueText + submit → issue API |
| `web-admin/src/features/workflow/ui/simple-processing-piece-row.tsx` | Lightweight row: notes, Ready (+ optional rack), Split, Rejected badge + Un-reject (no step timeline) |

Reuse without rewriting engines:

- **Shared query keys** with full modal: `['order-processing', orderId]` (`GET /state`) and `['order-pieces', orderId]` (`GET /pieces`) so Edit ↔ Simple stay cache-consistent; invalidate both + list query after Update/Split/Issue.
- Prefer extracting `mapDbPieceToItemPiece` / response normalizer into a small shared util (e.g. `workflow/lib/processing-piece-map.ts`) instead of copy-paste from [`processing-modal.tsx`](web-admin/src/features/workflow/ui/processing-modal.tsx).
- Persist: `POST /api/v1/orders/{id}/batch-update` with changed `is_ready`, `notes`, `rackLocation`, and `isRejected` (un-reject); **omit** order-level `orderRackLocation` so order status does not jump to Ready.
- Split: existing [`SplitConfirmationDialog`](web-admin/src/features/workflow/ui/split-confirmation-dialog.tsx) + split mutation; only real DB UUIDs in `selectedForSplit`.
- CSRF via `getCSRFHeader` / `useCSRFToken` on all mutating calls (batch-update requires CSRF).
- Tenant settings: `splitOrderEnabled` + **`trackByPiece`** via `useTenantSettingsWithDefaults`.
- Toasts: `showSuccessToast` / `showErrorToast` / `showInfoToast` from `@ui/components/cmx-toast`.

### Critical behaviors (gaps closed)

| Gap | Plan rule |
|-----|-----------|
| **`trackByPiece` off / no pieces in DB** | Still open dialog; if `/pieces` empty, show empty state + CTA to open full Edit modal (or generate display-only rows that **cannot** Update until real piece UUIDs exist). Never POST synthetic `${itemId}-piece-N` IDs without resolution — batch-update drops non-existent pieces silently (`validUpdates.length === 0`). |
| **Rejected pieces** | Show + badge; Ready disabled until Un-reject; Split allowed; Notes editable; Un-reject via local state → Update (`isRejected: false`). |
| **Split without setting** | Hide Split column/button when `!splitOrderEnabled` (same as full modal). |
| **Nested dialogs** | Only one child open at a time (Issue XOR Split confirm); guard `onOpenChange` so closing child does not dismiss parent; block parent dismiss while any mutation pending. |
| **Unsaved close** | If dirty and user closes, confirm discard (CmxConfirmDialog) or ignore close until confirm. |
| **403 / permission** | Surface API error via toast/`CmxSummaryMessage`; Update disabled while CSRF/auth not ready. |
| **Action confusion** | Distinct tooltip/aria: Edit = “Full processing editor”; new button = “Simple processing”. |
| **Mobile card** | `ProcessingOrderCard` must get the same new action (not desktop-only). |
| **Inventories** | After `orders-access.ts` change: refresh platform inventories for page surface `/dashboard/processing` (or note in PR). |

## Report Issue (wired)

Compact form aligned with [`CreateIssueRequestSchema`](web-admin/lib/validations/workflow-schema.ts):

- `issueCode`: `damage | stain | complaint | other`
- `issueText`: min 3 chars
- `orderItemId`: `null` (order-level) for v1 simplicity
- `priority`: default `normal`

On success: toast + close nested dialog; optionally refresh order `has_issue` if returned.

## Access contract / i18n

- Update [`orders-access.ts`](web-admin/src/features/orders/access/orders-access.ts) for `/dashboard/processing`: document `apiDependencies` for `batch-update` (`orders:update`), `split`, and `issue` (auth/permission as existing detail route notes).
- i18n under `processing.simpleModal.*` in [`messages/en/processing.json`](web-admin/messages/en/processing.json) + [`messages/ar/processing.json`](web-admin/messages/ar/processing.json); reuse `common.*`, `processing.splitConfirm`, `workflow.actions.createIssue` where keys already exist.
- Run `npm run check:i18n` after keys.

## UX / production polish

- Loading skeleton while order/pieces load; dedicated empty / error states (do not show a blank table).
- Dirty-state: enable Update when notes and/or ready and/or piece rack and/or un-reject dirty (notes-only OK); discard confirm on close; block close while mutation pending.
- Keyboard: Escape closes when idle and not dirty (or after discard); Ctrl/Cmd+S saves when dirty.
- a11y: distinct `aria-label`s; dialog title/description; labeled checkboxes; focus trap via CmxDialog.
- No silent money mutation (payment metadata display-only).
- After Update/Split/Issue: invalidate shared query keys + list; call `onRefresh`.
- Do **not** replace or remove full `ProcessingModal`; do not add `console.log` debug noise (full modal has some — Simple stays clean).

## Validation (before done)

```bash
cd web-admin
npx eslint src/features/workflow/ui/simple-processing-*.tsx src/features/workflow/ui/processing-table.tsx app/dashboard/processing/page.tsx --quiet
npx tsc --noEmit
npm run check:i18n
npm run build
```

Manual smoke matrix:

1. Ready toggle → optional piece rack appears → Update → list progress updates; order stays `processing` (no order-level rack).
2. Notes-only edit (no checkboxes) → Update persists notes.
3. Split path when setting on (UUID pieces only); setting off hides Split.
4. Rejected piece: Ready disabled + tooltip; Un-reject enables Ready; Split still works; notes editable.
5. Report Issue succeeds via API; Send Receipt toast only.
6. Edit still opens full modal; opening Simple then Edit shares cache without stale Ready state.
7. Mobile card exposes Simple action.
8. Close with dirty changes prompts discard.

## Out of scope

- Wiring Send Receipt to receipt APIs.
- Piece-level issue targeting / photos.
- Changing mark-ready (CheckCircle) or full ProcessingModal behavior.
- Auto order→Ready from Simple dialog (no rack field in v1).
- Workflow engine consolidation from audit docs.
- Removing debug `console.log`s from existing full `ProcessingModal` (separate cleanup).

## Review notes (findings applied above)

Previous plan gaps that would have caused bugs or UX debt:

1. **Silent no-op Update** when pieces are synthetic / missing — batch-update filters them out.
2. **Ambiguous Notes** — locked to editable + persisted.
3. **Accidental order Ready** if rack were copied from full modal — locked to omit rack / no auto-transition.
4. **Screenshot green Update** vs real `CmxButton` variants — use `primary` + className, not invalid `success`.
5. **Metadata “Station 1” / staff** may not exist on API — degrade gracefully.
6. **Nested Issue + Split + parent** focus/dismiss races — serialize child dialogs.
7. **Cache drift** between Simple and full Edit — shared query keys + invalidate.
8. **Mobile omission** — card must be wired.
9. **Rejected pieces** — locked Simple policy: show + Un-reject; Ready disabled until un-rejected; Split allowed.
10. **Piece rack** — optional field revealed when Ready is checked; not order-level rack.