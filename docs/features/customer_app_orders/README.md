# CleanMateX Go — Customer Mobile App & Staff Quick-Drop Conversion

**Feature Slug:** `customer_app_orders`  
**Version:** `2.0.0`  
**Status:** Implemented & Verified (Phases 1–6 Complete)  
**Primary Modules:**
- Mobile App: [`cmx_mobile_apps/apps/customer_app/`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/apps/customer_app/)
- Shared Mobile Packages: [`packages/mobile_ui`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/packages/mobile_ui/), [`packages/mobile_domain`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/packages/mobile_domain/), [`packages/mobile_services`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/packages/mobile_services/), [`packages/mobile_l10n`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/packages/mobile_l10n/)
- Public Customer API & Staff POS Intake: [`web-admin/app/api/v1/public/customer/`](file:///f:/jhapp/cleanmatex/web-admin/app/api/v1/public/customer/) & [`web-admin/app/api/v1/order-requests/`](file:///f:/jhapp/cleanmatex/web-admin/app/api/v1/order-requests/)
- Database Migration: [`supabase/migrations/0859_customer_app_branch_prefs_addresses.sql`](file:///f:/jhapp/cleanmatex/supabase/migrations/0859_customer_app_branch_prefs_addresses.sql)

## Overview

CleanMateX Go provides a bilingual (EN/AR + RTL), multi-tenant, Light/Dark-capable customer mobile experience backed directly by `web-admin`'s authoritative POS commercial, tax, and Order Fin engines:

1. **Multi-Tenant My Laundries Switcher:** Active Organization + `last_branch_id` top pill, inline branch switching, reversible Hide / Unhide hidden laundries (`is_hidden_by_customer`).
2. **Fast Quick Drop (3-Step Unpriced Request):** Shared 2×2 Pickup & Delivery selector, optional branch selection, estimated bag/piece steppers, **optional real catalog item & service category search/pick OR free-text lines**, idempotent submission to `org_ord_requests_mst` (`REQ-*`), and atomic Staff POS conversion under existing `orders:read` + `orders:create` permissions.
3. **Detailed Order (6-Step POS-Parity Flow):** Mandatory Branch + 2×2 Fulfillment → Catalog Items + optional per-piece preferences (showing extra price) + per-item notes → Saved Profile Preferences summary + single master toggle + preferences note → Schedule & Speed + Estimated Ready-By (branch TZ) + sorting variance disclaimer → Promo Code, Gift Card, Payment Notes & General Order Note (with `"Save for all upcoming orders"` toggle) → Live POS-parity Server-Priced Review (`POST /api/v1/public/customer/booking/quote`).
4. **Live Order Tracker & Digital Receipts:** Flexible `N`-stage `AppProgressStepperWidget` (Horizontal + Vertical toggle, responsive default), pickup QR code when ready, Orders Hub (`Active · Requests · History` with 1-tap bridge from `CONVERTED` requests to linked orders), and Always-Light bilingual VAT Digital Receipt paper sheet (`AppTheme.paperLight`).
5. **Full Account Profile:** Customer Code + all registered CleanMateX details, dual-scope (`sys` vs `org`) contact edit & Address CRUD, interactive default care preferences, saved general order note + `auto_apply_order_default_note` toggle, Language & Appearance controls.

## Pack Index

| Document | Purpose |
|---|---|
| [current_status.md](./current_status.md) | Live status, completed phases, and verified QA gate results |
| [progress_summary.md](./progress_summary.md) | Phase 1–6 execution log and delivered artifacts |
| [developer_guide.md](./developer_guide.md) | DB schema (`0859`), public/staff APIs, services, RBAC, i18n, and mobile architecture |
| [developer_guide_mermaid.md](./developer_guide_mermaid.md) | System architecture & sequence diagrams (Quick Drop → POS conversion & 6-step Detailed Order) |
| [testing_guide_and_scenarios.md](./testing_guide_and_scenarios.md) | Automated test commands and manual EN/AR + Light/Dark QA matrix |
| [CHANGELOG.md](./CHANGELOG.md) | Release changelog |
| [DESIGN_BLUEPRINT.md](../../../cmx_mobile_apps/docs/customer_app_docs/DESIGN_BLUEPRINT.md) | Full UX design blueprint and component specification |
| [IMPLEMENTATION_PLAN.md](../../../cmx_mobile_apps/docs/customer_app_docs/IMPLEMENTATION_PLAN.md) | Audited file-by-file implementation plan & live tracker |
| [interactive_mockup_v2.html](../../../cmx_mobile_apps/docs/customer_app_docs/interactive_mockup_v2.html) | Approved interactive v2 prototype |
