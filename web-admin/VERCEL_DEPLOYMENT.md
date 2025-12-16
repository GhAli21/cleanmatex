# Vercel Deployment Guide for CleanMateX

## Quick Setup Checklist

### 1. Vercel Project Settings

**Root Directory Configuration:**
- Go to: **Vercel Dashboard → Project Settings → Build and Deployment**
- Set **Root Directory** to: `web-admin`
- This tells Vercel where your Next.js app is located

**Framework Detection:**
- After setting root directory, Vercel should automatically detect **Next.js**
- Framework Preset should show: **Next.js** ✅

### 2. Environment Variables

Add these environment variables in **Vercel Dashboard → Settings → Environment Variables**:

#### Required Variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Node Environment
NODE_ENV=production
```

#### Optional Variables:

```env
# Feature Flags
NEXT_PUBLIC_FEATURE_PREPARATION=true

# Redis (if using)
REDIS_URL=your-redis-url

# MinIO Storage (if using)
MINIO_ENDPOINT=your-minio-endpoint
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
NEXT_PUBLIC_STORAGE_URL=your-storage-url

# Sentry (if using)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

**Important:** 
- Set these for **Production**, **Preview**, and **Development** environments as needed
- Never commit `.env.local` files to git
- Use Vercel's environment variables UI for all secrets

### 3. Build Configuration

The `vercel.json` file is already configured with:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "outputDirectory": ".next"
}
```

**No changes needed** - Vercel will use these settings automatically.

### 4. Deployment Steps

1. **Push to Git:**
   ```bash
   git add .
   git commit -m "Configure Vercel deployment"
   git push
   ```

2. **Vercel Auto-Deploy:**
   - If connected to Git, Vercel will automatically deploy on push
   - Check **Deployments** tab for build status

3. **Manual Deploy (if needed):**
   - Go to **Deployments** tab
   - Click **Redeploy** on latest deployment

### 5. Verify Deployment

After deployment, check:

- ✅ Build completes successfully
- ✅ No 404 errors on main routes
- ✅ Environment variables are set correctly
- ✅ Supabase connection works
- ✅ Authentication flow works

### 6. Troubleshooting

#### Issue: 404 NOT_FOUND Error

**Solution:**
- Verify **Root Directory** is set to `web-admin` in Vercel settings
- Check that `vercel.json` exists in `web-admin/` directory
- Ensure framework is detected as "Next.js"

#### Issue: Build Fails

**Check:**
- Environment variables are set correctly
- Node.js version matches (requires >=20.0.0)
- All dependencies are in `package.json`
- No TypeScript errors (`npm run build` locally first)

#### Issue: Framework Not Detected

**Solution:**
- Set Root Directory to `web-admin`
- Verify `package.json` has Next.js as dependency
- Check that `next.config.ts` exists

#### Issue: Environment Variables Not Working

**Solution:**
- Verify variables are set in correct environment (Production/Preview/Development)
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

### 7. Post-Deployment

After successful deployment:

1. **Test Authentication:**
   - Try logging in
   - Verify session persistence

2. **Test API Routes:**
   - Check `/api` endpoints
   - Verify Supabase connections

3. **Monitor Logs:**
   - Check **Vercel Dashboard → Logs** for errors
   - Monitor **Observability** tab for performance

4. **Set Custom Domain (Optional):**
   - Go to **Settings → Domains**
   - Add your custom domain
   - Configure DNS records

## Current Configuration

- **Framework:** Next.js 15.5.4
- **Node Version:** >=20.0.0
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Root Directory:** `web-admin` (set in Vercel UI)

## Support

For deployment issues:
1. Check Vercel build logs
2. Verify environment variables
3. Test build locally: `cd web-admin && npm run build`
4. Check Next.js documentation: https://nextjs.org/docs/deployment

