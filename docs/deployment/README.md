# 🚀 CleanMateX Tenant App - Production Deployment Guide

**Status**: Ready for Production Deployment
**Last Updated**: 2025-12-15
**Project**: Tenant-Facing Application

---

## Overview

This is the **cleanmatex** project - the tenant-facing SaaS application. This guide covers deployment alongside the sibling **cleanmatexsaas** (Platform HQ Console) project.

### Project Location
- **This Project**: `F:\jhapp\cleanmatex\` (Tenant App)
- **Sibling Project**: `F:\jhapp\cleanmatexsaas\` (Platform Console)

### Key Points
- This project **OWNS** database migrations
- Shared Supabase database with cleanmatexsaas
- Deploy cleanmatex **BEFORE** cleanmatexsaas
- Uses Supabase anon key (RLS enforced)

---

## 📚 Complete Documentation

All comprehensive deployment documentation is in the **cleanmatexsaas** project:

### Essential Guides (in cleanmatexsaas/docs/deployment/)

1. **[Deployment Summary](../../../cleanmatexsaas/docs/deployment/PRODUCTION_DEPLOYMENT_SUMMARY.md)**
   - Overview and quick start
   - Cost estimates
   - Security rules

2. **[Production Deployment Plan](../../../cleanmatexsaas/docs/deployment/PRODUCTION_DEPLOYMENT_PLAN.md)**
   - Complete deployment strategy
   - Step-by-step process
   - Rollback procedures

3. **[Infrastructure Requirements](../../../cleanmatexsaas/docs/deployment/INFRASTRUCTURE_REQUIREMENTS.md)**
   - Platform specifications
   - Cost breakdown
   - Monitoring setup

4. **[Deployment Checklist](../../../cleanmatexsaas/docs/deployment/DEPLOYMENT_CHECKLIST.md)**
   - Task-by-task checklist
   - Timeline and verification

5. **[Environment Configuration](../../../cleanmatexsaas/docs/deployment/ENVIRONMENT_CONFIGURATION.md)**
   - Environment variables
   - Secrets management

---

## 🎯 Quick Start for cleanmatex

### Environment Variables (Production)

**File**: Set in Vercel Environment Variables

```env
# ============================================
# SUPABASE CONFIGURATION
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production-anon-key>

# ⚠️ NOTE: cleanmatex does NOT use service role key
# Service role key is only in cleanmatexsaas

# ============================================
# APPLICATION CONFIGURATION
# ============================================
NEXT_PUBLIC_APP_URL=https://app.cleanmatex.com

# ============================================
# INTERNATIONALIZATION
# ============================================
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_SUPPORTED_LOCALES=en,ar

# ============================================
# MONITORING (Optional)
# ============================================
NEXT_PUBLIC_SENTRY_DSN=<sentry-dsn>
SENTRY_AUTH_TOKEN=<sentry-token>

# ============================================
# EMAIL SERVICE (Optional)
# ============================================
RESEND_API_KEY=<resend-api-key>
```

### Local Development Setup

**File**: `web-admin/.env.local`

```env
# Local Supabase (from cleanmatex/supabase)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Start local development**:

```bash
# Terminal 1: Start Supabase
cd F:\jhapp\cleanmatex
.\scripts\dev\start-services.ps1

# Terminal 2: Start web app
cd web-admin
npm run dev
# Visit: http://localhost:3000
```

---

## 🗄️ Database Migrations

### Critical: This Project Owns Migrations

**Migration Location**: `F:\jhapp\cleanmatex\supabase\migrations\`

This is the **SINGLE SOURCE OF TRUTH** for database schema.

### Local Testing

```bash
cd F:\jhapp\cleanmatex

# Reset database (applies all migrations)
supabase db reset

# List migrations
supabase migration list

# Create new migration
supabase migration new <description>
```

### Production Migrations

**Process**:
1. Backup production database
2. Test migrations in staging
3. Deploy cleanmatex (runs migrations)
4. Verify success
5. Deploy cleanmatexsaas (uses updated schema)

**Commands**:
```bash
# Link to production
supabase link --project-ref <production-ref>

# Push migrations
supabase db push

# Verify
supabase migration list
```

### After Schema Changes

```bash
# Regenerate types for cleanmatex
cd web-admin
npx supabase gen types typescript --local > lib/types/database.ts

# ALSO regenerate types for cleanmatexsaas
cd ../../cleanmatexsaas/platform-web
npm run types:generate
```

---

## 🚀 Deployment Process

### Deployment Order (CRITICAL)

```
1. cleanmatex (THIS PROJECT) ← Deploy FIRST
   ↓
2. Verify cleanmatex working
   ↓
3. cleanmatexsaas (sibling) ← Deploy SECOND
```

**Why?**
- cleanmatex runs database migrations
- cleanmatexsaas depends on updated schema
- Prevents schema version mismatches

### Step-by-Step Deployment

**Phase 1: Database Migration (15 min)**

```bash
cd F:\jhapp\cleanmatex

# Backup first!
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Run migrations
supabase link --project-ref <production-ref>
supabase db push

# Verify
supabase migration list
```

**Phase 2: Deploy cleanmatex (30 min)**

```bash
# Trigger deployment (via Git push or Vercel)
git push origin main

# Or manual via Vercel CLI
vercel --prod

# Monitor deployment in Vercel dashboard
```

**Phase 3: Verify cleanmatex (15 min)**

```bash
# Test critical flows
1. Visit https://app.cleanmatex.com
2. Test login
3. Test dashboard
4. Test orders page
5. Verify tenant isolation
```

**Phase 4: Deploy cleanmatexsaas (see sibling project)**

```bash
# Switch to sibling project
cd ../cleanmatexsaas

# Follow deployment guide there
```

---

## ⚠️ Security Notes for cleanmatex

### What cleanmatex Uses

✅ **Supabase Anon Key**:
- Safe for public/frontend use
- Row-Level Security (RLS) enforced
- Automatically filters by tenant_org_id
- Cannot access other tenants' data

### What cleanmatex Does NOT Use

❌ **Service Role Key**:
- NOT used in cleanmatex
- Only used in cleanmatexsaas
- Bypasses RLS (dangerous if misused)
- Never needed in tenant app

### Security Checklist

- [ ] Using anon key (not service role)
- [ ] RLS policies tested and working
- [ ] Tenant isolation verified
- [ ] No credentials in code
- [ ] `.env.local` in `.gitignore`

---

## 📊 Monitoring & Verification

### Health Check Endpoint

**URL**: https://app.cleanmatex.com/api/health

**Expected Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-15T10:30:00.000Z"
}
```

### Post-Deployment Checks

```bash
# 1. Application loads
curl https://app.cleanmatex.com

# 2. Health check passes
curl https://app.cleanmatex.com/api/health

# 3. No errors in Sentry
# Check Sentry dashboard

# 4. Performance acceptable
# Check Vercel Analytics
```

### Smoke Tests

- [ ] Homepage loads
- [ ] User login works
- [ ] Dashboard displays
- [ ] Orders page works
- [ ] Customer page works
- [ ] Tenant isolation verified

---

## 🔄 Rollback Procedures

### Application Rollback (5 minutes)

```bash
# Via Vercel dashboard
1. Go to cleanmatex project → Deployments
2. Find last working deployment
3. Click "Promote to Production"

# Or via CLI
vercel rollback <last-good-deployment-url>
```

### Database Rollback (15 minutes)

```bash
cd F:\jhapp\cleanmatex

# Option 1: Rollback migration
supabase migration new rollback_<feature>
# Write DOWN migration SQL
supabase db push

# Option 2: Restore from backup
# Download backup from Supabase dashboard
psql <connection-string> < backup.sql
```

---

## 💰 Cost Allocation (cleanmatex)

### Dedicated Costs
- **Vercel Pro**: $20/month (this project)

### Shared Costs (with cleanmatexsaas)
- **Supabase Pro**: $25/month (shared database)
- **Monitoring**: Varies (shared tools)

**Total for cleanmatex**: ~$20-50/month (depending on shared services)

---

## 📁 Project Structure

```
cleanmatex/
├── web-admin/              # Next.js app (port 3000)
│   ├── app/                # Next.js App Router
│   ├── lib/                # Utilities, types
│   ├── src/                # UI components, features
│   ├── .env.local          # Local environment (gitignored)
│   └── package.json
│
├── supabase/               # Database (SINGLE SOURCE OF TRUTH)
│   ├── migrations/         # All schema migrations
│   └── seed.sql            # Seed data
│
└── scripts/                # Dev scripts
    └── dev/
        └── start-services.ps1
```

---

## 🔗 Related Projects

### Sibling Project: cleanmatexsaas

**Location**: `F:\jhapp\cleanmatexsaas\`

**Purpose**: Platform HQ administration console

**Relationship**:
- Shares same Supabase database
- Uses service role key (bypasses RLS)
- Manages all tenants
- Deployed independently

**Documentation**: See `../cleanmatexsaas/docs/`

---

## ✅ Pre-Deployment Checklist (cleanmatex)

### Code Ready
- [ ] All tests passing: `npm test`
- [ ] E2E tests passing: `npm run test:e2e`
- [ ] Build successful: `npm run build`
- [ ] TypeScript clean: `npx tsc --noEmit`
- [ ] ESLint passing: `npm run lint`

### Database Ready
- [ ] All migrations in `supabase/migrations/`
- [ ] Migrations tested locally: `supabase db reset`
- [ ] RLS policies tested
- [ ] Types generated: types in `lib/types/database.ts`

### Environment Ready
- [ ] Production Supabase project created
- [ ] Environment variables set in Vercel
- [ ] Domain configured: app.cleanmatex.com
- [ ] SSL certificate (automatic)

### Vercel Project Ready
- [ ] Project created in Vercel
- [ ] Linked to GitHub repo
- [ ] Framework: Next.js
- [ ] Root directory: `web-admin`
- [ ] Build command: `npm run build`
- [ ] Production environment variables set

---

## 🎯 Success Criteria

### Deployment Success
- [ ] Zero critical errors
- [ ] All smoke tests pass
- [ ] Page load < 3 seconds
- [ ] Error rate < 1%
- [ ] Tenant isolation verified
- [ ] No user complaints in 24 hours

### Performance Targets
- [ ] Lighthouse score > 90
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1

---

## 📞 Support

### Documentation
- **Complete guides**: `../cleanmatexsaas/docs/`
- **Local setup**: `web-admin/README.md`
- **Database docs**: `docs/Database_Design/`

### External Resources
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## 🚀 Ready to Deploy?

### Start Here:

1. **Review**: Read [../cleanmatexsaas/docs/PRODUCTION_DEPLOYMENT_SUMMARY.md](../cleanmatexsaas/docs/PRODUCTION_DEPLOYMENT_SUMMARY.md)
2. **Prepare**: Follow [../cleanmatexsaas/docs/INFRASTRUCTURE_REQUIREMENTS.md](../cleanmatexsaas/docs/INFRASTRUCTURE_REQUIREMENTS.md)
3. **Configure**: Set environment variables per [../cleanmatexsaas/docs/ENVIRONMENT_CONFIGURATION.md](../cleanmatexsaas/docs/ENVIRONMENT_CONFIGURATION.md)
4. **Deploy**: Execute [../cleanmatexsaas/docs/DEPLOYMENT_CHECKLIST.md](../cleanmatexsaas/docs/DEPLOYMENT_CHECKLIST.md)

### Remember:
- Deploy cleanmatex **FIRST** (runs migrations)
- Deploy cleanmatexsaas **SECOND** (uses schema)
- Monitor for 24 hours
- Document any issues

---

**Project**: cleanmatex (Tenant App)
**Port**: 3000 (local) | app.cleanmatex.com (production)
**Database**: Shared with cleanmatexsaas
**Deployment Order**: Deploy FIRST

Good luck! 🎉
