---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

> **SUPERSEDED (noted 2026-09-10, folder left as historical record — not rewritten).** This folder (dated January 2026) describes the Gen-1 screen-contract/`org_ord_screen_contracts_cf` predecessor to the current Workflow Engine V2. The engine-first V1.0 cutover this folder predates began July 2026 (`ADR_SCOPE_AND_CORRECTION_PASS.md`) and fully replaced this system; live normalized profile-version rows (ADR-SAAS-MNG-0010) replaced it again in August 2026. **For the current workflow engine, use `docs/features/Workflow_Order_Advance/` instead** — that folder is not cross-linked from here in either direction, which made this folder easy to mistake for current docs since it also says "new workflow system."

# Orders Workflow Migration

This feature folder tracks the migration of all order workflow screens to the **new workflow system**:

- Screen contracts (pre-conditions: statuses, permissions, additional filters)
- Workflow context (flags + metrics)
- Screen-based transitions via `/api/v1/orders/:id/transition`
- Gradual rollout using `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM` and the request flag `useOldWfCodeOrNew`

## Quick links

- `development_plan.md`
- `progress_summary.md`
- `current_status.md`
- `developer_guide.md`
- `testing_scenarios.md`
- [Cancel and Return Order](../orders/cancel_return/README.md) — Cancel order (before delivery) and Customer Return (after delivery) flows
