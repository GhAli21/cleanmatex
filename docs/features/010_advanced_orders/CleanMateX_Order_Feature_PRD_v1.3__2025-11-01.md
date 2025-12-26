Version: 1.3 \| Date: 2025-11-01\
Prepared by: Jehad Almekhlafi

# 1. Overview

The Order Management module enables laundries to create, manage, and
track orders across POS, pickup/delivery, and marketplace channels. It
now supports configurable workflow templates per tenant and service
category, with audit history, QA, and assembly stages.

# 2. User Roles

Receptionist, Preparation Operator, Processing Operator, QA Staff,
Delivery Driver, Branch Admin, Platform Admin.

# 3. Functional Requirements

Key Capabilities:

\- Order creation with auto-generated number and ready-by calculation.

\- Item-level details, stains, notes, and pricing.

\- Workflow-based transitions between stages (Intake, Preparing,
Processing, Assembly, QA, Ready, Delivered).

\- Split orders, issue management, and per-item 5-step processing.

\- Dynamic pricing, discounts, and taxes.

\- Payment and invoice linkage.

\- Multi-channel notifications (WhatsApp, SMS, push).

\- Realtime Supabase updates.

# 4. Database Mapping

Primary tables: org_orders_mst, org_order_items_dtl, org_invoice_mst,
org_payments_dtl_tr, org_customers_mst, org_emp_users,
org_delivery_routes, org_order_history, org_order_item_issues,
org_order_item_processing_steps.

# 5. Workflow Configuration

Workflows are defined globally using tables: workflow_template_cd,
workflow_template_stages, workflow_template_transitions. Tenants can
override behavior via tenant_workflow_settings_cf and
tenant_service_category_workflow_cf.

# 6. API Endpoints

\- /v1/orders

\- /v1/orders/:id/state

\- /v1/orders/:id/transition

\- /v1/orders/:id/items/:itemId/step

\- /v1/orders/:id/split

\- /v1/orders/:id/issue

\- /v1/orders/:id/history

# 7. Workflow & Status

The lifecycle is now configurable via workflow templates. Example
Standard Workflow: Intake → Preparing → Processing → Assembly → QA →
Ready → Delivered. Tenants may enable or disable intermediate screens.

# 8. UI & Screens

New Order Screen, Preparation Screen, Processing/Cleaning Screen,
Assembly Screen, QA Screen, Ready/Delivery Screen, Order Details, Order
List.

# 9. Non-Functional Requirements

Performance: p50 \<300ms, p95 \<800ms. Availability: 99.9%. Full EN/AR
localization and offline queue for Flutter app.

# 10. Integration Points

Integrates with Customer, Payments, Notifications, Invoices, and Reports
modules.

# 11. KPIs

Order creation ≤5s. Search \<1s. Realtime updates \<1s latency. Stage
transition logs within 1s.

# 12. Localization

Localization handled via new_order_en.json and new_order_ar.json for
English and Arabic text.
