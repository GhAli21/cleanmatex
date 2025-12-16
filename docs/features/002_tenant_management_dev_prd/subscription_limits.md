> Combined from `@.claude/docs/subscription_limits.md` and `@.claude/docs/06-subscription.md` on 2025-10-17

# Plans, Subscriptions, and Limits

| Plan | Orders/Month | Branches | Users | Price |
|------|--------------|----------|-------|-------|
| FREE | 50 | 1 | 2 | OMR 0 |
| STARTER | 200 | 2 | 5 | OMR 29 |
| GROWTH | 1,000 | 5 | 15 | OMR 79 |
| PRO | 5,000 | 10 | 50 | OMR 199 |
| ENTERPRISE | Unlimited | Unlimited | Unlimited | Custom |

**Enforcement**
Check usage before operations and increment via a stored function/RPC.


---

## 📊 SUBSCRIPTION & LIMITS

### Plan Tiers

Tracked in `org_subscriptions_mst` table:

| Plan | Orders/Month | Branches | Users | Price (OMR) |
|------|-------------|----------|-------|-------------|
| **FREE** | 50 | 1 | 2 | 0 |
| **STARTER** | 200 | 2 | 5 | 29 |
| **GROWTH** | 1,000 | 5 | 15 | 79 |
| **PRO** | 5,000 | 10 | 50 | 199 |
| **ENTERPRISE** | Unlimited | Unlimited | Unlimited | Custom |

---

## Database Schema

```sql
CREATE TABLE org_subscriptions_mst(
  tenant_org_id UUID PRIMARY KEY REFERENCES org_tenants_mst(id),
  plan_id VARCHAR(20) DEFAULT 'FREE',
  
  -- Limits
  orders_limit INTEGER DEFAULT 50,
  orders_used INTEGER DEFAULT 0,
  branches_limit INTEGER DEFAULT 1,
  users_limit INTEGER DEFAULT 2,
  
  -- Billing
  price_per_month DECIMAL(10,2) DEFAULT 0,
  billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',
  
  -- Dates
  trial_ends_at TIMESTAMP,
  subscription_ends_at TIMESTAMP,
  next_billing_date DATE,
  
  -- Status
  is_trial_active BOOLEAN DEFAULT true,
  payment_status VARCHAR(30) DEFAULT 'TRIAL',
  is_active BOOLEAN DEFAULT true,
  
  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

---

## Limits Enforcement

### Check Before Operations
```typescript
async function checkOrderLimit(tenantId: string): Promise<boolean> {
  const { data: subscription, error } = await supabase
    .from('org_subscriptions_mst')
    .select('orders_limit, orders_used')
    .eq('tenant_org_id', tenantId)
    .single();
  
  if (error) {
    throw new Error('Failed to check subscription');
  }
  
  if (subscription.orders_used >= subscription.orders_limit) {
    throw new LimitExceededError(
      `Order limit reached (${subscription.orders_used}/${subscription.orders_limit}). 
      Please upgrade your plan.`
    );
  }
  
  return true;
}

async function incrementUsage(tenantId: string): Promise<void> {
  await supabase.rpc('increment_orders_used', { 
    tenant_id: tenantId 
  });
}
```

### Database Function for Usage Tracking
```sql
CREATE OR REPLACE FUNCTION increment_orders_used(tenant_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE org_subscriptions_mst
  SET 
    orders_used = orders_used + 1,
    updated_at = NOW()
  WHERE tenant_org_id = tenant_id;
END;
$$ LANGUAGE plpgsql;

-- Reset monthly usage (run via cron job)
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE org_subscriptions_mst
  SET 
    orders_used = 0,
    updated_at = NOW()
  WHERE DATE_TRUNC('month', CURRENT_DATE) != DATE_TRUNC('month', updated_at);
END;
$$ LANGUAGE plpgsql;
```

---

## Feature Flags by Plan

```typescript
interface PlanFeatures {
  FREE: {
    orders: true,
    customers: true,
    basicReports: true,
    advancedReports: false,
    apiAccess: false,
    whatsappIntegration: false,
    multiplePaymentGateways: false,
    customBranding: false
  },
  STARTER: {
    // All FREE features plus:
    advancedReports: true,
    whatsappIntegration: true
  },
  GROWTH: {
    // All STARTER features plus:
    apiAccess: true,
    multiplePaymentGateways: true
  },
  PRO: {
    // All GROWTH features plus:
    customBranding: true,
    prioritySupport: true
  },
  ENTERPRISE: {
    // Everything unlimited
    all: true
  }
}
```

---

## Trial & Payment Tracking

### Trial Period Management
```typescript
const TRIAL_DAYS = 14;

async function startTrial(tenantId: string): Promise<void> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
  
  await supabase
    .from('org_subscriptions_mst')
    .update({
      is_trial_active: true,
      trial_ends_at: trialEndsAt.toISOString(),
      payment_status: 'TRIAL'
    })
    .eq('tenant_org_id', tenantId);
}

async function checkTrialStatus(tenantId: string): Promise<{
  isActive: boolean;
  daysRemaining: number;
}> {
  const { data } = await supabase
    .from('org_subscriptions_mst')
    .select('trial_ends_at, is_trial_active')
    .eq('tenant_org_id', tenantId)
    .single();
  
  const now = new Date();
  const trialEnd = new Date(data.trial_ends_at);
  const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  
  return {
    isActive: data.is_trial_active && daysRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining)
  };
}
```

---

## Upgrade/Downgrade Logic

```typescript
async function changePlan(
  tenantId: string, 
  newPlan: string
): Promise<void> {
  const plans = {
    FREE: { orders: 50, branches: 1, users: 2, price: 0 },
    STARTER: { orders: 200, branches: 2, users: 5, price: 29 },
    GROWTH: { orders: 1000, branches: 5, users: 15, price: 79 },
    PRO: { orders: 5000, branches: 10, users: 50, price: 199 }
  };
  
  const plan = plans[newPlan];
  
  await supabase
    .from('org_subscriptions_mst')
    .update({
      plan_id: newPlan,
      orders_limit: plan.orders,
      branches_limit: plan.branches,
      users_limit: plan.users,
      price_per_month: plan.price,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_org_id', tenantId);
  
  // Handle pro-rata billing
  await calculateProRataBilling(tenantId, newPlan);
}
```

---

## Return to [Main Documentation](../CLAUDE.md)
