Version: 1.3 \| Date: 2025-11-01\
Prepared by: Jehad Almekhlafi

# 1. Screen Map

Main → New Order → Add Item Modal → Payment Modal → Calendar → Receipt
Preview.

# 2. Key Interactions

\- Select service category → load items grid from API.

\- Tap item → add to summary and recalc totals.

\- Long-press item → open details modal (size, fabric, stain, notes).

\- Tap stain/note → link to active item.

\- Tap ready date → open calendar and preview ready_by_at.

\- Tap Submit → validate fields and call /v1/orders.

\- Order remains in Preparing or Processing based on workflow settings
and order type (Quick Drop or Normal).

\- No auto-navigation; next role user continues the workflow.

# 3. Data Bindings

UI ↔ API ↔ DB mapping:

\- Category grid ↔ /service-categories/:id/products ↔ org_products_mst.

\- Item selection ↔ /orders/:id/items ↔ org_order_items_dtl.

\- Totals ↔ calculate_order_total() ↔ org_orders_mst.

\- Payment ↔ /orders/:id/invoice ↔ org_invoice_mst +
org_payments_dtl_tr.

\- Workflow ↔ /v1/orders/:id/state ↔ workflow_template_stages.

# 4. Realtime Updates

Supabase Realtime channels listen to tenant_orders_mst changes and
update UI within 1s.

# 5. Validation Rules

\- Customer required.

\- At least one item or Quick Drop quantity required.

\- Payment method required.

\- Ready date required.

\- Ready_by_at must be displayed before submission.

# 6. Accessibility & Color Theme

Large touch zones, bilingual (EN/AR) text, colors from
new_order_colors_04.JPG.

# 7. Localization

All strings reference keys from new_order_en.json and new_order_ar.json.
