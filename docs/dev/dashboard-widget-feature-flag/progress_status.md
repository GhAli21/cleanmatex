# Dashboard Widget Feature Flag Gating - Progress Status

**Feature:** Widget component hides when tenant lacks feature flag  
**Status:** ✅ Completed  
**Date Completed:** 2026-03-15

## Overview

The `Widget` component accepts a `featureFlag` prop. When set, the widget is hidden if the tenant does not have access to that flag.

## Implementation Checklist

- [x] `useFeatureOptional(feature?: FeatureFlagKey)` hook — returns true when feature undefined, otherwise checks via API
- [x] `Widget` uses `useFeatureOptional(featureFlag)` for gating
- [x] When `featureFlag` set and `!hasFeatureAccess`, return null (hide widget)
- [x] No API call when featureFlag is undefined

## Related Files

- `cleanmatex/web-admin/src/features/dashboard/ui/Widget.tsx`
- `cleanmatex/web-admin/src/features/auth/ui/RequireFeature.tsx`
