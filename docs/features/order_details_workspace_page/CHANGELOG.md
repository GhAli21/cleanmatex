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
- Upgraded the Workspace presentation into a responsive operational command center: stronger header hierarchy, horizontal workflow rail, compact financial snapshot, fulfillment/customer context, and activity preview.
- Added an Actions tab that delegates `order_control` workflow actions to the existing Workflow Engine action bar, retaining its server authorization, optimistic-concurrency, gate, reason, and confirmation behavior.
- Replaced the hardcoded lifecycle and false progress signal with the order-pinned profile policy's configured `stage_sequence` and localized workflow-status catalog labels.
- i18n parity, TypeScript, targeted ESLint, production build, and diff whitespace checks passed.
- Live responsive, RTL, accessibility, permission, and data-shape verification remain required. See [current_status.md](current_status.md).
