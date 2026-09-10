# Rack & Bags Modal — Changelog

## 2026-09-11 — v1 implemented and migration applied

- Migration `0497_org_orders_locker_hanging.sql` applied to local + remote by the owner and verified: `org_orders_mst.locker_location`, `locker_code`, `hanging_count` (nullable, `chk_hanging_count CHECK (hanging_count IS NULL OR hanging_count >= 0)`, no upper bound).
- `web-admin/prisma/schema.prisma`'s `org_orders_mst` model updated with the 3 new fields (client regeneration alone doesn't introspect the DB) and `npx prisma generate` re-run.
- New `ACTIVE_ORDER_STATUS_CODES` constant (`lib/constants/order-types.ts`), derived from `lib/types/workflow.ts` `ORDER_STATUSES`.
- New service `lib/services/workflow/rack-bags.service.ts` — order field reads + cross-order "customer has other racked orders" lookup (tenant + customer scoped, active statuses only).
- New route `GET /api/v1/orders/[id]/rack-bags`.
- Extended `POST /api/v1/orders/[id]/batch-update` to accept `lockerLocation`, `lockerCode`, `bagCount`, `hangingCount` with fail-fast range validation.
- New reusable Cmx primitive `CmxCountPicker` (`src/ui/forms/cmx-count-picker.tsx`) — 0..max chip picker + bounded Custom input.
- New shared helper `isOnlyRackBlocked` (`src/features/workflow/lib/rack-gate-helpers.ts`), replacing two separate copies of the same check.
- New `RackBagsModal` (`src/features/workflow/ui/rack-bags-modal.tsx`) — the standardized dialog from the owner's mockup.
- `WorkflowActionBar` rewired: its old single-field inline rack prompt is replaced by `RackBagsModal` with a one-click retry (rack-blocked action → modal → submit → action retried automatically). This reaches every screen that mounts `WorkflowActionBar` (ready, qa, packing, processing, assembly, preparation, order-actions, home-collection, delivery) — not just Ready Details.
- Ready Details' bespoke "Make available for pickup" button (`ReadyFulfilmentPanel`) reuses the same modal + shared helper, plus a new always-visible "Rack & Bags" proactive trigger button.
- Ready Details page (`app/dashboard/ready/[id]/page.tsx`) — removed the old editable rack card + its "Save rack" round-trip; kept a small read-only rack summary.
- i18n: `workflow.ready.rackBags.*` + 3 new `workflow.ready.messages.*` keys, EN + AR.

**Gates:** full `eslint`, `tsc --noEmit`, and `next build` all green; `check:i18n` passed; new unit tests (10) plus a 623-test regression sweep across workflow/orders/ui all passing.

**Not yet done:** manual click-through QA (`testing_guide_and_scenarios.md`). Processing modal's own separate piece-level rack section left untouched (explicitly out of scope).
