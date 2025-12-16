# PRD-002 Developer Guide: Using Tenant & Subscription Services

**Quick Reference Guide for CleanMateX Developers**

---

## 🚀 Quick Start

### 1. Register a New Tenant

```typescript
import { registerTenant } from '@/lib/services/tenants.service';

const response = await registerTenant({
  businessName: 'Fresh Clean Laundry',
  businessNameAr: 'مغسلة فريش كلين',
  slug: 'fresh-clean',
  email: 'admin@freshclean.com',
  phone: '+96890123456',
  country: 'OM',
  currency: 'OMR',
  timezone: 'Asia/Muscat',
  language: 'en',
  adminUser: {
    email: 'admin@freshclean.com',
    password: 'SecurePassword123!',
    displayName: 'John Admin',
  },
});

// Returns:
// {
//   tenant: { id, name, slug, ... },
//   subscription: { plan: 'free', trial_ends: '...', ... },
//   user: { id, email, role: 'admin' },
//   accessToken: 'eyJhbGc...'
// }
```

### 2. Get Current Tenant

```typescript
import { getCurrentTenant } from '@/lib/services/tenants.service';

const tenant = await getCurrentTenant();
console.log(tenant.name); // 'Fresh Clean Laundry'
console.log(tenant.feature_flags.pdf_invoices); // false (free plan)
```

### 3. Update Tenant Profile

```typescript
import { updateTenant } from '@/lib/services/tenants.service';

await updateTenant(tenantId, {
  brand_color_primary: '#FF6B6B',
  brand_color_secondary: '#4ECDC4',
  business_hours: {
    mon: { open: '07:00', close: '20:00' },
    tue: { open: '07:00', close: '20:00' },
    // ...
  },
});
```

### 4. Upload Tenant Logo

```typescript
import { uploadLogo } from '@/lib/services/tenants.service';

// From a file input
const file = event.target.files[0];
const logoUrl = await uploadLogo(tenantId, file);
// Returns: 'https://storage.cleanmatex.com/tenants/{id}/logo-123.png'
```

---

## 📊 Subscription Management

### 1. Get Available Plans

```typescript
import { getAvailablePlans } from '@/lib/services/subscriptions.service';

const plans = await getAvailablePlans('free'); // Pass current plan
// Returns array of plans with isCurrentPlan and isRecommended flags
```

### 2. Upgrade Subscription

```typescript
import { upgradeSubscription } from '@/lib/services/subscriptions.service';

const updatedSubscription = await upgradeSubscription(tenantId, {
  planCode: 'starter',
  billingCycle: 'monthly',
  paymentMethodId: 'pm_xxx', // From payment gateway
});

// Automatically updates:
// - Subscription limits
// - Feature flags
// - Calculates prorated amount
```

### 3. Cancel Subscription

```typescript
import { cancelSubscription } from '@/lib/services/subscriptions.service';

await cancelSubscription(tenantId, {
  reason: 'Too expensive',
  feedback: 'Would like a plan between Starter and Growth',
});
// Marks as 'canceling', downgrades at end of billing period
```

### 4. Get Current Subscription

```typescript
import { getCurrentSubscription } from '@/lib/services/subscriptions.service';

const subscription = await getCurrentSubscription();
console.log(subscription.orders_limit); // 20
console.log(subscription.orders_used); // 5
console.log(subscription.trial_ends); // '2025-11-01T23:59:59Z'
```

---

## 📈 Usage Tracking

### 1. Get Usage Metrics

```typescript
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';

const metrics = await getUsageMetrics(tenantId);

console.log(metrics.usage.ordersCount); // 15
console.log(metrics.usage.ordersPercentage); // 75%
console.log(metrics.warnings); // Array of warnings if approaching limits
```

### 2. Check if Can Create Order

```typescript
import { canCreateOrder } from '@/lib/services/usage-tracking.service';

const result = await canCreateOrder(tenantId);

if (!result.canProceed) {
  alert(result.message);
  // Show upgrade modal
} else {
  // Proceed with order creation
}
```

### 3. Increment Order Count (After Creation)

```typescript
import { incrementOrderCount } from '@/lib/services/usage-tracking.service';

// After successfully creating an order
await createOrder(orderData);
await incrementOrderCount(tenantId); // Updates usage
```

---

## 🎛️ Feature Flags

### 1. Check Feature Access

```typescript
import { canAccess } from '@/lib/services/feature-flags.service';

const hasPdfInvoices = await canAccess(tenantId, 'pdf_invoices');

if (hasPdfInvoices) {
  // Show PDF download button
} else {
  // Show upgrade prompt
}
```

### 2. Require Feature (Throws Error if Not Enabled)

```typescript
import { requireFeature } from '@/lib/services/feature-flags.service';

try {
  await requireFeature(tenantId, 'pdf_invoices');
  // Generate PDF...
} catch (error) {
  return NextResponse.json(
    { error: error.message }, // 'Access denied: PDF Invoices feature not enabled'
    { status: 403 }
  );
}
```

### 3. Check Multiple Features

```typescript
import { canAccessMultiple } from '@/lib/services/feature-flags.service';

const features = await canAccessMultiple(tenantId, [
  'pdf_invoices',
  'whatsapp_receipts',
  'driver_app',
]);

console.log(features.pdf_invoices); // false
console.log(features.whatsapp_receipts); // true
console.log(features.driver_app); // false
```

### 4. Compare Features Between Plans

```typescript
import { compareFeatures } from '@/lib/services/feature-flags.service';

const comparison = await compareFeatures('free', 'starter');

console.log(comparison.gained); // ['pdf_invoices', 'in_app_receipts', 'loyalty_programs']
console.log(comparison.lost); // []
console.log(comparison.unchanged); // ['whatsapp_receipts', ...]
```

---

## 🛡️ Using Middleware in API Routes

### Method 1: Higher-Order Function

```typescript
// app/api/v1/orders/route.ts
import { withLimitCheck } from '@/lib/middleware/plan-limits.middleware';
import { incrementOrderCount } from '@/lib/services/usage-tracking.service';

export const POST = withLimitCheck('order', async (request, { tenantId }) => {
  const orderData = await request.json();

  // Create order
  const order = await createOrder(tenantId, orderData);

  // Increment usage
  await incrementOrderCount(tenantId);

  return NextResponse.json({ order }, { status: 201 });
});
```

### Method 2: Manual Check

```typescript
// app/api/v1/orders/route.ts
import { checkOrderLimit } from '@/lib/middleware/plan-limits.middleware';

export async function POST(request: NextRequest) {
  const tenantId = await getTenantIdFromRequest(request);

  // Check limit
  const limitResponse = await checkOrderLimit(request, tenantId);
  if (limitResponse) {
    return limitResponse; // Returns 402 Payment Required
  }

  // Proceed with order creation
  // ...
}
```

---

## 🔄 Background Jobs

### 1. Daily Usage Calculation

```typescript
// app/api/cron/daily-usage/route.ts
import { calculateDailyUsage } from '@/lib/services/usage-tracking.service';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await calculateDailyUsage();

  return NextResponse.json({ success: true });
}
```

**Schedule**: Run daily at midnight (use Vercel Cron or GitHub Actions)

### 2. Trial Expiration Processing

```typescript
// app/api/cron/process-trials/route.ts
import { processTrialExpirations } from '@/lib/services/subscriptions.service';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await processTrialExpirations();

  return NextResponse.json({ success: true });
}
```

**Schedule**: Run hourly

### 3. Subscription Renewals

```typescript
// app/api/cron/process-renewals/route.ts
import { processSubscriptionRenewals } from '@/lib/services/subscriptions.service';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await processSubscriptionRenewals();

  return NextResponse.json({ success: true });
}
```

**Schedule**: Run hourly

---

## 🧪 Testing Examples

### Test Tenant Registration

```typescript
describe('Tenant Registration', () => {
  it('should register a new tenant with trial subscription', async () => {
    const response = await registerTenant({
      businessName: 'Test Laundry',
      slug: 'test-laundry',
      email: 'test@example.com',
      phone: '+96890000000',
      country: 'OM',
      currency: 'OMR',
      timezone: 'Asia/Muscat',
      language: 'en',
      adminUser: {
        email: 'admin@example.com',
        password: 'Test123!',
        displayName: 'Test Admin',
      },
    });

    expect(response.tenant.slug).toBe('test-laundry');
    expect(response.subscription.plan).toBe('free');
    expect(response.subscription.status).toBe('trial');
    expect(response.accessToken).toBeDefined();
  });

  it('should reject duplicate slug', async () => {
    await expect(
      registerTenant({
        /* same slug as above */
      })
    ).rejects.toThrow('Slug "test-laundry" is already taken');
  });
});
```

### Test Limit Enforcement

```typescript
describe('Plan Limits', () => {
  it('should block order creation when limit exceeded', async () => {
    // Create 20 orders (free plan limit)
    for (let i = 0; i < 20; i++) {
      await createOrder(tenantId, mockOrderData);
      await incrementOrderCount(tenantId);
    }

    // Try to create 21st order
    const result = await canCreateOrder(tenantId);
    expect(result.canProceed).toBe(false);
    expect(result.message).toContain('Order limit reached');
  });
});
```

---

## 🔍 Common Patterns

### Pattern: Get Tenant ID from Session

```typescript
import { createClient } from '@/lib/supabase/server';

async function getTenantIdFromSession(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.user_metadata?.tenant_org_id) {
    throw new Error('No authenticated user or missing tenant context');
  }

  return user.user_metadata.tenant_org_id;
}
```

### Pattern: Show Feature-Gated UI

```tsx
import { currentTenantCan } from '@/lib/services/feature-flags.service';

export default async function OrderDetailsPage() {
  const canGeneratePdf = await currentTenantCan('pdf_invoices');

  return (
    <div>
      <h1>Order Details</h1>
      {canGeneratePdf ? (
        <button>Download PDF Invoice</button>
      ) : (
        <UpgradePrompt feature="pdf_invoices" />
      )}
    </div>
  );
}
```

### Pattern: Usage Warning Component

```tsx
import { getUsageMetrics } from '@/lib/services/usage-tracking.service';

export default async function UsageWarnings({ tenantId }: { tenantId: string }) {
  const metrics = await getUsageMetrics(tenantId);

  if (metrics.warnings.length === 0) {
    return null;
  }

  return (
    <div className="warnings">
      {metrics.warnings.map((warning, i) => (
        <div key={i} className={`warning ${warning.type}`}>
          {warning.message}
        </div>
      ))}
    </div>
  );
}
```

---

## 📚 Additional Resources

- [PRD-002 Specification](../plan/002_tenant_management_dev_prd.md)
- [Implementation Summary](./PRD-002-Implementation-Summary.md)
- [Database Schema](../../supabase/migrations/0008_tenant_enhancements.sql)
- [Multi-tenancy Docs](../.claude/docs/multitenancy.md)
- [Subscription Limits Docs](../.claude/docs/subscription_limits.md)

---

**Need Help?**
- Check the implementation summary for detailed technical info
- Review the service source code for JSDoc comments
- Consult the PRD for business requirements
