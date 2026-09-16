---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# User guide — mermaid

```mermaid
flowchart LR
  HQ[HQ catalog + plan + overrides] --> Tenant[Tenant effective flags]
  Tenant --> UI[Sidebar and gated screens]
  UI -->|Refresh or plan change| Tenant
```
