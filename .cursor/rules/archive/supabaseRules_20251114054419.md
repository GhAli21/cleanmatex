# Supabase Usage Rules

## Overview
Guidelines for integrating and using Supabase in CleanMateX.

## Rules

### Security & Access
- Enable Row-Level Security (RLS) on all tables
- Define roles and policies per tenant and plan tier
- Never use service role key in client-side code
- Always validate tenant context before queries

### Schema & Logic
- Use PostgreSQL functions for complex business logic
- Wrap logic in Supabase RPCs for reusability
- Keep database functions focused and testable

### Validation & Logging
- Validate data before inserts/updates
- Log all mutations with timestamp, user ID, and tenant ID
- Use database triggers for audit trails where appropriate

### DevOps
- Backup schema weekly to `infra/backups/`
- Store configuration in `supabase/config/` with versioned `.sql` files
- Use migrations for all schema changes
- Never modify production schema directly

## Conventions
- Use Supabase Local for development (port 54322)
- Generate TypeScript types after schema changes
- Test RLS policies before deploying
