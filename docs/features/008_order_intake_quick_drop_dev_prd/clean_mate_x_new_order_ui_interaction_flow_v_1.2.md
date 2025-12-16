# CleanMateX — New Order UI Interaction Flow
**Version:** 1.2  
**Date:** 2025-10-31  
**Prepared by:** Jehad Almekhlafi  
**Project:** CleanMateX (Laundry SaaS System)

---

## 1. Overview
This document defines the detailed UI interaction flow for the **New Order Screen**, which is the central POS-style interface for creating laundry orders. It describes user interactions, data flow, screen transitions, validation logic, and real-time update mechanisms.

---

## 2. Screen Map
```
Dashboard → New Order → Add Item Modal → Payment Modal → Calendar Picker → Receipt Preview
```

### Navigation Entry Points
- **Dashboard Button:** Opens a blank new order screen.
- **Customer Profile:** Opens pre-filled customer data.
- **Quick Add (Floating Button):** Opens simplified order creation.

---

## 3. Main Layout Zones
```
┌──────────────────────────────────────────────────────────────────┐
│ Top Bar: Branch, Customer Selector, Express Toggle               │
├──────────────────────────────────────────────────────────────────┤
│ Service Category Tabs: Dry Cleaning | Laundry | Ironing | Repairs │
├──────────────────────────────────────────────────────────────────┤
│ Item Grid: Product Cards (icon, name, price, +counter)            │
├──────────────────────────────────────────────────────────────────┤
│ Stain & Notes Palette: Color chips + text notes                  │
├──────────────────────────────────────────────────────────────────┤
│ Right Panel: Order Summary, Totals, Ready Date, Payment          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Interaction Logic

### 4.1 Category Selection
- User clicks a category tab.
- System fetches items from `/service-categories/:id/products`.
- Grid refreshes to show all items with icons and prices.
- If cached, loads from local store for faster UX.

### 4.2 Item Selection
- Click on item tile → increment quantity.
- Long press → open **Item Detail Modal**.
  - Quantity, Price, Notes, Tax Exempt toggle, Add Photo.
  - Confirm adds item to Order Summary.
- Each tile displays a counter (1, 2, 3...).

### 4.3 Stain & Notes Palette
- Appears below grid.
- Each note is clickable (toggle active/inactive).
- Selected notes link to active item.
- Stored under `org_order_item_notes_dtl`.

### 4.4 Order Summary Panel
- Displays all items with name, notes, unit price, quantity.
- Totals auto-recalculate with tax and discounts.
- Express toggle multiplies prices (from `org_product_data_mst.multiplier_express`).

### 4.5 Ready Date Picker
- Opens on clicking date field.
- Default = `current_date + product.extra_days`.
- User can modify.
- Calendar modal supports quick-select: Today / Tomorrow / Custom.

### 4.6 Payment Modal
- Opens upon Submit button press.
- Displays order total prominently.
- Payment modes:
  - Cash
  - Card
  - Check
  - Invoice (B2B)
- Optional toggles:
  - Pay on Collection
  - Add Promo / Gift Card.
- Confirm triggers invoice creation and closes modal.

### 4.7 Receipt & Confirmation
- On payment success:
  - Displays receipt preview.
  - Offers options: Print / Share WhatsApp / Send SMS.
  - Confirms order closure and triggers WhatsApp notification.

---

## 5. Data Bindings
| UI Element | API Endpoint | Database Table |
|-------------|---------------|----------------|
| Service Category Tabs | `/service-categories` | `org_service_category_cf` |
| Item Grid | `/service-categories/:id/products` | `org_product_data_mst` |
| Notes Palette | `/notes` | `org_item_notes_cd` |
| Order Summary | `/orders/:id` | `org_orders_mst` |
| Add Item Modal | `/orders/:id/items` | `org_order_items_dtl` |
| Payment Modal | `/orders/:id/invoice` | `org_invoice_mst` + `org_payments_dtl_tr` |
| Ready Date | `/orders/:id` (PATCH) | `org_orders_mst.ready_by` |

---

## 6. Real-time Updates
- Subscribed to Supabase Realtime channel: `tenant_orders_mst`.
- UI listens for `INSERT`, `UPDATE` events.
- If order changes externally (e.g., from driver app), refresh view instantly.
- Delay threshold: <1 second.

---

## 7. Validation Rules
| Field | Rule | Error Key |
|--------|------|-----------|
| Customer | Required | `validation.customerRequired` |
| Item List | ≥1 item | `validation.atLeastOneItem` |
| Payment Method | Required | `validation.paymentRequired` |
| Ready Date | Required | `validation.dateRequired` |

Error messages reference localization keys in `new_order_en.json` and `new_order_ar.json`.

---

## 8. Accessibility & Color Theme
- Primary palette derived from `new_order_colors_04.JPG`.
- High-contrast mode for daylight visibility.
- Buttons ≥48px touch height.
- All icons labeled for screen readers.
- Full RTL mirroring in Arabic mode.

---

## 9. Diagrams & Flows
### 9.1 Order Lifecycle
```
Draft → Intake → In Process → Ready → Delivered → Closed
```
### 9.2 Add Item Flow
```
User taps item → Item added → Summary updates → Total recalculated → UI refresh
```
### 9.3 Payment Flow
```
Submit → Payment Modal → Select Method → Confirm → Invoice Created → Notification Sent
```
### 9.4 Realtime Sync Flow
```
Backend Change → Supabase Realtime → Event Broadcast → Client Update UI
```

---

## 10. Localization
All text elements map to translation keys from JSON files:
```
new_order_en.json
new_order_ar.json
```
Examples:
- `newOrder.payment.cash`
- `newOrder.itemsGrid.addItem`
- `newOrder.schedule.apply`

---

## 11. Error Handling & Edge Cases
- **Duplicate Order:** Prevent by checking customer + timestamp.
- **Offline Mode:** Queue API requests and retry on reconnect.
- **Price Overrides:** Log user ID for audit.
- **Payment Failure:** Rollback order creation, notify cashier.

---

## 12. Future UI Enhancements
- Drag-and-drop for item sorting.
- Voice input for stains/notes.
- Animated transitions for order submission.
- Adaptive layout for tablets (3-column mode).

---

## 13. References
- CleanMateX_Order_Feature_PRD_v1.2__2025-10-31.md
- schema_06.sql (Database)
- new_order_en.json / new_order_ar.json (Localization)
- CleanMateX_Technical_Stack_Spec_v0.12.1.docx

