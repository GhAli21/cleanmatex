---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Change Log

## [v0.1.0] - 2026-01-15

### Added

- Workflow system mode utility (`workflow-config.ts`)
- Screen-based orders hook (`useScreenOrders`)
- Preparation screen migration (list + detail) to new workflow hooks

### Changed

- OrderActions now uses `useOrderTransition`
- Transition API now normalizes the "new request body shape" even when old workflow is forced


