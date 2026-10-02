# CleanMateX Edit Order V2 — Frontend / UI / UX Specification

**Version:** 3.0  
**Route:** `/dashboard/orders/[id]/edit`

## 1. UX objective

Keep the familiar New Order workspace but make Edit a separate controller/session. The user edits a local projected order, reviews authoritative server Preview, then explicitly Applies one atomic Change.

## 2. Required screen structure

```text
Edit Order Page
  Edit Context Bar
  Shared Customer/Order Header (restricted fields in Edit)
  Shared Product Catalog
  Shared Order Items / Piece / Preference editors
  Shared Order Summary
  Edit-specific Review Changes primary action
  Edit-specific dialogs/sheets:
    Piece Selection
    Review Changes
    Warning/Override/Reason
    Conflict / Reload Latest
    Financial Result / Follow-up
```

## 3. Controller state

EditOrderController owns:

```text
loadStatus: IDLE|LOADING|READY|BLOCKED|PERMISSION_DENIED|NOT_FOUND|ERROR
originalContext
workingState
editStateVersion
wfStateVersion
capabilities/configuration
normalizedPendingOperations
previewStatus: IDLE|DIRTY|LOADING|READY|STALE|ERROR
previewResult/reviewProof
applyStatus: IDLE|SUBMITTING|UNKNOWN_RESULT|SUCCEEDED|ERROR
idempotencyKey
conflict
financialFollowUp
```

Shared presentational components receive callbacks/view models; they do not decide API route based on a sprawling `isEditMode` branch.

## 4. Stable client identity

- existing item: persisted item UUID;
- new item: client UUID;
- existing piece: persisted piece UUID;
- new piece: client UUID;
- existing preference: persisted preference row UUID;
- new preference: client UUID.

Never use `productId` as list identity and never replace committed piece identity with `temp-${productId}-${index}`.

## 5. Local visual state

Every visible target may be:

`UNCHANGED`, `ADDED`, `CHANGED`, `REMOVED`.

Persisted removed rows remain visible/faded with Undo until Apply. A locally new row removed before Apply disappears and emits no operation.

## 6. Context bar

Display:

- `Editing Order #<number>`;
- `Revision <editStateVersion>`;
- workflow status;
- unsaved change count;
- Edit blocked/warning indicator where relevant;
- `Discard Changes`.

Do not call navigation-away action “Cancel Order”.

## 7. Field behavior

### Read-only V1

- customer identity;
- branch;
- currency;
- order source/type where identity-defining;
- POS session/create-time construction fields.

### Governed editable

According to capability/configuration:

- items/quantities;
- pieces;
- generic preferences;
- priority;
- service speed;
- ready-by customer commitment override;
- approved order/customer snapshot notes/contact corrections.

## 8. Quantity/piece UX

For piece-tracked committed items, quantity decrease cannot blindly decrement. Open eligible-piece selection and generate `REMOVE_PIECE` operations. Add piece increases quantity. Protected/processed pieces show a reason and cannot be selected if denied.

## 9. Estimated money

During local edits show clearly labelled estimate:

- Current Total;
- Estimated New Total;
- Estimated Change.

Do not label estimated delta as “Pay now”. Server Preview is authoritative.

## 10. Review Changes

Primary action: `Review Changes`.

The review dialog/sheet displays grouped:

- items;
- pieces;
- preferences;
- priority/service speed/ready-by/notes;
- price/discount/tax/charge effects;
- Current Total / New Total / commercial delta;
- financial outcome (outstanding/overpayment);
- warnings;
- required reason;
- override requirement;
- unsupported/fiscal blocking reason.

Apply is available only from a valid current Preview. Any local edit invalidates the Preview/proof.

## 11. Conflict UX

For edit/workflow/review conflict:

- never auto-merge V1;
- show what became stale when safe;
- primary: `Reload Latest Order`;
- secondary: inspect/copy unsaved intent where practical;
- do not silently overwrite latest data.

Network failure after unknown Apply result retries with the **same idempotency key and identical payload**.

## 12. Global edit blocked UI

`TEMPORARILY_BLOCKED`: show reason and expiry if available; no editing controls.  
`PERMANENTLY_BLOCKED`: show permanent reason; no override button.  
Feature disabled/not entitled: route/access contract should prevent normal entry and show established feature/access UI.

## 13. Apply success

Refresh authoritative context/history/financial summary, clear dirty state and show revision. Then:

- `NONE` => return/view order;
- `OUTSTANDING_*` => offer/require supported additional collection according to Finance policy;
- `OVERPAYMENT` => open focused Financial Resolution if the user chooses/needs to resolve now.

Failure in later Finance follow-up does not undo the successful Change.

## 14. Loading/empty/error states

- skeleton/loading uses existing Cmx patterns;
- order not found/foreign tenant uses generic not-found;
- configuration dependency failure is explicit retry/support error, not zero-price/tax fallback;
- Quick Drop may legitimately have zero detailed items and shows detailing affordance;
- no-change review is disabled or returns a clear “No changes to apply”.

## 15. Accessibility / i18n / RTL

- all new text uses existing EN/AR message framework and glossary;
- RTL-safe alignment/order/icons;
- keyboard operable dialogs, focus trap/return, labelled fields and errors;
- do not communicate removed/changed state by color alone;
- money formatting follows currency configuration; stored numeric precision is not UI decimal formatting.

## 16. Responsive/POS behavior

Desktop and tablet/POS layouts must keep the Review action reachable without duplicate Save buttons. The review sheet can become full-screen on narrow devices. Do not introduce horizontal overflow in item/piece tables/cards.


## 17. Current UI reconciliation and controller acceptance

Current implementation evidence (not V2 completion):

| Surface | Current code | V2 acceptance / package |
|---|---|---|
| Route/context | `app/dashboard/orders/[id]/edit/page.tsx:52` fetches general GET, then coarse editability and lock; a failed editability request is skipped (`:69`). Page has raw button/loading text (`:131`, `:146`). | Keep `[id]`; route composes the gated Edit controller. One Change context owns permissions/capabilities/policy and failure states. Use Cmx loading/retry/denial and translated strings; no fail-open dependency. WP04/05/13/14. |
| Item/piece/preference mapping | `ui/edit-order-screen.tsx:48` discards item ID, `:51` replaces piece ID with a product/index temp ID; preference mapping carries catalog ID, not persisted row identity (`:75`). | Typed context/view models retain every persisted row ID, parent ID, generic kind/content and lifecycle state; same-product lines stay independent. WP04/07/13. |
| Shared state | `model/new-order-types.ts:94`, `:123`; `ui/context/new-order-reducer.ts:192` merges by product; `:259` trims pieces on decrease. | Separate Edit reducer/view models; Create's existing product/cart semantics remain protected. Shared editors accept stable-ref callbacks. Committed quantity decrease uses eligible piece selection and removal/undo. WP06/13/14. |
| Dirty detection | `lib/order-edit-dirty.ts:121` builds a product-ID Map; pieces compare sequence/index (`:83`). | Build normalized semantic intent by persisted/client UUID; no-op undo clears dirty state; notes/zero-money changes remain valid Changes. WP06/13. |
| Submit/retry | `hooks/use-order-submission.ts:884` saves full payload to PUT and creates a new key per invocation (`:978`); shared content directly invokes Save in keyboard handling (`ui/new-order-content.tsx:552`) and primary action (`:902`). | Edit never calls Create/legacy PUT. All primary/keyboard paths enter Review; Apply uses one frozen reviewed payload/key and explicit unknown-result recovery. WP13–15. |
| Existing usable UX | `hooks/use-order-edit-dirty.ts:22` detects current dirty state; `ui/new-order-content.tsx:171`, `:937` has unsaved-leave/cancel confirmation; `ui/edit-order-bar.tsx:55` has translated Cmx controls/RTL. | Reuse guard/dialog presentation via Edit controller; retain unsaved intent during known rejection/conflict, release owned advisory lock on confirmed navigation, and never flip an Edit route into Create. WP13–15. |
| Route access | `src/features/orders/access/orders-access.ts` owns current `/dashboard/orders/[id]/edit` contract with legacy orders:update API dependencies. | Derive/wire/sync existing route contract for proposed orders:edit and dedicated V2 entitlement; server repeats enforcement. No new sidebar entry is required merely to reuse this route. WP05/14. |
| Preferences/Preparation | Existing pre-submission editor assumes product/sequence; Preparation is a separate current entry through `app/dashboard/preparation/[orderId]/page.tsx` and `app/actions/orders/complete-preparation.ts`. | Keep operational workspace; committed detailing adapters must submit governed intent with IDs/versions. No direct commercial save or new Create draft masquerading as committed Edit. WP07/17. |

## 18. Uncertain Apply, proof invalidation and financial follow-up

UNKNOWN_RESULT means the request may have committed. Freeze the exact reviewed request body and idempotency key before the first Apply. Disable further editing, new Apply keys, Review replacement and financial follow-up while that result is uncertain. Retry/recover the original command with the same body/key; a generic context refresh or observed total cannot identify whether that command committed. The API catalog owns durable replay/expiry and conflict statuses. Only a definitive replay/result clears uncertainty; show retry/support guidance with a safe request reference. Do not treat navigation, dialog close, parse failure, timeout or key-cache expiry as proof of failure.

Any local operation/target/reason/override/acknowledgement change invalidates Preview and its proof. A server denial, expired proof, material configuration drift or expected-version conflict disables Apply until current review/context is obtained. Apply double-click and keyboard submission share one in-flight command. A known version conflict keeps read-only inspectable local intent and offers Reload Latest; no automatic merge.

Successful Apply clears dirty state once and refreshes context/history/financial result. Additional collection and resolution use separately qualified Finance routes/permissions/idempotency; their DTOs are not the New Order checkout payload. Missing permission shows a safe unavailable action and current remaining obligation; it does not misreport Change failure. Required collection policy must define order operational gate/handoff and permission-denied handling through Finance/Workflow at WP09/16; closing a dialog cannot imply settlement. Failed/uncertain Finance follow-up retains the committed Change and its source lineage.

All new/edited feedback uses cmxMessage/useMessage with resolved EN/AR strings; CmxSummaryMessage/CmxConfirmDialog and field validation retain their documented exceptions. Dirty/removed/warning states need text or icons in addition to color. WP15/18 must prove focus trap/return, reason/error association, keyboard Review/Apply, Arabic RTL and narrow POS layouts against actual dialogs, not locale-key parity alone. The Requirement Traceability Matrix contains required tests and current limitations.
