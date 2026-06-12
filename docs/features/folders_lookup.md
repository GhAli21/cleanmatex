# Feature Docs — Folder Index

Quick navigation to feature-level documentation.

## Features

- [Admin Dashboard](007_admin_dashboard/007_admin_dashboard_dev_prd.md) — Basic admin UI layout and navigation
- [Order Financial Platform](Order_Fin/README.md) — Multi-leg payments, stored value, loyalty, promotions, tax engine, reconciliation, outbox pattern
- [Business Voucher Module](Business_Voucher_Module/README.md) — Universal finance transaction layer: receipt/payment/refund/adjustment vouchers with line-level roles, cashier restrictions, idempotent posting, reversal engine
- [Notification & Communication Hub](Notification_And_Communication_Hub/ROADMAP.md) — Multi-tenant, multi-channel notification system (IN_APP/EMAIL/SMS/WhatsApp/Push); Supabase Realtime bell; pg_cron outbox; migs 0344–0356 (CMX-PRD-019)

## How to Add a New Feature Entry

When a new feature folder is created under `docs/features/`, add a line here:
```
- [Feature Name](folder_name/README.md) — one-line description
```
