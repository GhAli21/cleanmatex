# Project Structure Rules

## Overview
High-level project directory structure and key file locations.

## Rules

### Root Directories
- `supabase/` - Database schema, migrations, and RLS policies
- `web-admin/` - Next.js admin dashboard application
- `backend/` - NestJS API (planned)
- `mobile-apps/` - Flutter applications (planned)
- `packages/` - Shared packages (i18n, types, utils)
- `docs/` - All project documentation

### Key Files
- Database migrations: `supabase/migrations/0001_core.sql`, `0002_rls_core.sql`, `0003_seed_core.sql`
- Supabase client: `web-admin/lib/supabase.ts`
- Translation files: `web-admin/messages/en.json`, `web-admin/messages/ar.json`

## Conventions
- Follow feature-based organization within each directory
- Keep shared code in `packages/`
- Maintain consistent naming conventions across directories
