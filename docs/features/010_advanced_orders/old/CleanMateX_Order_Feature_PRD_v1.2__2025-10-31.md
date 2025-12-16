# CleanMateX — Order Feature PRD
**Version:** 1.2  
**Date:** 2025-10-31  
**Prepared by:** Jehad Almekhlafi  
**Project:** CleanMateX (Laundry SaaS System)

---

## 1. Overview
The **Order Management Module** is the operational backbone of CleanMateX, enabling laundries to manage every order life cycle — from creation to delivery and invoicing. It integrates pricing, payments, receipts, notifications, and customer tracking within one unified workflow.

### 1.1 Objectives
- Simplify order creation and editing for POS and delivery staff.
- Handle multiple customer types: Guest, Stub, Full Profile, and B2B.
- Support branch-level and multi-tenant operations.
- Provide accurate totals, invoices, and payment tracking.
- Enable notifications (WhatsApp, SMS, App Push) in real-time.
- Maintain data integrity, scalability, and localization.

### 1.2 Supported Order Channels
- Walk-in POS Orders
- Pickup Orders
- Delivery Orders
- Internal/Split Orders
- Marketplace/App Orders

---

## 2. User Roles & Permissions
| Role | Permissions | Description |
|------|-------------|--------------|
| **Receptionist** | Create, edit, cancel, print receipts | Handles front-desk orders. |
| **Operator** | Update status, add notes | Operates during washing/ironing. |
| **Driver** | Pickup/Delivery, POD capture | Mobile driver app user. |
| **Customer** | Track orders, receive receipts | Via App or WhatsApp link. |
| **Branch Admin** | Approve discounts, view analytics | Supervises daily operations. |
| **Platform Admin** | Multi-tenant oversight | Full SaaS-level management. |

---

## 3. Functional Requirements

### 3.1 Order Creation
- Auto-generate order numbers in format: `CMX-{tenant}-{YYMM}-{####}`.
- Customer selection: existing profile, stub, or guest.
- Assign order type: Walk-in / Pickup / Delivery.
- Set branch and staff info.
- Auto-set timestamps (created_at, received_at).

### 3.2 Item Management
- Display service categories (Dry Cleaning, Laundry, Ironing, Repairs, Alterations).
- On click, load products dynamically from `org_product_data_mst`.
- Each item tile shows: icon/image, name, base price.
- Increment/decrement quantity directly.
- Long-press → open **Item Details Modal** with:
  - Quantity, Unit Price, Notes, Tax Exemption toggle.
  - Upload Photo (damage/stain proof).
  - Save updates totals.

### 3.3 Stains and Notes
- Quick color-coded palette with predefined stains (e.g., Coffee, Ink, Tear).
- Multiple notes can be attached to one item.
- Stored in `org_order_item_notes_dtl`.

### 3.4 Pricing & Discounts
- Fetch prices from `org_price_lists_dtl`.
- Express surcharge = base price × `multiplier_express`.
- Tax auto-calculated (default 5%).
- Manual discounts allowed (% or flat).
- Use PostgreSQL `calculate_order_total()` to ensure accurate totals.

### 3.5 Payment & Invoicing
- Payment modes: Cash, Card, Check, Invoice, Online.
- Create `org_invoice_mst` record automatically.
- Log payment transaction in `org_payments_dtl_tr`.
- Partial payments supported.
- PDF/WhatsApp receipts generated via signed URL.

### 3.6 Order Lifecycle Workflow
```
Draft → Intake → In Process → Ready → Delivered → Closed → Archived
```
| Status | Description | Trigger |
|---------|-------------|----------|
| Draft | Created but not submitted | Save draft |
| Intake | Items received, tagged | Confirm order |
| In Process | Washing/Ironing stage | Operator update |
| Ready | Items finished | Operator marks ready |
| Delivered | Handover completed | Driver or cashier confirm |
| Closed | Payment settled | Invoice closed |
| Cancelled | Order voided | Admin action |

### 3.7 Notifications
- Automatic triggers: Intake, Ready, Out-for-delivery, Delivered.
- Channels: WhatsApp Business API, SMS, Push.
- Templates with placeholders: `{order_no}`, `{status}`, `{branch}`, `{ready_date}`.

### 3.8 Receipts & Printing
- ESC/POS-compatible printing (58mm, 80mm).
- Bilingual print support (EN/AR).
- QR code for online tracking.
- Option: Print, WhatsApp, or PDF download.

### 3.9 Reporting
- Order history with filters (branch, date, customer, status).
- Revenue and tax summaries.
- Staff productivity reports.

---

## 4. Non-Functional Requirements
| Category | Target / Description |
|-----------|----------------------|
| **Performance** | API latency p50 <300ms, p95 <800ms, search <1s |
| **Scalability** | PostgreSQL 16 + RLS, partitioned per tenant |
| **Availability** | ≥99.9% uptime SLA |
| **Localization** | Full EN/AR with RTL support |
| **Offline Mode** | Flutter offline queue for order sync |
| **Security** | JWT + Argon2, TLS1.2+, RLS isolation |
| **Auditability** | All records include `created_by`, `updated_by`, timestamps |

---

## 5. Database Schema Mapping
| Table | Description |
|--------|--------------|
| `org_orders_mst` | Order master header |
| `org_order_items_dtl` | Order item details |
| `org_invoice_mst` | Invoice records |
| `org_payments_dtl_tr` | Payment transactions |
| `org_customers_mst` | Customer master data |
| `org_emp_users` | Staff (operator, driver, cashier) |
| `org_delivery_routes` | Delivery routes by driver |

**Functions:**
- `generate_order_number(p_tenant_id UUID)` → returns formatted order number.
- `calculate_order_total(p_order_id UUID)` → recalculates subtotal, tax, and total.

---

## 6. API Specification
| Method | Endpoint | Description |
|--------|-----------|--------------|
| **GET** | `/orders` | List all orders (filterable) |
| **POST** | `/orders` | Create new order |
| **GET** | `/orders/:id` | Retrieve order details |
| **PATCH** | `/orders/:id` | Update order details or status |
| **POST** | `/orders/:id/items` | Add or update items |
| **POST** | `/orders/:id/invoice` | Generate invoice |
| **POST** | `/orders/:id/notify` | Send notification |
| **GET** | `/orders/:id/print` | Generate printable receipt |

All requests authenticated with JWT. Tenant context validated using RLS.

---

## 7. UI & Screens
### 7.1 New Order Screen Layout
```
Top: Service Category Tabs
Center: Items Grid (icon, name, price)
Bottom: Notes & Stains Palette
Right: Order Summary, Ready Date, Payment
```
- Category click → API `/service-categories/:id/products`.
- Items update dynamically.
- Totals auto-update.
- Payment modal confirms order and triggers invoice.

### 7.2 Order Details Screen
- Tabs: Summary | Items | Payment | Notes | Timeline.
- Real-time updates with Supabase.

### 7.3 Order List Screen
- Filters: Date, Branch, Customer, Status.
- Columns: Order No, Customer, Total, Status, Date.

### 7.4 Mobile Driver App
- Displays assigned deliveries.
- Proof of Delivery: signature or photo.
- Offline submission supported.

---

## 8. Integration Points
| Module | Integration |
|---------|--------------|
| **Customers** | Attach or create stub profile. |
| **Payments** | HyperPay, PayTabs, Stripe. |
| **Notifications** | WhatsApp Business API. |
| **Invoices** | PDF generation (NestJS backend). |
| **Reports** | Aggregation by branch, day, or employee. |

---

## 9. Key Workflows
### 9.1 Order Creation Workflow
```
Select Customer → Choose Category → Add Items → Apply Discount → Select Payment → Submit
```
### 9.2 Payment Workflow
```
Submit → Open Payment Modal → Choose Method → Confirm → Invoice + Payment Record → Notification Sent
```
### 9.3 Order Status Update Workflow
```
Intake → In Process → Ready → Delivered → Closed
```
### 9.4 Notification Flow
```
Trigger Event → Webhook → WhatsApp API → Customer Confirmation
```

---

## 10. KPIs & Performance Metrics
| Metric | Target |
|---------|--------|
| Avg. Order Creation Time | ≤5 seconds |
| Search Query Response | ≤1 second |
| API Latency | p95 <800ms |
| Notification Delay | <1 second |
| Receipt Error Rate | <0.5% |
| Data Consistency | 100% verified |

---

## 11. Localization
Uses two JSON files:
- `new_order_en.json`
- `new_order_ar.json`

All UI and notifications use these keys, e.g.:
```
newOrder.itemsGrid.addItem
newOrder.payment.cash
newOrder.schedule.apply
```

---

## 12. Future Enhancements
- AI-powered pickup route optimization.
- Loyalty points redemption in order payment.
- Predictive ready-time estimation using machine learning.
- Advanced analytics (revenue per hour, service category trends).
- B2B bulk order management.

---

## 13. References
- CleanMateX_Technical_Stack_Spec_v0.12.1.docx
- schema_06.sql (Database)
- CleanMateX_Customer_Details.docx
- CleanMateX_NewOrder_UI_Interaction_Flow_v1.2__2025-10-31.md

