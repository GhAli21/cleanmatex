# Config File Annotation Rules

Every non-default option in config files must be annotated. Explain WHY the option is set, not WHAT it does.

---

## `next.config.ts` — Every Non-Default Option

```typescript
import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // outputFileTracingRoot: prevents monorepo lockfile detection warning in root builds
  // Required because web-admin is not at the repo root; Next.js otherwise looks upward for lockfiles
  outputFileTracingRoot: path.join(__dirname),

  typescript: {
    // ignoreBuildErrors: temporary measure — tracked in docs/dev/CompletePendingAndTODOCodes_13022026/
    // Remove once all strict TypeScript violations are resolved
    ignoreBuildErrors: true,
  },

  eslint: {
    // ignoreDuringBuilds: ESLint runs separately in CI; keeping it off speeds up production builds
    ignoreDuringBuilds: true,
  },

  experimental: {
    // serverActions.bodySizeLimit: increased for order attachment uploads (default is 1MB)
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
};
```

---

## `tailwind.config.ts` — Every Custom Token

```typescript
colors: {
  // cmx-primary: main brand colour; matches --cmx-primary-rgb CSS variable in globals.css
  'cmx-primary': 'rgb(var(--cmx-primary-rgb) / <alpha-value>)',

  // cmx-surface: card and panel backgrounds; lighter than white to avoid harsh contrast
  'cmx-surface': 'rgb(var(--cmx-surface-rgb) / <alpha-value>)',

  // cmx-border: default border colour; slightly warmer than neutral-200 per design spec
  'cmx-border': 'rgb(var(--cmx-border-rgb) / <alpha-value>)',
},

spacing: {
  // sidebar: fixed sidebar width — must stay in sync with --cmx-sidebar-width CSS variable
  'sidebar': '16rem',

  // header: top navigation bar height — used by AppShell for content offset
  'header': '4rem',
},

fontFamily: {
  // sans: Inter for LTR; Cairo appended for Arabic characters (Cairo has better Arabic coverage)
  sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
},
```

---

## `prisma/schema.prisma` — Model Block + Non-Obvious Fields

```prisma
/// Master table for laundry service items offered by tenants.
/// org_* scope: RLS enforced at Postgres level; tenant_org_id is required on all queries.
/// Bilingual: use name (EN) and name2 (AR) — never store translations in a separate table.
model org_items_mst {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_org_id   String   @db.Uuid

  /// Maps to the PostgreSQL snake_case table name (pre-prefix naming convention)
  @@map("org_items_mst")
}
```

Field-level comments (use `///` for Prisma, `//` is ignored by Prisma generators):

```prisma
/// rec_status: 1=active, 0=soft-deleted. Never hard-delete — audit history must be preserved.
rec_status  Int  @default(1) @db.SmallInt

/// price: item base price before tenant pricing rules are applied. DECIMAL(19,4) for financial precision.
price       Decimal  @db.Decimal(19, 4)
```

---

## `.env.example` — Every Variable

```bash
# ─── Supabase ────────────────────────────────────────────────────────────────

# Supabase project URL — required
# Format: https://<project-ref>.supabase.co
# Found in: Supabase Dashboard > Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_URL=

# Supabase anon (public) key — required; safe to expose in browser (RLS enforced)
# Found in: Supabase Dashboard > Settings > API > Project API Keys > anon
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase service role key — required on server side; NEVER expose to browser
# Used by server actions to bypass RLS for admin operations
# Found in: Supabase Dashboard > Settings > API > Project API Keys > service_role
SUPABASE_SERVICE_ROLE_KEY=

# ─── Rate Limiting (Upstash Redis) ────────────────────────────────────────────

# Upstash Redis REST URL — required for rate limiting server actions
# Optional in local development (rate limiting is skipped if not set)
UPSTASH_REDIS_REST_URL=

# Upstash Redis REST token — required alongside UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=
```

---

## `tsconfig.json` — Path Aliases

```json
{
  "compilerOptions": {
    "paths": {
      // @ui/* — Cmx Design System components (primitives, feedback, overlays, forms, etc.)
      "@ui/*": ["./src/ui/*"],

      // @lib/* — shared infrastructure: db client, hooks, utils, services, constants, types
      "@lib/*": ["./lib/*"],

      // @/* — Next.js default alias pointing to project root
      "@/*": ["./*"]
    }
  }
}
```

---

## `jest.config.ts` / `jest.config.js`

```typescript
const config: Config = {
  // testEnvironment: jsdom for React component tests; node for service/integration tests
  testEnvironment: 'node',

  // moduleNameMapper: mirrors tsconfig paths so Jest can resolve @ui/* and @lib/* imports
  moduleNameMapper: {
    '^@ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
  },

  // setupFilesAfterFramework: loads jest-extended matchers and Supabase mock setup
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
};
```

---

## What NOT to Annotate

Skip annotation for:
- `"type": "module"` in `package.json` — standard, no comment needed
- `"private": true` in `package.json` — standard, no comment needed
- Default `compilerOptions` like `"strict": true`, `"esModuleInterop": true` — standard
- `.gitignore` entries — self-explanatory by nature
