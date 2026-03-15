# Dashboard Widget Feature Flag Gating - Developer Guide

## Usage

```tsx
<Widget
  title="B2B Contracts"
  featureFlag="b2b_contracts"
  onRefresh={refetch}
>
  <B2BContractsContent />
</Widget>
```

When `featureFlag` is set, the widget calls `useFeatureOptional(featureFlag)`. If the tenant lacks access, the widget returns `null` (hidden).

## Hook: useFeatureOptional

- **When feature is undefined:** Returns `true` immediately (no API call)
- **When feature is set:** Fetches `/api/feature-flags` and checks `flags[feature] === true`

## Tenant Context

The hook uses `useAuth()` for `currentTenant`. Ensure the tenant context is available when using Widget with featureFlag.
