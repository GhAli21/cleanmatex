# CleanMateX — New Order UI Interaction Flow
**Version:** 1.2  
**Date:** 2025-10-31  
**Prepared by:** Jehad Almekhlafi

---

## 1. Screen Map
```
Main → New Order → Add Item Modal → Payment Modal → Calendar → Receipt Preview
```

---

## 2. Key Interactions
- Select service category → load items grid from API.
- Tap item → add to summary and recalc totals.
- Long-press → open item modal for details.
- Tap stain/note → link to active item.
- Tap ready date → open calendar.
- Tap Submit → open payment modal.
- Confirm payment → finalize order, generate invoice, and trigger notification.

---

## 3. Data Bindings
**UI ↔ API ↔ DB mapping:**
```
Category grid ↔ /service-categories/:id/products ↔ org_product_data_mst
Item selection ↔ /orders/:id/items ↔ org_order_items_dtl
Totals ↔ calculate_order_total() function ↔ org_orders_mst
Payment ↔ /orders/:id/invoice ↔ org_invoice_mst + org_payments_dtl_tr
```

---

## 4. Realtime Updates
Supabase Realtime channels listen to `tenant_orders_mst` changes and update UI in <1s.

---

## 5. Validation Rules
- Customer required.
- At least one item required.
- Payment method required.
- Date required.

---

## 6. Accessibility & Color Theme
Colors from `new_order_colors_04.JPG`.  
Large touch zones, bilingual text support (RTL for Arabic).

---

## 7. Diagrams
Includes embedded diagrams in final design:
- Order Lifecycle
- Add Item Flow
- Payment Flow
- Submission Flow

---

## 8. Localization
All strings reference keys from `new_order_en.json` and `new_order_ar.json` for EN/AR translation.

