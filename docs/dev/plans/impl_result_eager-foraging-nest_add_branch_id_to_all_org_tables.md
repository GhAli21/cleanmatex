
eager-foraging-nest_add_branch_id_to_all_org_tables.md

Build passes. Here's the complete answer to your question:

Full Audit Results — Everything Checked
3 Additional Gaps Found & Fixed
#	Location	Gap	Fix
1	order-service.ts splitOrderByPieces	New items in split sub-orders missing branch_id	Added branch_id: item.branch_id ?? suborder.branch_id ?? null
2	order-service.ts updateOrder	New items + pieces created during order edit missing branch_id	Added branch_id: branchId ?? existingOrder.branch_id ?? null to item create; passed same to createPiecesForItemWithTx
3	pieces/route.ts POST	Direct piece creation via API bypassed branch_id	Extended select to include branch_id, passed it as 8th arg to createPiecesForItem
Everything Else — Clean
Area	Status
Prisma schema — all 8 models	Done (previous step)
prisma generate + npm run build	Pass
All service INSERT paths	All set
Preparation service	Uses supabase directly, reads items via select('*') — no inserts to the 8 tables
Inventory org_inv_stock_tr	Already had branch_id before (migration 0103)
Type mappers (mapOrderFromDb, etc.)	Use select('*') — no explicit column lists missing branch_id
API routes — no hidden direct inserts found	Clean
Seed/fixture files	None found for these tables
Report queries	Filter by tenant_org_id only — branch filtering is a future feature, not broken
Total coverage: 100% of INSERT paths for all 8 tables now correctly set branch_id.

=========================

Migration file created: 0138_add_branch_id_remaining_transaction_tables.sql

What it does — 8 tables, fully idempotent:

Table	Backfill Chain
org_order_items_dtl	← orders
org_order_item_pieces_dtl	← orders
org_order_item_processing_steps	← orders
org_asm_exceptions_tr	← asm_tasks (already had branch_id)
org_dlv_stops_dtl	← dlv_routes → fallback orders
org_dlv_pod_tr	← dlv_stops (filled just above it)
org_qa_decisions_tr	← orders
org_pck_packing_lists_mst	← orders → fallback asm_tasks
Every table follows the same pattern as 0106: nullable UUID, composite FK with ON DELETE SET NULL, partial index WHERE branch_id IS NOT NULL, and a column comment.

Ready to apply — confirm when you want to run it against local Supabase.

===============

All 6 service files are done. Here's the full summary:

Changes Made
order-service.ts
Supabase path (createOrder): Added branch_id: branchId ?? null to itemsToInsert (order items) and passed branchId as the new last argument to OrderPieceService.createPiecesForItem()
Prisma path (createOrderInTransaction): Added branch_id: branchId ?? null to both the org_order_items_dtl.create() call and the inline piecesData array for org_order_item_pieces_dtl.createMany()
order-piece-service.ts
Added optional branchId?: string parameter to both createPiecesForItem() and createPiecesForItemWithTx()
Added branch_id: branchId ?? null to the piece insert payload in both methods
item-processing-service.ts
Extended the existing org_order_items_dtl select from 'service_category_code' to 'service_category_code, branch_id'
Added branch_id: orderItem.branch_id ?? null to the org_order_item_processing_steps insert — no extra query needed
assembly-service.ts
createException(): Added branch_id: (task as any).branch_id ?? null — task is already fetched with select('*')
performQA(): Added branch_id: (task as any).branch_id ?? null — task is already fetched
packOrder(): Added branch_id: (task as any).branch_id ?? null — task is already fetched
delivery-service.ts
createRoute() → stops: Added branch_id: (order as any).branch_id ?? null — order is already fetched per stop in the loop
generateOTP() → POD: Extended stop select from 'id' to 'id, branch_id', added branch_id: (stop as any).branch_id ?? null to the new POD insert
capturePOD() → POD: Added branch_id: (stop as any).branch_id ?? null to podData — stop is already fetched with select('*', ...)
Zero extra DB queries added — branch_id is derived from data already being fetched in each method.

=======================

Prisma Schema Changes
Added branch_id String? @db.Uuid + org_branches_mst relation + branch index to all 8 models:

Model	Field added	Relation map	Index
org_order_items_dtl	branch_id?	fk_ord_items_branch	idx_ord_items_branch
org_order_item_pieces_dtl	branch_id?	fk_ord_pieces_branch	idx_ord_pieces_branch
org_order_item_processing_steps	branch_id?	fk_ord_proc_steps_branch	idx_ord_proc_steps_branch
org_asm_exceptions_tr	branch_id?	fk_asm_exc_branch	idx_asm_exc_branch
org_dlv_stops_dtl	branch_id?	fk_dlv_stops_branch	idx_dlv_stops_branch
org_dlv_pod_tr	branch_id?	fk_dlv_pod_branch	idx_dlv_pod_branch
org_qa_decisions_tr	branch_id?	fk_qa_dec_branch	idx_qa_dec_branch
org_pck_packing_lists_mst	branch_id?	fk_pck_list_branch	idx_pck_list_branch
org_branches_mst model got 8 new back-relation arrays added.

prisma generate ran successfully and npm run build passes with no errors.

==========================

