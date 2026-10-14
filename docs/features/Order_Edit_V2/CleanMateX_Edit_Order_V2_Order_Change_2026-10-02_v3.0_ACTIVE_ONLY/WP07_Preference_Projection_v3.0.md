# WP07 Preference Projection and Charge Cache

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for in-memory preference projection and the single-count contribution cache. Persistence, route replacement, and selling totals remain later packages.
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
- Active ORDER extras sum once into `charges.orderAddend` through `sumMoneyAddendCharges`. Active ITEM extras and PIECE extras for the same item sum once into `charges.lineEmbeddedByItemId` through `isContaminatingPreferenceCharge`. Removed rows are not included. An extra price that is not a valid money amount is rejected before either helper can treat it as zero.

## Files

- `web-admin/lib/services/order-change/order-change-preference-projection.ts`
- `web-admin/__tests__/services/order-change/order-change-preference-projection.test.ts`

No migration, catalog seed, permission, feature flag, route, or UI file was added. Global preference catalogs and operational confirmation behavior are unchanged.

## Verification

Command, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-preference-projection.test.ts --runInBand --forceExit --watchman=false
```

Result on 2026-10-14 after the reuse remediation: 1 suite, 7 tests passed. Covered scenarios OC-PREF-001 through OC-PREF-008 for the in-memory slice: one ORDER packing, ITEM condition, and PIECE service-note add; stable id and an untouched row; catalog code mismatch; kind swap rejection; child edit after parent removal; remove-plus-add replacement counted once; local add/remove no-op; cross-order piece rejection; unchanged content.

Targeted ESLint on the preference projection source exited 0 together with the WP08 and WP09 sources. No repository-wide typecheck, production build, database test, or browser test is claimed. Manual UI scenarios for this package stay `NOT_EXECUTABLE_YET`.

## Dependencies

- Requires the WP06 structural result for parent activity.
- Uses the already reviewed money rule: only ORDER preference charges are separate addends. This package does not recalculate line `total_price`.
- WP08 must turn these contribution figures into mode-correct selling totals. WP11 must persist logical preference changes inside the caller transaction. The current preference services still hard-delete and are not the Change writer.

## Gaps left to later packages

- `charges` is a contribution cache, not an order selling total, tax result, or financial snapshot.
- The HTTP schema accepts `REMOVE_PREFERENCE` for a persisted preference. Same-batch local cancellation is projector input, as with WP06, and is not yet a public route contract.
- No existing item, piece, or order preference route was replaced.
- A removed parent inactivates descendant preferences in memory. Historical follow-up notes are not projected or deleted.

## Existing code reuse and domain ownership — 2026-10-14

| Requirement | Existing code found | Canonical domain | Classification | Reused or changed files | Reason |
|---|---|---|---|---|---|
| Preference identity, kind replacement, parent conflict | `order-item-preference.service.ts` and piece counterparts hard-delete and own their own writes | Preferences | NEW_REQUIRED | `order-change-preference-projection.ts` | No safe Change writer exists. The projector keeps ids and does not call the hard-delete services. |
| ORDER versus ITEM/PIECE extra split | `isMoneyAddendCharge`, `sumMoneyAddendCharges`, `isContaminatingPreferenceCharge` | Charges | REUSE_AS_IS | `lib/utils/order-charge-money.ts` | The projector now builds charge rows and asks those helpers. Invalid prices still fail before a helper can treat them as zero. |
| Four-decimal contribution text | `round4` | Money | REUSE_AS_IS | `order-financial-aggregation.ts` | Scale stays with the existing money helper. |

### Component record

| Field | Value |
|---|---|
| Component | `projectOrderChangePreferences` |
| Domain owner | Order Change orchestration; charge split owned by `order-charge-money.ts` |
| Responsibility | Project preference rows and a contribution cache |
| Should be domain-agnostic | No |
| Existing equivalents reviewed | Item and piece preference services; charge-money helpers |
| Canonical dependencies | WP06 structure, `order-charge-money.ts`, `round4` |
| Legacy Edit behavior reviewed | Current preference writes hard-delete. Useful identity and level rules were kept in the projector. |
| Classification | NEW_REQUIRED for projection; REUSE_AS_IS for the addend split |
| Why new code is required | No transactional preference Change adapter exists |
| How duplication is prevented | The projector does not reimplement the ORDER addend rule |
| Architecture verdict | Pass for this in-memory slice |

### Legacy behavior

| Legacy behavior | Keep behavior? | V2 destination | Legacy status |
|---|---|---|---|
| Hard-delete preference routes | No, for committed Edit | Logical remove inside a later Apply transaction | TEMPORARY_COMPATIBILITY while legacy Edit remains the live path |

## Database, API, and UI

No database object changes. No new endpoint. Preference screens remain later UI packages. They must call this projection rather than introduce a second preference model.
