# WP06 Item and Piece Projection

**Date:** 2026-10-14 (Asia/Muscat)
**Status:** DONE for the in-memory structural contract. Preview, Apply, and persistence are later packages.
**Authority:** Living plan WP06, Operation Capability Catalog structural quantity gate, Production Implementation Specification projection section, and Frozen Invariants.

## Scope delivered

`projectOrderChangeStructure` is a pure in-memory projection. It does not open a database connection, create a Change row, change workflow state, or price a line. Create product grouping is untouched.

The frozen quantity contract is:

- `ADD_ITEM` quantity is the new line quantity. `ADD_PIECE` on that new line materializes pieces up to that quantity and does not add a second delta.
- An existing tracked increase is owned by `CHANGE_ITEM_QUANTITY`. Matching later `ADD_PIECE` calls fill `piecesNeeded` and do not increment quantity again. An `ADD_PIECE` with no quantity owner increments an existing tracked line by exactly 1.
- A tracked decrease removes each selected eligible piece once. A later `REMOVE_PIECE` for one of those same ids is absorbed.
- A local item added and removed in the same batch is omitted. `createsChange` is false and the effect list is empty.
- Persisted item and piece ids stay on the same ids. Parent removal marks the item and its pieces inactive. It does not drop those ids.
- Zero or negative quantity, a protected piece, a child operation after parent removal, an unresolved local parent, and a piece count that does not match a tracked quantity are rejected.

## Files

- `web-admin/lib/services/order-change/order-change-projection.ts`
- `web-admin/__tests__/services/order-change/order-change-projection.test.ts`

No migration, permission, feature flag, route, or UI file was added.

## Verification

Command, from `web-admin`:

```text
npx jest __tests__/services/order-change/order-change-projection.test.ts --runInBand --forceExit --watchman=false
```

Result: 1 suite, 8 tests passed. Covered cases: duplicate product lines, duplicate sequence with distinct ids, three-piece materialization of quantity 3, local add/remove no-op, quantity 0 and negative, selected-piece reduction absorbed once, protected piece, parent/child conflict, persisted id retention, and an unresolved local parent.

Targeted ESLint on the projection source and test exited 0. No repository-wide typecheck or production build is claimed. No database or browser proof applies, because this package has no schema and no screen.

## Dependencies

- Depends on WP04 operation identities and WP05 capability remaining outside this function. The projection does not authorize an operation.
- WP07 consumes the structural result before projecting preferences.
- WP08 and later must price the projected facts. They must not re-derive quantity.

## Gaps left to later packages

- The HTTP schema still accepts `REMOVE_ITEM` and `REMOVE_PIECE` only for persisted ids. The projector also accepts a same-batch local target so an uncommitted add/remove becomes a no-op. WP10 kept that split: the public Preview request was not widened.
- No Preview or Apply route calls this function yet.
- No physical writer is proven. Inactive persisted rows are an in-memory result only.
- Existing tracked `ADD_PIECE` without `CHANGE_ITEM_QUANTITY` uses the frozen +1 rule. A batch that both increments by loose `ADD_PIECE` calls and then sets quantity must still satisfy the final piece-count check.

## Database, API, and UI

No database object changes. No new endpoint. The UI specification rows that mention quantity selection remain WP13/WP14 work. This package supplies the semantic result those screens will later display.
