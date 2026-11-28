# Changelog — Customer App Orders (`customer_app_orders`)

## [2.0.0] - 2026-11-28

### Added
- Database migration `0859_customer_app_branch_prefs_addresses.sql` (`last_branch_id`, `default_order_note`, `auto_apply_order_default_note`, `sys_customer_addresses_dtl`, Quick Drop 2×2 delivery/bag columns).
- Public Customer APIs in `web-admin` for `tenants` (active + recoverable hidden + `lastBranchId`), `profile` (dual-scope), `addresses` (dual-scope), `requests` (Fast Quick Drop), `booking/quote` (POS-parity live quote), and `receipts`.
- Staff POS Quick-Drop queue panel (`/dashboard/orders`) and atomic conversion intake banner (`/dashboard/orders/new?requestId=...`) gated under `orders:read` / `orders:create`.
- Shared Flutter UI design system v1.1 (`packages/mobile_ui`), flexible `N`-stage Horizontal/Vertical `AppProgressStepperWidget`, Always-Light `AppTheme.paperLight`, WCAG AA `CmxOrgThemeOverride`.
- CleanMateX Go 4-Tab Shell (`Home · Orders · Receipts · Account`), 3-step Fast Quick Drop (with optional catalog search/pick), 6-step POS-parity Detailed Order, Live Tracker, Digital Receipts, and Full Account Profile.
