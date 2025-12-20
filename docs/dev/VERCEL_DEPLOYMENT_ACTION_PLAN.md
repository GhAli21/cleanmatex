---
version: v1.0.0
last_updated: 2025-01-27
author: CleanMateX Development Team
---

# Vercel Deployment Action Plan

## Immediate Steps to Fix Vercel Build

### Step 1: Verify Vercel Project Settings

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **General**
4. Check **Root Directory**:

   - ✅ Should be: `web-admin`
   - ❌ If it's empty or set to root, change it to `web-admin`

5. Go to **Settings** → **Build & Development Settings**
6. Verify:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` (or leave empty to use package.json)
   - **Output Directory**: `.next` (or leave empty for default)
   - **Install Command**: `npm install` (or leave empty for default)

### Step 2: Clear Vercel Build Cache

1. In Vercel dashboard, go to your project
2. Go to **Deployments** tab
3. Click on the three dots (⋯) next to the latest deployment
4. Select **Redeploy**
5. Check **"Use existing Build Cache"** - **UNCHECK THIS**
6. Click **Redeploy**

This will force a fresh build without cached files.

### Step 3: Verify No Duplicate Register Page

Before redeploying, let's make absolutely sure there's no duplicate:

**Check locally:**

```powershell
# Run this in PowerShell from project root
Get-ChildItem -Path "web-admin\app" -Recurse -Filter "page.tsx" | Where-Object { $_.FullName -match "register" } | Select-Object FullName
```

**Expected result:** Should only show `web-admin\app\(auth)\register\page.tsx`

If you see any other register page, delete it.

### Step 4: Verify Component Exports

All components should be properly exported. Let's verify:

1. **Switch component**: `web-admin/components/ui/Switch.tsx` ✅
2. **Badge component**: `web-admin/components/ui/badge.tsx` ✅
3. **useLocale hook**: `web-admin/lib/hooks/useLocale.ts` ✅

All are exported correctly in their respective files.

### Step 5: Update Next.js Version (Optional but Recommended)

To match Vercel's Next.js version or ensure compatibility:

1. Check what Next.js version Vercel is using (15.5.4 from the error)
2. Consider pinning the version in `package.json`:
   ```json
   "next": "15.5.4"
   ```
   OR keep `"next": "^16.1.0"` and ensure Vercel uses the latest

### Step 6: Test Build Locally First

Before deploying to Vercel, test the build locally:

```powershell
cd web-admin
npm run build
```

If this succeeds locally, the issue is Vercel-specific.

### Step 7: Redeploy on Vercel

After completing steps 1-6:

1. Push any changes to your repository
2. Vercel will automatically trigger a new deployment
3. OR manually trigger a deployment from Vercel dashboard
4. Monitor the build logs

---

## If Build Still Fails

### Option A: Check for Hidden Files

Sometimes files exist but aren't visible. Check for:

- `app/(public)/register/page.tsx` (even if folder appears empty)
- Any `.tsx` files in `app/(public)/` directory

### Option B: Explicitly Set Build Command in vercel.json

Update `web-admin/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs"
}
```

### Option C: Add .vercelignore

Create `web-admin/.vercelignore` to exclude problematic files:

```
.next
node_modules
.git
```

### Option D: Check Vercel Environment Variables

Ensure all required environment variables are set in Vercel:

- Database URLs
- API keys
- Supabase credentials

---

## Quick Checklist

Before redeploying, verify:

- [ ] Vercel Root Directory is set to `web-admin`
- [ ] No duplicate register page exists
- [ ] All components exist and are exported
- [ ] Local build succeeds (`npm run build`)
- [ ] Build cache is cleared
- [ ] Environment variables are set in Vercel
- [ ] `vercel.json` is configured correctly

---

## Expected Outcome

After following these steps:

- ✅ Build should complete successfully
- ✅ All 71 pages should generate
- ✅ No module resolution errors
- ✅ Deployment should succeed

---

## If Issues Persist

1. **Check Vercel Build Logs** - Look for specific error messages
2. **Compare Local vs Vercel** - Note any differences in Node.js version, Next.js version
3. **Contact Support** - Vercel support can help with build-specific issues

---

**Priority**: High  
**Estimated Time**: 15-30 minutes  
**Status**: Ready to execute
