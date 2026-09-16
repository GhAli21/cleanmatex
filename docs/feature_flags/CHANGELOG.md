---
version: v1.0.0
last_updated: 2026-09-16
author: CleanMateX Team
---

# Changelog

## 1.0.0 — 2026-09-16

- Shared TanStack Query for tenant feature flags (`featureFlagKeys.tenant`).
- Single client fetch: `fetchTenantFeatureFlags`.
- Removed per-mount fetches from RequireFeature, useFeature, sidebar, inspector.
- Sidebar localStorage no longer used for flag resolution.
