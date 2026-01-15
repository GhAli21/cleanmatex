---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

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
