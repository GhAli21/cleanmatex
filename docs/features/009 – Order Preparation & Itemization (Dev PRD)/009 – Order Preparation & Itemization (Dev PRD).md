# 009 – Order Preparation & Itemization (Dev PRD)

## Scope

Implement fast itemization for orders created via Quick Drop: add/edit items, assign services, compute pricing, generate barcodes, print item labels, and mark preparation complete. Enforce multi-tenancy and RLS. Update `docs/plan_cr/009_order_preparation_itemization_dev_prd.md` as source of truth.

## Key Files (new/updated)

- Database
- `supabase/migrations/0012_order_intake_enhancements.sql` (verify/extend)
- New migration `supabase/migrations/0015_preparation_itemization.sql`
- Server (Next.js app routes/server actions)
- `web-admin/lib/db/orders.ts` (add preparation helpers)
- `web-admin/app/api/v1/preparation/route.ts` (list pending)
- `web-admin/app/api/v1/preparation/[id]/start/route.ts`
- `web-admin/app/api/v1/preparation/[id]/items/route.ts`
- `web-admin/app/api/v1/preparation/[id]/items/[itemId]/route.ts`
- `web-admin/app/api/v1/preparation/[id]/complete/route.ts`
- Client (UI)
- `web-admin/app/dashboard/orders/[id]/page.tsx` (link to Prepare)
- New `web-admin/app/dashboard/preparation/[orderId]/page.tsx`
- New `web-admin/app/dashboard/preparation/components/FastItemizer.tsx`
- New `web-admin/app/dashboard/preparation/components/PresetButtons.tsx`
- New `web-admin/app/dashboard/preparation/components/ItemList.tsx`
- New `web-admin/app/dashboard/preparation/components/PricePreview.tsx`
- New `web-admin/app/dashboard/preparation/components/PrintItemLabels.tsx`
- i18n: `web-admin/messages/en.json`, `web-admin/messages/ar.json`

## Database Changes

- org tables already exist; extend where needed with indexes and audit:
- Ensure `org_orders_mst.preparation_status`, `prepared_at`, `prepared_by` present (0012 adds these).
- Ensure `org_order_items_dtl` holds `product_id`, `service_category_code`, `order_item_srno`, `barcode`, `quantity`, `price_per_unit`, `total_price`, `color`, `brand`, `has_stain`, `has_damage`, `notes`, `metadata` (exists in 0001).
- New objects (0015):
- Indexes: `(tenant_org_id, order_id)`, `(tenant_org_id, status)`, `(tenant_org_id, barcode)` on `org_order_items_dtl`.
- Generated serial per order: function to compute `order_item_srno` scoped to `(tenant_org_id, order_id)`.
- Trigger to auto-set `total_items`, `subtotal`, `tax`, `total` on `org_orders_mst` when items upsert/delete.
- RLS: verify/extend policies on both tables; tests to ensure isolation.

## API Design (Next.js routes; tenant filter always applied)

- GET `/api/v1/preparation/pending` → list orders where `status = 'intake' AND preparation_status in ('pending','in_progress')` (filter by `tenant_org_id`).
- POST `/api/v1/preparation/:id/start` → set `preparation_status = 'in_progress'`, lock by `prepared_by` if empty.
- POST `/api/v1/preparation/:id/items` → bulk add items. Validate product/service, compute prices from tenant catalog.
- PATCH `/api/v1/preparation/:id/items/:itemId` → update details/prices.
- DELETE `/api/v1/preparation/:id/items/:itemId` → remove item.
- POST `/api/v1/preparation/:id/complete` → mark `preparation_status = 'completed'`, update `status = 'sorting'`, set `prepared_at`, recompute order totals.
- GET `/api/v1/preparation/:id/preview` → recompute totals without commit.

Notes:

- Use service role only for label template fetches if needed; otherwise authenticated role with RLS. Always filter by `tenant_org_id`.
- Pricing: read from `org_product_data_mst` and `org_service_category_cf` with composite FK checks.

## Client/UI

- New route `dashboard/preparation/[orderId]` with fast entry:
- Presets (5x shirt, 2x pants, 1x thobe) configurable per tenant.
- Quick-add with service/category selection.
- Inline item editor: color, brand, stain/damage toggles, notes, photo upload (optional).
- Price preview and running totals.
- Barcode shown per item (generate client-side for label print; persist barcode string in DB).
- Actions: Save Draft, Complete & Continue.
- Add a "Prepare" primary action on `orders/[id]` when `status='intake'`.
- i18n/RTL: use existing message catalogs; ensure all labels use keys and support Arabic.

## Security & Multitenancy

- Every query scoped by `tenant_org_id` at application and DB layers.
- Enforce RLS on `org_orders_mst`, `org_order_items_dtl` with JWT claim `tenant_org_id`.
- Validate ownership of `orderId` before any mutation.
- Input validation and rate limiting on item bulk endpoints.

## Testing

- DB: migration applies cleanly; RLS tests for both tables; triggers compute totals accurately.
- API: unit tests for pricing, validation, and state transitions.
- UI: e2e flows for presets, bulk add, edit, complete; RTL/i18n snapshot checks.
- Performance: add 50 items in < 3s UI latency; 10 items end-to-end in ≤ 3 minutes.

## Rollout

1) Apply migration 0015 to local/Supabase; backfill indexes. 2) Ship API routes behind feature flag. 3) Enable UI path for tenant admins only. 4) Monitor metrics and error logs. 5) Gradually enable for operators.