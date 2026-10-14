# WP07 Preference Projection and Charge Cache

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** PARTIAL — in-memory preference projection and single-count contribution cache is implemented and focused-tested; retroactive reuse/domain-boundary governance audit is required before unqualified DONE status.
**Authority:** Living plan WP07, Operation Capability Catalog preference rows, `lib/utils/order-charge-money.ts` single-count rule, and the WP06 structural projection.

## Scope delivered

`projectOrderChangePreferences` applies structural operations through WP06, then projects `ADD_PREFERENCE`, `CHANGE_PREFERENCE`, and `REMOVE_PREFERENCE`.

- Catalog facts supply definition, code, kind, category, level, and extra price. A payload code that does not match the catalog is rejected.
- ORDER, ITEM, and PIECE each use the same operations. ORDER has no item or piece. ITEM requires an active item. PIECE requires an active piece and uses that piece's parent item.
- A content change keeps the persisted preference id, kind, and `processingConfirmed` value. Confirmation is not edited here.
- A different definition on an existing row is rejected. The supported replacement is remove plus add.
- An explicit preference edit whose parent item or piece is inactive conflicts. Baseline preferences under a removed parent become inactive without a second removal.
- A local preference added and removed in the same batch is omitted and does not by itself create a change.
- An unchanged content edit does not create a change.
- Active ORDER extras sum once into `charges.orderAddend`. Active ITEM extras and PIECE extras for the same item sum once into `charges.lineEmbeddedByItemId`. Removed rows are not included. ITEM and PIECE extras are not added to the order addend.

## Files

- `web-admin/lib/services/order-change/order-change-preference-projection.ts`
- `web-admin/__tests__/services/order-change/order-change-preference-projection.test.ts`

No migration, catalog seed, permission, feature flag, route, or UI file was added. Global preference catalogs and operational confirmation behavior are unchanged.

## Verification

Command, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-preference-projection.test.ts --runInBand --forceExit --watchman=false
```

Result: 1 suite, 7 tests passed. Covered cases: one ORDER packing, ITEM condition, and PIECE service-note add; stable id and an untouched row; catalog code mismatch; kind swap rejection; child edit after parent removal; remove-plus-add replacement counted once; local add/remove no-op; cross-order piece rejection; unchanged content.

Targeted ESLint on the preference projection source and test exited 0 in the same command as WP06. No repository-wide typecheck, production build, database test, or browser test is claimed.

## Dependencies

- Requires the WP06 structural result for parent activity.
- Uses the already reviewed money rule: only ORDER preference charges are separate addends. This package does not recalculate line `total_price`.
- WP08 must turn these contribution figures into mode-correct selling totals. WP11 must persist logical preference changes inside the caller transaction. The current preference services still hard-delete and are not the Change writer.

## Gaps left to later packages

- `charges` is a contribution cache, not an order selling total, tax result, or financial snapshot.
- The HTTP schema accepts `REMOVE_PREFERENCE` for a persisted preference. Same-batch local cancellation is projector input, as with WP06, and is not yet a public route contract.
- No existing item, piece, or order preference route was replaced.
- A removed parent inactivates descendant preferences in memory. Historical follow-up notes are not projected or deleted.

## Governance adoption note — 2026-10-14

This package was implemented before `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md` was adopted. Its existing focused tests and scope evidence remain valid, but they do not prove the newly required reuse/domain-ownership/separation-of-concerns gate.

Before this package returns to unqualified `DONE`, perform the retroactive audit required by that governance contract against the actual codebase. Classify each significant component as `REUSE_AS_IS`, `REUSE_WITH_EXTENSION`, `REFACTOR_AND_REUSE`, `REPLACE`, or `NEW_REQUIRED`; inspect relevant legacy Edit behavior; verify canonical domain ownership, single-source-of-truth and dependency direction; then record any remediation and re-run affected tests.

No defect is asserted merely by this status change. The missing artifact is the newly required architecture/governance evidence.

## Database, API, and UI

No database object changes. No new endpoint. Preference screens remain later UI packages. They must call this projection rather than introduce a second preference model.
