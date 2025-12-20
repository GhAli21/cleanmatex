---
version: v1.0.0
last_updated: 2025-01-27
author: CleanMateX Development Team
---

# Vercel Build Fixes

## Build Errors on Vercel

Vercel build is failing with the following errors:

1. **Duplicate Register Page**: `app/(auth)/register/page.tsx` and `app/(public)/register/page.tsx` both resolve to `/register`
2. **Missing Components**:
   - `@/components/ui/Switch` - not found
   - `@/lib/hooks/useLocale` - not found
   - `@/components/ui/badge` - not found

## Root Cause

- Vercel is using **Next.js 15.5.4** (project has Next.js 16.1.0)
- Vercel is running `next build` without `--webpack` flag
- Components exist but may have path resolution issues in Next.js 15

## Solutions

### 1. Fix Duplicate Register Page

**Issue**: Vercel detects duplicate register pages. The `(public)` folder is empty locally, but Vercel may be seeing a cached or different version.

**Solution**: Ensure only one register page exists. The register page should be in `app/(auth)/register/page.tsx` only.

### 2. Fix Missing Components

All components exist:

- ✅ `components/ui/Switch.tsx` - exists and exported
- ✅ `lib/hooks/useLocale.ts` - exists and re-exports from useRTL
- ✅ `components/ui/badge.tsx` - exists and exported

**Solution**: The issue is likely path resolution. Ensure `tsconfig.json` paths are correct:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@ui/*": ["./src/ui/*"],
      "@features/*": ["./src/features/*"]
    }
  }
}
```

### 3. Fix Vercel Build Configuration

**Current vercel.json**:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

**Note**: The build command in `package.json` is `"build": "next build --webpack"`, which should work, but Vercel may be ignoring the flag.

### 4. Ensure Components Are Properly Exported

All components are exported in `components/ui/index.ts`:

- ✅ `Switch` exported
- ✅ `Badge` exported
- ✅ `useLocale` exported from `lib/hooks/useLocale.ts`

## Immediate Actions

1. **Check for duplicate register page** - Ensure `app/(public)/register/page.tsx` doesn't exist
2. **Verify Vercel root directory** - Ensure Vercel is building from `web-admin/` directory
3. **Update Next.js version** - Consider pinning Next.js version in package.json
4. **Clear Vercel build cache** - May have stale files

## Files to Check

- ✅ `web-admin/app/(auth)/register/page.tsx` - exists
- ❓ `web-admin/app/(public)/register/page.tsx` - should NOT exist
- ✅ `web-admin/components/ui/Switch.tsx` - exists
- ✅ `web-admin/lib/hooks/useLocale.ts` - exists
- ✅ `web-admin/components/ui/badge.tsx` - exists
- ✅ `web-admin/tsconfig.json` - paths configured correctly
- ✅ `web-admin/package.json` - build script has `--webpack` flag

## Next Steps

1. Verify no duplicate register page exists
2. Ensure Vercel is using the correct root directory
3. Consider adding explicit exports in component files
4. Test build locally with Next.js 15.5.4 to match Vercel

---

**Status**: Investigating Vercel-specific build issues  
**Priority**: High - Blocking deployment
