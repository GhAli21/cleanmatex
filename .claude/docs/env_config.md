> Combined from `@.claude/docs/env_config.md` and `@.claude/docs/10-environment.md` on 2025-10-17

# Environment Configuration

## Local (.env)
- Supabase URL/keys, Database URL, Redis, MinIO
- App config and regional defaults (locale, timezone, currency)

## Production
- Supabase, DB, Redis, S3
- App URL, monitoring (Sentry)
- Payment gateways and WhatsApp Business API


---

## 🌍 ENVIRONMENT SETUP

### Environment Files Structure
```
cleanmatex/
├── .env.example          # Template for environment variables
├── .env.local           # Local development (git-ignored)
├── .env.production      # Production variables (git-ignored)
└── web-admin/
    └── .env.local       # Next.js specific variables
```

---

## Local Development Configuration

### Root .env.local
```env
# Supabase (Local Development)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_anon_key_from_supabase_start
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_from_supabase_start

# Database (Direct Access)
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Alternative Docker PostgreSQL
# DATABASE_URL=postgresql://cmx_user:cmx_pass_dev@localhost:5432/cmx_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# MinIO (S3-compatible storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=cleanmatex-uploads

# Application
NODE_ENV=development
APP_URL=http://localhost:3000

# Regional Settings
DEFAULT_LOCALE=en
DEFAULT_TIMEZONE=Asia/Muscat
DEFAULT_CURRENCY=OMR
DEFAULT_COUNTRY_CODE=OM
DEFAULT_PHONE_CODE=+968
```

### web-admin/.env.local
```env
# Supabase (Public keys only)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_from_supabase_start

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CleanMateX

# Regional Settings (Client-side)
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_DEFAULT_TIMEZONE=Asia/Muscat
NEXT_PUBLIC_DEFAULT_CURRENCY=OMR
NEXT_PUBLIC_SUPPORTED_LOCALES=en,ar

# Feature Flags
NEXT_PUBLIC_ENABLE_WHATSAPP=false
NEXT_PUBLIC_ENABLE_PAYMENT=false
NEXT_PUBLIC_ENABLE_MARKETPLACE=false
```

---

## Production Configuration

### Production .env
```env
# Supabase (Production)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=production_anon_key
SUPABASE_SERVICE_ROLE_KEY=production_service_role_key

# Database (Production)
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# Redis (Production - Use Redis Cloud free tier)
REDIS_URL=redis://default:password@redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com:12345
REDIS_TLS=true

# S3/Storage (Production)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=me-south-1
S3_BUCKET=cleanmatex-production

# Application
NODE_ENV=production
APP_URL=https://app.cleanmatex.com

# Payment Gateways (GCC Region)
HYPERPAY_ENTITY_ID=your_entity_id
HYPERPAY_ACCESS_TOKEN=your_access_token
HYPERPAY_MERCHANT_ID=your_merchant_id
HYPERPAY_TEST_MODE=false

PAYTABS_PROFILE_ID=your_profile_id
PAYTABS_SERVER_KEY=your_server_key
PAYTABS_CLIENT_KEY=your_client_key
PAYTABS_ENDPOINT=https://secure.paytabs.com

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# WhatsApp Business API
WHATSAPP_API_URL=https://api.whatsapp.com/v1
WHATSAPP_API_TOKEN=your_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# SMS Gateway (GCC)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+968xxxxxxxx

# Email Service
EMAIL_FROM=noreply@cleanmatex.com
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_sendgrid_key

# Monitoring
SENTRY_DSN=https://xxxx@sentry.io/yyyy
SENTRY_ENVIRONMENT=production
NEW_RELIC_LICENSE_KEY=your_license_key

# Security
JWT_SECRET=your_very_long_random_string
ENCRYPTION_KEY=your_32_character_encryption_key
CORS_ORIGIN=https://app.cleanmatex.com,https://www.cleanmatex.com
```

---

## Environment Variables by Service

### Supabase Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Secret service role key |

### Payment Gateway Variables
| Provider | Variables | Region |
|----------|-----------|--------|
| **HyperPay** | `HYPERPAY_ENTITY_ID`, `HYPERPAY_ACCESS_TOKEN` | GCC |
| **PayTabs** | `PAYTABS_PROFILE_ID`, `PAYTABS_SERVER_KEY` | GCC |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` | Global |

### Communication Variables
| Service | Variables |
|---------|-----------|
| **WhatsApp** | `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |
| **SMS** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| **Email** | `SENDGRID_API_KEY`, `EMAIL_FROM` |

---

## Loading Environment Variables

### Next.js (Automatic)
```typescript
// Next.js automatically loads .env.local
// Access public variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Access server-only variables
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### NestJS Configuration
```typescript
// backend/src/config/configuration.ts
export default () => ({
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
  },
  payment: {
    hyperpay: {
      entityId: process.env.HYPERPAY_ENTITY_ID,
      accessToken: process.env.HYPERPAY_ACCESS_TOKEN,
    },
  },
});

// Usage in service
@Injectable()
export class PaymentService {
  constructor(private configService: ConfigService) {}
  
  getHyperPayConfig() {
    return this.configService.get('payment.hyperpay');
  }
}
```

---

## Environment Validation

### Schema Validation with Zod
```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Required variables
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DEFAULT_LOCALE: z.enum(['en', 'ar']).default('en'),
  
  // Conditional requirements
  STRIPE_SECRET_KEY: z.string().optional(),
  HYPERPAY_ENTITY_ID: z.string().optional(),
});

// Validate on startup
export const env = envSchema.parse(process.env);
```

---

## Security Best Practices

### Never Commit Secrets
```gitignore
# .gitignore
.env
.env.*
!.env.example
```

### Use Different Keys for Environments
```bash
# Generate secure random keys
openssl rand -base64 32  # For JWT_SECRET
openssl rand -hex 32      # For ENCRYPTION_KEY
```

### Rotate Keys Regularly
- Service role keys: Every 90 days
- JWT secrets: Every 180 days
- API tokens: When staff changes

### Secure Storage in Production
- Use environment variables in hosting platform
- Use secrets management (AWS Secrets Manager, Vercel Env)
- Never hardcode secrets in code

---

## Deployment Platform Configuration

### Vercel
```bash
# Set environment variables via CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY --sensitive

# Or use vercel.json
{
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_key"
  }
}
```

### Docker
```dockerfile
# Dockerfile
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# docker-compose.yml
services:
  web:
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
```

### Kubernetes
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cleanmatex-secrets
type: Opaque
data:
  supabase-service-key: <base64-encoded-key>

# deployment.yaml
env:
  - name: SUPABASE_SERVICE_ROLE_KEY
    valueFrom:
      secretKeyRef:
        name: cleanmatex-secrets
        key: supabase-service-key
```

---

## Environment Debugging

### Check Loaded Variables
```typescript
// Debug in development only
if (process.env.NODE_ENV === 'development') {
  console.log('Loaded environment:');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Redis URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
}
```

### Common Issues
1. **Variable not loading**: Check naming (NEXT_PUBLIC_ prefix for client-side)
2. **Wrong environment**: Verify NODE_ENV value
3. **Missing in production**: Add to hosting platform's env settings
4. **Special characters**: Wrap values in quotes if they contain special chars

---

## Return to [Main Documentation](../CLAUDE.md)
