# CleanMateX — Order Feature PRD
**Version:** 1.2  
**Date:** 2025-10-31  
**Prepared by:** Jehad Almekhlafi

---

## 1. Overview
The Order Management module enables laundries to create, manage, and track orders from multiple channels — POS, pickup/delivery, and marketplace. It supports itemized pricing, status transitions, and integration with invoices, payments, and notifications.

---

## 2. User Roles
Receptionist, Operator, Driver, Customer, Branch Admin, Platform Admin.

---

## 3. Functional Requirements
**Key Capabilities:**
- Order creation with auto-generated number.
- Item-level details, notes, stains, preferences.
- Dynamic pricing, discount, and tax calculation.
- Payment and invoice linkage.
- Multi-channel notifications (WhatsApp, SMS, push).
- Realtime status updates.

---

## 4. Database Mapping
Primary tables:
```
org_orders_mst
org_order_items_dtl
org_invoice_mst
org_payments_dtl_tr
org_customers_mst
org_emp_users
org_delivery_routes
```

---

## 5. API Endpoints
```
/orders
/orders/:id/items
/orders/:id/invoice
/orders/:id/notify
/orders/:id/print
```

---

## 6. Workflow & Status
Status lifecycle: `Draft → Intake → In Process → Ready → Delivered → Closed`

---

## 7. UI & Screens
### New Order Screen (Enhanced Layout)
Service category tabs display all available items. Each item card shows icon, name, and price. Selecting an item increments its quantity and updates totals. Stain/notes palette appears below. Order summary panel on the right displays totals, ready date, and payment modal.

### Other Screens
Order Details, Order List, Mobile Driver Delivery screen.

---

## 8. Non-Functional Requirements
Performance: p50 <300ms, p95 <800ms.  
Availability: 99.9%.  
Full EN/AR localization.  
Offline queue for Flutter app.

---

## 9. Integration Points
Customer Module, Payments, Notifications, Invoices, Reports.

---

## 10. KPIs
Order creation ≤5s.  
Search <1s.  
Realtime updates <1s latency.

---

## 11. Localization
Localization handled via `new_order_en.json` and `new_order_ar.json`, providing English and Arabic labels for all UI components.

