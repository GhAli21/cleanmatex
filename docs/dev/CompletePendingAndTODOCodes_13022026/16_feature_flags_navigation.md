# 16 - Feature Flags and TopBar Navigation

## Summary

RequireFeature and useFeature now fetch from `/api/feature-flags` instead of mock data. TopBar profile and settings buttons navigate correctly.

## Files Affected

- `web-admin/components/auth/RequireFeature.tsx`
- `web-admin/components/layout/TopBar.tsx`

## Code Before

**RequireFeature:** Used hardcoded `mockFeatureFlags` object.
**TopBar:** Profile and Settings buttons had `// TODO: Navigate to profile` and `// TODO: Navigate to settings` with no action.

## Code After

**RequireFeature:**
```typescript
const res = await fetch('/api/feature-flags')
if (!res.ok) { setHasAccess(false); return }
const flags = (await res.json()) as Record<string, boolean>
// Check flags[feature] or flags.every/some for array
```

**useFeature hook:** Same fetch pattern.

**TopBar:**
```typescript
import { useRouter } from 'next/navigation'
const router = useRouter()
// Profile -> router.push('/dashboard/settings/general')
// Settings -> router.push('/dashboard/settings')
```

**UpgradePrompt:** Navigate to `/dashboard/settings/subscription` for upgrade.

## Effects

- Feature-flagged UI now respects tenant plan and custom flags from DB
- User menu items work for profile and settings
