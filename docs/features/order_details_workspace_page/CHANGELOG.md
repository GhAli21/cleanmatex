# Changelog

All notable Order Workspace documentation and delivery milestones are recorded here.

## 0.1.0 - 2026-09-05

- Established the canonical documentation pack for the additive **Order workspace** feature.
- Recorded approved product boundaries: no navigation entry, feature flag, permission, migration, or new payment flow.
- Defined workspace-only UI ownership under `web-admin/src/features/orders/orderdtlworkspace/ui/`.
- Recorded order-level phone and delivery-context requirements, standard payment-flow handoff, and branch-to-tenant timezone fallback.
- Recorded the Activity-source boundary and deferred unsupported audit sources.
- Added delivery plan, current implementation status, and verification scenarios.

## Unreleased implementation work

- Implemented the hidden Workspace route, loading state, additive legacy-page entry, isolated UI package, EN/AR strings, and operational Overview sections.
- i18n parity, TypeScript, targeted ESLint, production build, and diff whitespace checks passed.
- Live responsive, RTL, accessibility, permission, and data-shape verification remain required. See [current_status.md](current_status.md).
