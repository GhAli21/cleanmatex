# Environment Configuration Rules

## Overview
Rules for managing environment variables and configuration.

## Rules

### Environment Files Structure
- `.env.example` - Template for environment variables
- `.env.local` - Local development (git-ignored)
- `.env.production` - Production variables (git-ignored)
- `web-admin/.env.local` - Next.js specific variables

### Local Development Configuration
- Supabase URL: `http://127.0.0.1:54321`
- Database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Redis URL: `redis://localhost:6379`
- MinIO: `localhost:9000` (API), `localhost:9001` (Console)
- Default locale: `en`
- Default timezone: `Asia/Muscat`
- Default currency: `OMR`

### Production Configuration
- Use production Supabase project URL and keys
- Use production database connection string
- Use production Redis URL (with TLS)
- Use S3/Storage for production (not MinIO)
- Set NODE_ENV to `production`
- Configure payment gateway credentials
- Configure WhatsApp Business API credentials
- Configure monitoring (Sentry DSN)

### Environment Variables by Service
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Payment Gateways: `HYPERPAY_ENTITY_ID`, `PAYTABS_PROFILE_ID`, `STRIPE_SECRET_KEY`
- Communication: `WHATSAPP_API_TOKEN`, `TWILIO_ACCOUNT_SID`, `SENDGRID_API_KEY`
- Monitoring: `SENTRY_DSN`, `NEW_RELIC_LICENSE_KEY`

### Environment Validation
- Use Zod schema to validate environment variables
- Validate on application startup
- Provide clear error messages for missing variables
- Use defaults where appropriate

### Security Best Practices
- Never commit secrets to git
- Use different keys for different environments
- Rotate keys regularly
- Use secure storage in production (AWS Secrets Manager, Vercel Env)
- Never hardcode secrets in code

### Loading Environment Variables
- Next.js automatically loads `.env.local`
- Use `NEXT_PUBLIC_` prefix for client-side variables
- Access via `process.env.VARIABLE_NAME`
- Validate environment on startup

## Conventions
- Always use environment variables, never hardcode values
- Always validate environment on startup
- Always use `.env.example` as template
- Always keep secrets out of version control
- Always use different keys for different environments
