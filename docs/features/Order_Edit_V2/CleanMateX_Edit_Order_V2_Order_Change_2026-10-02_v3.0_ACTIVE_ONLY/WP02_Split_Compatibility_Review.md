# WP02 Split Compatibility Review — Current Repository Evidence

**Date:** 2026-10-02 (Asia/Muscat)  
**Scope:** source/split compatibility review for additive Edit V2 foundation. No split refactor or runtime gate is implemented.  
**Repository:** main, HEAD `a5fc878f4db53d83f3002e76036c3e613a28bc86`; current dirty source inspected.  
**Authority:** active v3.0 architecture and the single living implementation plan. This is evidence supporting WP02, not a competing plan.

## Verdict

**Current split paths are incompatible with assuming universal immediate live hierarchy enforcement or V2 stable-ID/atomic split semantics.** Deferring a foreign key does not repair independent Supabase HTTP transactions or a final hierarchy that remains inconsistent. Historical Change references must use immutable tenant/entity identity, never an FK to a target's mutable live order/parent.

## Exact active paths and mutations

| Path | Current behavior | Identity/hierarchy/history impact |
|---|---|---|
| `web-admin/app/api/v1/orders/[id]/split/route.ts:62`, `:72` | Calls piece helper if pieceIds supplied, otherwise item helper. No expected edit/workflow version or command idempotency in request. Local auth picks tenants[0] (`:27`); no permission/CSRF guard is visible in the route. | This is an existing separate operational owner, not Order Change Apply. Server auth/tenant/current-parent/capability/locking review is needed before V2 qualification; browser gates do not close it. |
| `OrderService.splitOrder` (`web-admin/lib/services/order-service.ts:1872`) | Reads parent with tenant predicate; loads requested items under parent+tenant `:1902`; creates child `:1924`; moves item UUIDs by updating order_id `:1964`; updates parent `:1980`; logs separate history RPC `:1987`. | Item IDs survive. No piece or preference order_id updates occur. Item UPDATE only uses id list and parent UPDATE only id, lacking explicit tenant/parent predicates. No encompassing tx/lock/OCC, rec_status predicate or command replay. Midfailure may leave child/parent/item facts partially committed. |
| `OrderService.splitOrderByPieces` (`:2732`) | Parses synthetic itemId-piece-number `:2752`; loads items only by item UUID+tenant `:2785` (not parent order); creates child `:2799`; clones new item IDs `:2839`; decrements original quantity `:2860`; appends history `:2878`. | Never reads/transfers/clones persisted piece rows or preferences. No persisted piece identity/hierarchy/scan/history transfer. Quantity count can be derived from duplicate/ineligible synthetic values; source quantities may become invalid. Separate Supabase commits; no order locks/OCC/idempotency; mutation errors are not consistently checked. |
| Current Simple Processing UI (`src/features/workflow/ui/simple-processing-dialog.tsx:330`, `:610`, `:949`) | Selects only persisted piece UUIDs and posts them to split route. `lib/processing-piece-map.ts` maps actual dbPiece.id. | UUID input cannot match the service's synthetic itemId-piece-N regex: returns No valid piece IDs found. This is a current concrete contract mismatch, not a proposed split concern. |
| Processing Modal (`src/features/workflow/ui/processing-modal.tsx:535`, `:638`) | Posts selected piece IDs to same route; no expected versions/key | Must reconcile actual identity/eligibility through existing owner before treating split as supported for V2 targets. |
| Lifecycle readers/removal | Pieces soft-remove via rec_status0 (`order-piece-service.ts:1559`); item/piece/preference rec_status is nullable in current schema. Current split item reads do not filter active state. | NULL cannot silently be treated as1; removed rows must not be selected/moved/renumbered by normal split. Readiness sync currently lacks rec_status predicate (`order-piece-service.ts:1490`), requiring later active-reader qualification. |

Scoped searches of order services/actions/routes found these two split implementation helpers and their callers. No separate transactional bulk-transfer/delete implementation was found in that scope. This is not proof about uninspected direct Data API/RPC or target-installed functions; the security catalog review remains required. The SQL workflow policy's orders_split_enabled flag does not make these mutations transactional or implement a piece mover.

## Composite-key and FK compatibility decision

Current item identity keys already exist: (id,tenant_org_id) and (id,order_id,tenant_org_id) (`prisma/schema.prisma:761`, `:762`). Stable IDs are reusable. Preferences currently reference parent item/piece by id-only FKs (`:805`, `:806`); piece order/item columns are separate facts. These observations do not authorize duplicating existing keys or assuming target data is consistent.

1. **Historical identity FKs:** Change/operation/removal lineage may reference immutable (id,tenant_org_id) keys. The master Change retains originating order and before/after parent snapshots. Do not constrain a historical target reference using its current order_id/item parent: legitimate later reparenting must not invalidate immutable history. Delete/update cascades rewriting historical facts are forbidden.
2. **Live all-row hierarchy FKs are not immediately compatible with current item split.** Updating item.order_id while pieces/preferences still carry the old order violates (tenant,order,item) consistency. NOT VALID skips checking old rows only; it still enforces new/updated rows and may reject the existing split write.
3. **DEFERRABLE is insufficient for the current source.** The split helper performs separate PostgREST statements, each committed independently, and never moves descendants. A deferred check sees an invalid hierarchy at the item statement's transaction commit. Merely declaring INITIALLY DEFERRED does not create a transaction or repair the final data.
4. **Even a future atomic mover needs a reviewed removed-row model.** If active item UUID moves to another order while its removed piece/preference remains at immutable historical origin, an all-row FK tying removed row.order_id to the parent's current order_id still fails. Deferral cannot fix that final inconsistency. Either deny the relevant split, or approve explicit immutable-origin/live-hierarchy semantics and scoped enforcement compatible with removed descendants; no design is silently invented in WP02.
5. **Foundation authoring gate:** retain existing parent constraints and add proven tenant identity/removal-lineage foundation without asserting universal split-safe live hierarchy completion. Any new hierarchy FK that affects current split must have a reviewed compatibility decision before creation/enforcement. A disabled V2 flag alone does not protect legacy split availability from an enforcing constraint. Do not use CASCADE, mutate old migration files or weaken tenant isolation to make split pass.

## Later fail-closed V2 qualification

This section describes required acceptance for the existing split owner; it is not implementation authorization.

Before enabling V2 for orders that can split, either a reviewed runtime policy denies unsupported split targets/cohorts, or the existing split owner must prove transactional source/destination order locks in deterministic tenant/order order, expected workflow/commercial versions, actor/permission/source verification, persisted piece UUIDs, active target hierarchy, atomic item/piece/preference moves, correct quantities/sequence, immutable Change/history lineage, and Finance obligation reconciliation. Missing policy fails closed. Protected/processed/removed/NULL-classified targets cannot be guessed as eligible. No historical target UUID/history is deleted or rewritten.

A child order commitment source/actor/time must be qualified separately (see Backfill Source Matrix). Do not copy parent committed_at or infer child commitment from child.created_at, intake status, source total or separate SPLIT history entry. Source and child active reader/financial invariants are validated after the atomic operation, while removed facts retain their approved history semantics.

## Required external verification and test gates

- Target catalog/data: actual identity unique keys, FK validation state, deferrability, installed triggers/functions, order/item/piece/preference hierarchy mismatches, active/inactive/NULL classifications, orphan/duplicate targets and real grants.
- Disposable DB/operator-reviewed foundation: existing Create and legacy split compatibility; no agent applies migrations or writes production fixtures.
- Change→split and split→Change: same IDs/history, preferences at all levels, removed descendants, source/child snapshot reconciliation, same-product lines and sequence uniqueness.
- Parallel Change/split/workflow/Finance: deterministic locks; bounded conflicts; rollback after every transfer stage; durable split command replay where supported.
- Threat cases: same-tenant wrong-order item, foreign-tenant item/piece, forged actor, stale versions, missing permission/CSRF, duplicate/synthetic IDs, NULL/removed rows and direct Data API/RPC bypass.

No split tests, migration execution, data repair or runtime changes were performed for this document. **WP02 must not claim live hierarchy completion; WP17/WP18 own source qualification and execution proof before V2 split support or rollout.**
