# Multi-Tenancy Core - Development Plan & PRD

**Document ID**: 004_multi_tenancy_core_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: Backend Team  
**Dependencies**: 001, 002, 003  
**Related Requirements**: NFR-SEC-001, NFR-SCL-001

---

## 1. Overview & Context

### Purpose

Implement comprehensive multi-tenancy framework ensuring complete data isolation, tenant provisioning, slug-based routing, and tenant-specific configuration management.

### Business Value

- Enables SaaS business model
- Complete data isolation per laundry business
- Scalable to thousands of tenants
- Customizable per tenant
- Efficient resource utilization

### User Personas Affected

- Platform Super Admin
- Tenant Admins
- All tenant users

### Key Use Cases

- UC-MT-001: New tenant signs up and is provisioned
- UC-MT-002: Tenant accesses via unique subdomain/slug
- UC-MT-003: Tenant data completely isolated from others
- UC-MT-004: Tenant configures custom settings
- UC-MT-005: Platform admin manages all tenants

---

## 2. Functional Requirements

### FR-MT-001: Tenant Provisioning

**Description**: Automate tenant creation and initialization

**Acceptance Criteria**:

- New tenant created with unique slug
- Default branch created automatically
- Admin user linked to tenant
- Service categories enabled
- Default settings initialized
- Welcome email sent
- Onboarding checklist created

### FR-MT-002: Slug-Based Routing

**Description**: Route requests to correct tenant by slug

**Acceptance Criteria**:

- URL format: `https://slug.cleanmatex.com` or `https://app.cleanmatex.com/slug`
- Slug validated and tenant resolved
- 404 for invalid slugs
- Slug uniqueness enforced
- Slug can be changed (with validation)
- Old slugs redirected (optional)

### FR-MT-003: Tenant Context Injection

**Description**: Inject tenant context into every request

**Acceptance Criteria**:

- Middleware extracts tenant from slug/subdomain
- Tenant ID added to request context
- JWT validated against tenant
- All queries filtered by tenant_org_id
- No hardcoded tenant IDs in code

### FR-MT-004: Tenant Configuration

**Description**: Per-tenant settings and customization

**Acceptance Criteria**:

- Timezone, currency, language per tenant
- Branding (logo, colors, email footer)
- Feature flags per tenant
- Workflow configuration
- Notification preferences
- Business hours and holidays

### FR-MT-005: Subscription & Limits

**Description**: Enforce usage limits based on subscription plan

**Acceptance Criteria**:

- Orders limit per month enforced
- Branch limit enforced
- User limit enforced
- Feature access based on plan
- Soft limits warn, hard limits block
- Usage tracked in real-time

---

## 3. Technical Design

### Multi-Tenancy Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Request: https://demo-laundry.cleanmatex.com/orders   │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  Tenant Resolution Middleware                           │
│  1. Extract slug from subdomain or path                │
│  2. Query org_tenants_mst WHERE slug = 'demo-laundry' │
│  3. Add tenant_id to request context                   │
│  4. Validate JWT tenant_id matches                     │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  Application Layer                                      │
│  - req.tenant_id available in all handlers            │
│  - Automatic tenant_org_id in queries                  │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  Database Layer (RLS enforces isolation)                │
│  WHERE tenant_org_id = auth.jwt()->>'tenant_id'        │
└─────────────────────────────────────────────────────────┘
```

### Database Schema

**org_tenants_mst** (existing):

```sql
CREATE TABLE org_tenants_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name2 VARCHAR(255), -- Arabic name
  slug VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  s_cureent_plan VARCHAR(120) DEFAULT 'plan_freemium',
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(2) DEFAULT 'OM',
  currency VARCHAR(3) DEFAULT 'OMR',
  timezone VARCHAR(50) DEFAULT 'Asia/Muscat',
  language VARCHAR(5) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'trial', -- trial, active, suspended, cancelled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**org_tenant_settings**:

```sql
CREATE TABLE org_tenant_settings (
  tenant_org_id UUID PRIMARY KEY,
  branding JSONB DEFAULT '{}'::jsonb, -- logo_url, primary_color, etc.
  features JSONB DEFAULT '{}'::jsonb, -- feature flags
  workflow JSONB DEFAULT '{}'::jsonb, -- workflow config
  notifications JSONB DEFAULT '{}'::jsonb, -- notification prefs
  business_hours JSONB DEFAULT '{}'::jsonb, -- opening hours
  holidays JSONB DEFAULT '[]'::jsonb, -- holiday dates
  invoice_settings JSONB DEFAULT '{}'::jsonb, -- invoice templates, etc.
  metadata JSONB DEFAULT '{}'::jsonb, -- extensible
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

**org_subscriptions** (existing):

```sql
CREATE TABLE org_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  plan VARCHAR(20) DEFAULT 'free',
  status VARCHAR(20) DEFAULT 'trial',
  orders_limit INTEGER DEFAULT 100,
  orders_used INTEGER DEFAULT 0,
  branch_limit INTEGER DEFAULT 1,
  user_limit INTEGER DEFAULT 2,
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL,
  trial_ends TIMESTAMP,
  last_payment_date TIMESTAMP,
  last_payment_amount NUMERIC(10,2),
  FOREIGN KEY (tenant_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

**org_usage_tracking**:

```sql
CREATE TABLE org_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  metric VARCHAR(50) NOT NULL, -- orders_created, storage_used, api_calls
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  period VARCHAR(20) NOT NULL, -- daily, monthly
  metadata JSONB DEFAULT '{}'::jsonb,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_tenant_metric ON org_usage_tracking(tenant_org_id, metric, recorded_at DESC);
```

### Tenant Provisioning Flow

```typescript
async function provisionTenant(data: {
  name: string;
  slug: string;
  email: string;
  phone: string;
  country: string;
  adminUser: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  };
}): Promise<Tenant> {
  // 1. Validate slug availability
  const existingSlug = await db.query(
    "SELECT id FROM org_tenants_mst WHERE slug = $1",
    [data.slug]
  );
  if (existingSlug.rows.length > 0) {
    throw new Error("Slug already taken");
  }

  // 2. Create tenant
  const tenant = await db.query(
    `
    INSERT INTO org_tenants_mst (name, slug, email, phone, country)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
    [data.name, data.slug, data.email, data.phone, data.country]
  );

  const tenantId = tenant.rows[0].id;

  // 3. Create subscription
  await db.query(
    `
    INSERT INTO org_subscriptions (tenant_id, plan, status, trial_ends)
    VALUES ($1, 'free', 'trial', NOW() + INTERVAL '30 days')
  `,
    [tenantId]
  );

  // 4. Create default branch
  await db.query(
    `
    INSERT INTO org_branches_mst (tenant_org_id, branch_name, phone, email)
    VALUES ($1, 'Main Branch', $2, $3)
  `,
    [tenantId, data.phone, data.email]
  );

  // 5. Initialize tenant settings
  await db.query(
    `
    INSERT INTO org_tenant_settings (tenant_org_id)
    VALUES ($1)
  `,
    [tenantId]
  );

  // 6. Enable default service categories
  const defaultCategories = ["laundry", "dry_clean", "iron"];
  for (const category of defaultCategories) {
    await db.query(
      `
      INSERT INTO org_service_category_cf (tenant_org_id, service_category_code)
      VALUES ($1, $2)
    `,
      [tenantId, category]
    );
  }

  // 7. Create admin user in Supabase Auth
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email: data.adminUser.email,
    password: data.adminUser.password,
    email_confirm: false,
    user_metadata: {
      tenant_id: tenantId,
      role: "tenant_admin",
    },
  });

  if (error) throw error;

  // 8. Create user record
  await db.query(
    `
    INSERT INTO org_users_mst (
      tenant_org_id, auth_user_id, email, first_name, last_name, role
    )
    VALUES ($1, $2, $3, $4, $5, 'tenant_admin')
  `,
    [
      tenantId,
      authUser.user.id,
      data.adminUser.email,
      data.adminUser.first_name,
      data.adminUser.last_name,
    ]
  );

  // 9. Send welcome email
  await sendWelcomeEmail(data.adminUser.email, {
    tenantName: data.name,
    slug: data.slug,
    adminEmail: data.adminUser.email,
  });

  return tenant.rows[0];
}
```

### Tenant Context Middleware

**Next.js Middleware**:

```typescript
// web-admin/middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Extract tenant slug from URL
  const hostname = req.headers.get("host") || "";
  let tenantSlug: string | null = null;

  // Option 1: Subdomain (demo-laundry.cleanmatex.com)
  if (hostname.includes(".cleanmatex.com")) {
    tenantSlug = hostname.split(".")[0];
  }

  // Option 2: Path (/app/demo-laundry/...)
  const pathMatch = req.nextUrl.pathname.match(/^\/app\/([^\/]+)/);
  if (pathMatch) {
    tenantSlug = pathMatch[1];
  }

  if (!tenantSlug) {
    return NextResponse.redirect(new URL("/select-tenant", req.url));
  }

  // Validate tenant exists and is active
  const { data: tenant, error } = await supabase
    .from("org_tenants_mst")
    .select("id, slug, is_active, status")
    .eq("slug", tenantSlug)
    .single();

  if (error || !tenant) {
    return NextResponse.redirect(new URL("/tenant-not-found", req.url));
  }

  if (!tenant.is_active || tenant.status === "suspended") {
    return NextResponse.redirect(new URL("/tenant-suspended", req.url));
  }

  // Add tenant to headers for app to read
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  requestHeaders.set("x-tenant-slug", tenant.slug);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/app/:path*", "/((?!api|_next|static|public).*)"],
};
```

**NestJS Guard**:

```typescript
// cmx-api/src/common/guards/tenant.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract tenant slug from header or subdomain
    const tenantSlug =
      request.headers["x-tenant-slug"] ||
      this.extractSlugFromHost(request.headers.host);

    if (!tenantSlug) {
      throw new ForbiddenException("Tenant not specified");
    }

    // Validate tenant
    const tenant = await this.prisma.org_tenants_mst.findUnique({
      where: { slug: tenantSlug },
      include: { subscriptions: true },
    });

    if (!tenant || !tenant.is_active) {
      throw new ForbiddenException("Invalid or inactive tenant");
    }

    // Add tenant to request context
    request.tenant = tenant;
    request.tenantId = tenant.id;

    // Validate JWT tenant_id matches (if authenticated)
    if (request.user && request.user.tenant_id !== tenant.id) {
      throw new ForbiddenException("User not authorized for this tenant");
    }

    return true;
  }

  private extractSlugFromHost(host: string): string | null {
    if (host.includes(".cleanmatex.com")) {
      return host.split(".")[0];
    }
    return null;
  }
}
```

### Usage Limit Enforcement

```typescript
async function checkOrderLimit(tenantId: string): Promise<void> {
  const subscription = await db.query(
    `
    SELECT orders_limit, orders_used, status
    FROM org_subscriptions
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [tenantId]
  );

  const sub = subscription.rows[0];

  if (sub.status !== "active" && sub.status !== "trial") {
    throw new Error("Subscription not active");
  }

  if (sub.orders_used >= sub.orders_limit) {
    throw new Error("Order limit reached. Please upgrade your plan.");
  }

  // Soft limit warning at 80%
  if (sub.orders_used >= sub.orders_limit * 0.8) {
    await sendLimitWarningEmail(tenantId, {
      used: sub.orders_used,
      limit: sub.orders_limit,
    });
  }
}

async function incrementOrderUsage(tenantId: string): Promise<void> {
  await db.query(
    `
    UPDATE org_subscriptions
    SET orders_used = orders_used + 1
    WHERE tenant_id = $1
  `,
    [tenantId]
  );
}
```

---

## 4. Implementation Plan

### Phase 1: Database Schema (2 days)

- Create org_tenant_settings table
- Create org_usage_tracking table
- Add RLS policies
- Create indexes

### Phase 2: Tenant Provisioning (3 days)

- Implement provisioning function
- Create onboarding API
- Test complete provisioning flow
- Add error handling and rollback

### Phase 3: Tenant Context Middleware (2 days)

- Implement Next.js middleware
- Implement NestJS guard
- Test slug resolution
- Test tenant validation

### Phase 4: Usage Tracking (2 days)

- Implement usage increment hooks
- Create usage dashboard
- Implement limit warnings
- Test limit enforcement

### Phase 5: Tenant Settings Management (2 days)

- Create settings CRUD APIs
- Build settings UI
- Test feature flags
- Document configuration options

---

## 5. Success Metrics

| Metric            | Target            |
| ----------------- | ----------------- |
| Provisioning Time | < 30 seconds      |
| Tenant Resolution | < 5ms             |
| Data Isolation    | 100% (zero leaks) |
| Limit Enforcement | 100% accuracy     |

---

## 6. Acceptance Checklist

- [ ] Tenant provisioning automated
- [ ] Slug routing working
- [ ] Tenant context in all requests
- [ ] RLS enforcing isolation
- [ ] Usage limits enforced
- [ ] Settings per tenant
- [ ] No cross-tenant data access
- [ ] Tests passing

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09
