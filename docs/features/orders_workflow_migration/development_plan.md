---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Development plan

## Goal

Migrate all order workflow screens to the new workflow system with:

- Screen contracts (`/api/v1/workflows/screens/[screen]/contract`)
- Screen-based transitions (`/api/v1/orders/[id]/transition`)
- Workflow context (`/api/v1/orders/[id]/workflow-context`)
- Gradual rollout per env: `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM` (default false)

## Scope (screens)

- Preparation
- Processing
- Assembly
- QA
- Packing (missing today; must be built)
- Ready
- Delivery
- Shared: `OrderActions` (used in order details)

## Implementation sequence

1. Shared infrastructure (hooks + config)
2. Preparation screen (list + detail)
3. Processing screen (list + modal/detail)
4. Assembly + QA
5. Packing (new)
6. Ready + Delivery
7. E2E + build verification

## Rollout strategy

- Default old workflow: `NEXT_PUBLIC_USE_NEW_WORKFLOW_SYSTEM=false`
- Enable new workflow per env once each screen passes verification


