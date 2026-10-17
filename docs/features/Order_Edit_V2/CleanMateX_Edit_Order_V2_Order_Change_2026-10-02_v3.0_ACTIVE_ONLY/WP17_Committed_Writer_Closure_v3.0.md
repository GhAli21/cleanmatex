# WP17 Committed writer closure

**Date:** 2026-10-15 (Asia/Muscat)
**Status:** CLOSED for the delivered writer scope. The direct-grant column guard is postponed in [WP17 postponed](WP17_Postponed_Committed_Column_Guard_v3.0.md). WP18 is partial.
**Authority:** Living plan WP17 and Part 7. Create, workflow readiness, and finance writers stay with their owners.

## Scope delivered

A committed order with Edit Order V2 on already receives `409` from the old full-order save, preparation item routes, piece create and delete, commercial piece fields, preferences, packing, bundles, conditions, and the fix-order-data route.

Edit Order Apply now inserts a new item, soft-removes an item or piece, and updates quantity using the reviewed line price. Existing piece ids stay. A new piece gets its own id. The financial snapshot is recalculated, and a total mismatch rolls the Change back.

Processing batch update still marks pieces ready. When the order is committed and Edit Order V2 is on, an unchanged note, stain, or damage flag is ignored. A different value returns `409` and nothing is written.

Charge void and preference-charge repair lock the order row before they change money, using the same order lock as Change.

`supabase/migrations/0627_fix_order_data_refuse_committed.sql` is applied on the local and remote databases. A real run refuses a committed order and skips committed orders in a tenant-wide run. A dry run stays read-only. Migration `0113` was not edited. The function arguments did not change, so application types did not need regeneration.

The Edit Order screen already sends these structural operations when the policy allows them. Those controls are now marked supported.

No new permission, feature flag, navigation entry, or billing change.

## Postponed

The direct table-grant column guard is postponed by decision on 2026-10-15. The grants stay. The later trigger is specified in [WP17 postponed](WP17_Postponed_Committed_Column_Guard_v3.0.md). It is not a WP18 task.

## Next

WP18 — target preflight, backfill, and concurrency/security release proof. It is not started.
