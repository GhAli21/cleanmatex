---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# User Guide — Feature Flags (operators)

Feature flags control whether optional product areas appear (ERP-Lite, B2B, refunds UI, etc.).

- Flags are **per tenant**, not per user.
- Changing a plan (upgrade/cancel) refreshes flag visibility.
- HQ console overrides (when used) take effect after refresh or up to 5 minutes on an already-open session; use the permissions inspector **Refresh** for an immediate reload.
- Hidden screens are a UX gate only. Staff without a flag should not see the entry; APIs still enforce access.
