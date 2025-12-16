# Common Issues & Debugging Rules

## Overview
Common problems and their solutions for CleanMateX development.

## Rules

### RLS Policy Blocking Query
- Check if RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables`
- Check existing policies: `SELECT * FROM pg_policies`
- Ensure JWT contains tenant_org_id claim
- Use service role for admin operations when needed
- Fix RLS policy to match JWT claims

### Cross-Tenant Data Leak
- Always add tenant_org_id filter to queries
- Create helper function to enforce tenant filtering
- Log queries to verify tenant filter is present
- Test tenant isolation after changes

### Migration Fails
- Fix table creation order (create parent tables first)
- Fix foreign key issues (add CASCADE for cleanup)
- Use transactions for migrations
- Test migrations with `supabase db reset --debug`

### N+1 Query Problem
- Use joins in single query instead of loops
- Use Supabase select with relations: `select('*, customer:org_customers_mst(*)')`
- Use Prisma include for related data
- Avoid fetching related data in loops

### TypeScript Type Errors
- Regenerate types from database: `supabase gen types typescript --local`
- Update custom types manually if needed
- Restart TypeScript server after type changes

### Authentication Issues
- Check auth status: `await supabase.auth.getSession()`
- Verify JWT claims contain tenant_org_id
- Add tenant_org_id during signup
- Refresh session if expired

### Slow Queries
- Add missing indexes on frequently queried fields
- Use EXPLAIN ANALYZE to check query performance
- Select only needed columns
- Optimize joins and filters

### Arabic/RTL Display Issues
- Set HTML direction: `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`
- Use Tailwind RTL utilities: `rtl:text-right`, `rtl:ml-0 rtl:mr-4`
- Flip icons: `rtl:rotate-180`
- Import Arabic font: Noto Sans Arabic

## Conventions
- Always check RLS policies when queries fail
- Always verify tenant filtering is present
- Always test migrations before deploying
- Always optimize queries with proper indexes
- Always test RTL layout for Arabic interface
