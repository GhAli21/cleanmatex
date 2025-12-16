# PRD-002 Completion Prompt - Remaining 25%

**Context**: PRD-002 (Tenant Onboarding & Management) is 75% complete. Backend services, API routes, UI components, registration flow, and settings interface are all done and working. Only the Subscription Management Page, Usage Widget, and testing remain.

**Copy this entire prompt to Claude to complete PRD-002:**

---

## 🎯 Task: Complete PRD-002 (Tenant Onboarding & Management)

### Current Status
- ✅ Database schema complete (0008_tenant_enhancements.sql applied)
- ✅ Backend services complete (6 services in `web-admin/lib/services/`)
- ✅ API routes complete (7 endpoints in `web-admin/app/api/v1/`)
- ✅ UI components complete (8 components in `web-admin/components/ui/`)
- ✅ Registration flow complete (`/register` and `/register/success`)
- ✅ Settings page complete (`/dashboard/settings` with 4 tabs)
- ✅ Documentation complete (API docs, developer guide, implementation summary)

### Remaining Work (25%)

Complete these 3 tasks in order:

---

## Task 1: Build Subscription Management Page (Priority: High)

### Requirements

**Location**: `web-admin/app/dashboard/subscription/page.tsx`

**Route**: `/dashboard/subscription` (protected)

**Features to Implement**:

1. **Page Header**
   - Title: "Subscription & Billing"
   - Subtitle: "Manage your plan and view usage"
   - Badge showing current plan status (Trial/Active/Canceling)

2. **Current Plan Card**
   - Display current plan name and status
   - Show trial end date if on trial
   - Display next billing date if on paid plan
   - Show monthly/yearly price
   - Visual plan tier badge

3. **Usage Metrics Section**
   - Current period (start/end dates)
   - Progress bars for:
     - Orders (X / limit) with percentage
     - Users (X / limit) with percentage
     - Branches (X / limit) with percentage
     - Storage (X MB / limit MB) with percentage
   - Color-coded warnings (green < 70%, yellow 70-90%, red > 90%)
   - List of warnings if approaching limits

4. **Plan Comparison Table**
   - Display all 5 plans (Free, Starter, Growth, Pro, Enterprise)
   - Columns: Plan Name, Price (Monthly/Yearly toggle), Orders, Users, Branches, Features
   - Highlight current plan
   - Mark "Recommended" plan (Growth)
   - Feature comparison grid showing ✓/✗ for each feature:
     - PDF Invoices
     - WhatsApp Receipts
     - In-App Receipts
     - Printing
     - B2B Contracts
     - White Label
     - Marketplace Listings
     - Loyalty Programs
     - Driver App
     - Multi-Branch
     - Advanced Analytics
     - API Access
   - "Current Plan" badge on active plan
   - "Upgrade" button on higher plans
   - "Downgrade" disabled on lower plans

5. **Upgrade Modal** (when "Upgrade" clicked)
   - Plan name and price
   - Billing cycle selector (Monthly/Yearly radio buttons)
   - Show yearly savings if yearly selected (e.g., "Save 20% with yearly billing")
   - Feature comparison (gained features highlighted in green)
   - Prorated amount display (if mid-cycle)
   - Payment method input (placeholder for now - just show message: "Payment gateway integration coming soon")
   - "Confirm Upgrade" button
   - Cancel button

6. **Cancel Subscription Flow** (if on paid plan)
   - "Cancel Subscription" button at bottom
   - Modal with:
     - Warning message about losing features
     - Cancellation reason dropdown (Too expensive, Missing features, Switching to competitor, Other)
     - Optional feedback textarea
     - Effective date display (end of billing period)
     - "Confirm Cancellation" button (danger variant)
     - "Keep Subscription" button

7. **Trial Countdown Banner** (if on trial)
   - Alert component showing days remaining
   - Call-to-action to upgrade before trial ends
   - Link to plan comparison

### API Integration Points
- GET `/api/v1/subscriptions/plans` - Fetch all plans
- GET `/api/v1/subscriptions/usage` - Fetch usage metrics
- GET `/api/v1/tenants/me` - Get current subscription info
- POST `/api/v1/subscriptions/upgrade` - Upgrade plan
- POST `/api/v1/subscriptions/cancel` - Cancel subscription

### Components to Use
- Use existing UI components from `web-admin/components/ui/`
- Card, Button, Alert, Badge, ProgressBar, Select, Input
- Create reusable sub-components as needed

### State Management
- Use React useState for local form state
- Fetch data on component mount with useEffect
- Loading states during API calls
- Success/error messages with Alert component

### Example Structure
```tsx
'use client';

export default function SubscriptionPage() {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [usage, setUsage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    // Fetch plans, usage, tenant data in parallel
  };

  const handleUpgrade = async () => {
    // Call upgrade API
  };

  const handleCancel = async () => {
    // Call cancel API
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      {/* Current Plan Card */}
      {/* Usage Metrics */}
      {/* Plan Comparison Table */}
      {/* Upgrade Modal */}
      {/* Cancel Modal */}
    </div>
  );
}
```

---

## Task 2: Create Usage Dashboard Widget (Priority: Medium)

### Requirements

**Location**: `web-admin/components/dashboard/UsageWidget.tsx`

**Purpose**: Compact widget for main dashboard showing usage at-a-glance

**Features to Implement**:

1. **Compact Card Layout**
   - Title: "Usage & Limits"
   - Subtitle: Current billing period
   - Link to full subscription page

2. **Metrics Display**
   - Show top 3 resources: Orders, Users, Branches
   - Each with:
     - Label and current/limit (e.g., "Orders: 15 / 20")
     - Mini progress bar
     - Percentage badge

3. **Warning Indicators**
   - Show warning icon if any resource > 80%
   - Count of warnings (e.g., "2 warnings")
   - List warnings in hover tooltip or expandable section

4. **Quick Actions**
   - "Upgrade Plan" button if approaching/exceeding limits
   - "View Details" link to `/dashboard/subscription`

5. **Loading & Error States**
   - Skeleton loader while fetching
   - Error message if API fails

### API Integration
- GET `/api/v1/subscriptions/usage` - Fetch usage data

### Props Interface
```tsx
interface UsageWidgetProps {
  tenantId?: string; // Optional, defaults to current tenant
  compact?: boolean; // If true, show even more compact version
}
```

### Example Structure
```tsx
'use client';

export function UsageWidget({ tenantId, compact = false }: UsageWidgetProps) {
  const [usage, setUsage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  return (
    <Card>
      <CardHeader title="Usage & Limits" />
      {/* Metrics */}
      {/* Warnings */}
      {/* Actions */}
    </Card>
  );
}
```

### Integration Point
- Add to main dashboard page: `web-admin/app/dashboard/page.tsx`
- Place in prominent position (top-right or full-width near top)

---

## Task 3: Write Tests (Priority: High)

### Requirements

**Framework**: Jest for unit/integration, Playwright for E2E

**Location**: Create tests in `web-admin/__tests__/` directory

### 3.1 Unit Tests for Services

**File**: `__tests__/services/tenants.service.test.ts`

Test cases for `tenants.service.ts`:
```typescript
describe('TenantsService', () => {
  describe('generateSlug', () => {
    test('converts business name to slug', () => {
      expect(generateSlug('Fresh Clean Laundry')).toBe('fresh-clean-laundry');
    });
    test('removes special characters', () => {
      expect(generateSlug('ABC@123 Laundry!')).toBe('abc123-laundry');
    });
    test('handles multiple spaces', () => {
      expect(generateSlug('My   Laundry')).toBe('my-laundry');
    });
  });

  describe('validateSlug', () => {
    test('accepts available slug', async () => {
      const result = await validateSlug('available-slug');
      expect(result.isAvailable).toBe(true);
    });
    test('rejects taken slug and suggests alternative', async () => {
      const result = await validateSlug('taken-slug');
      expect(result.isAvailable).toBe(false);
      expect(result.suggestedSlug).toBeDefined();
    });
  });

  describe('registerTenant', () => {
    test('creates tenant with trial subscription', async () => {
      const request = {
        businessName: 'Test Laundry',
        slug: 'test-laundry',
        email: 'test@example.com',
        phone: '+96890123456',
        country: 'OM',
        currency: 'OMR',
        timezone: 'Asia/Muscat',
        language: 'en',
        adminUser: {
          email: 'admin@test.com',
          password: 'Test123!@#',
          displayName: 'Test Admin',
        },
      };
      const response = await registerTenant(request);
      expect(response.tenant.slug).toBe('test-laundry');
      expect(response.subscription.plan).toBe('free');
      expect(response.subscription.status).toBe('trial');
    });
  });
});
```

**File**: `__tests__/services/subscriptions.service.test.ts`

Test cases for `subscriptions.service.ts`:
```typescript
describe('SubscriptionsService', () => {
  describe('getAvailablePlans', () => {
    test('returns all public plans', async () => {
      const plans = await getAvailablePlans();
      expect(plans).toHaveLength(5);
      expect(plans[0].plan_code).toBe('free');
    });
    test('marks current plan correctly', async () => {
      const plans = await getAvailablePlans('starter');
      const starterPlan = plans.find(p => p.plan_code === 'starter');
      expect(starterPlan?.isCurrentPlan).toBe(true);
    });
  });

  describe('upgradeSubscription', () => {
    test('upgrades from free to starter', async () => {
      const result = await upgradeSubscription(tenantId, {
        planCode: 'starter',
        billingCycle: 'monthly',
      });
      expect(result.plan).toBe('starter');
      expect(result.status).toBe('active');
    });
    test('rejects downgrade attempt', async () => {
      await expect(
        upgradeSubscription(tenantId, {
          planCode: 'free',
          billingCycle: 'monthly',
        })
      ).rejects.toThrow('downgrade');
    });
  });

  describe('cancelSubscription', () => {
    test('schedules cancellation at period end', async () => {
      const result = await cancelSubscription(tenantId, {
        reason: 'Too expensive',
      });
      expect(result.status).toBe('canceling');
      expect(result.cancellation_date).toBeDefined();
    });
  });
});
```

**File**: `__tests__/services/usage-tracking.service.test.ts`

Test cases for usage tracking:
```typescript
describe('UsageTrackingService', () => {
  describe('canCreateOrder', () => {
    test('allows order creation within limit', async () => {
      const result = await canCreateOrder(tenantId);
      expect(result.canProceed).toBe(true);
    });
    test('blocks order creation when limit exceeded', async () => {
      // Create orders up to limit
      // ...
      const result = await canCreateOrder(tenantId);
      expect(result.canProceed).toBe(false);
      expect(result.message).toContain('limit reached');
    });
  });

  describe('getUsageMetrics', () => {
    test('returns accurate usage metrics', async () => {
      const metrics = await getUsageMetrics(tenantId);
      expect(metrics.usage.ordersCount).toBeGreaterThanOrEqual(0);
      expect(metrics.usage.ordersPercentage).toBeLessThanOrEqual(100);
    });
    test('generates warnings at 80% threshold', async () => {
      // Setup: Create orders to reach 80%
      const metrics = await getUsageMetrics(tenantId);
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings[0].type).toBe('approaching_limit');
    });
  });
});
```

### 3.2 Integration Tests for API Routes

**File**: `__tests__/api/tenants.test.ts`

```typescript
describe('POST /api/v1/tenants/register', () => {
  test('registers new tenant successfully', async () => {
    const response = await fetch('/api/v1/tenants/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRegistrationData),
    });
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.tenant.slug).toBe('test-laundry');
  });

  test('rejects duplicate slug', async () => {
    await registerTenant(validRegistrationData);
    const response = await fetch('/api/v1/tenants/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRegistrationData),
    });
    expect(response.status).toBe(409);
  });

  test('validates password strength', async () => {
    const weakPassword = { ...validRegistrationData };
    weakPassword.adminUser.password = 'weak';
    const response = await fetch('/api/v1/tenants/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(weakPassword),
    });
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/v1/tenants/me', () => {
  test('updates tenant profile', async () => {
    const response = await fetch('/api/v1/tenants/me', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
      },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.name).toBe('Updated Name');
  });

  test('requires authentication', async () => {
    const response = await fetch('/api/v1/tenants/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    expect(response.status).toBe(401);
  });
});
```

**File**: `__tests__/api/subscriptions.test.ts`

```typescript
describe('POST /api/v1/subscriptions/upgrade', () => {
  test('upgrades subscription successfully', async () => {
    const response = await fetch('/api/v1/subscriptions/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        planCode: 'starter',
        billingCycle: 'monthly',
      }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.subscription.plan).toBe('starter');
  });

  test('enforces limit after upgrade', async () => {
    // Upgrade and verify new limits are applied
  });
});

describe('GET /api/v1/subscriptions/usage', () => {
  test('returns current usage metrics', async () => {
    const response = await fetch('/api/v1/subscriptions/usage', {
      headers: { 'Authorization': `Bearer ${validToken}` },
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.usage.ordersCount).toBeDefined();
  });
});
```

### 3.3 E2E Tests with Playwright

**File**: `e2e/registration.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Tenant Registration Flow', () => {
  test('complete registration journey', async ({ page }) => {
    await page.goto('/register');

    // Step 1: Business Info
    await page.fill('[name="businessName"]', 'E2E Test Laundry');
    await page.fill('[name="email"]', 'e2e@test.com');
    await page.fill('[name="phone"]', '+96890000000');
    await page.click('button:has-text("Next")');

    // Step 2: Preferences
    await page.selectOption('[name="country"]', 'OM');
    await page.selectOption('[name="currency"]', 'OMR');
    await page.click('button:has-text("Next")');

    // Step 3: Admin Account
    await page.fill('[name="adminEmail"]', 'admin@e2e.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.fill('[name="displayName"]', 'E2E Admin');
    await page.click('button:has-text("Create Account")');

    // Verify success page
    await expect(page).toHaveURL('/register/success');
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('validates required fields', async ({ page }) => {
    await page.goto('/register');
    await page.click('button:has-text("Next")');
    await expect(page.locator('.text-red-600')).toBeVisible();
  });

  test('checks slug availability', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[name="businessName"]', 'Test Laundry');
    await page.blur('[name="slug"]');
    // Wait for validation icon
    await expect(page.locator('span:has-text("✓")')).toBeVisible();
  });
});
```

**File**: `e2e/settings.spec.ts`

```typescript
test.describe('Settings Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
  });

  test('updates general settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.fill('[name="name"]', 'Updated Business Name');
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('.bg-green-50')).toContainText('updated successfully');
  });

  test('uploads logo', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.click('button:has-text("Branding")');
    await page.setInputFiles('input[type="file"]', 'test-fixtures/logo.png');
    await page.click('button:has-text("Upload")');
    await expect(page.locator('img[alt="Logo preview"]')).toBeVisible();
  });

  test('updates business hours', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.click('button:has-text("Business Hours")');
    await page.fill('input[type="time"]', '07:00');
    await page.click('button:has-text("Save Hours")');
    await expect(page.locator('.bg-green-50')).toBeVisible();
  });
});
```

### 3.4 Test Configuration

**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

**File**: `playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## Task Completion Checklist

When all tasks are complete, verify:

### Functionality Checklist
- [ ] Subscription page loads without errors
- [ ] Plan comparison table displays all 5 plans correctly
- [ ] Current plan is highlighted
- [ ] Usage metrics show correct data
- [ ] Progress bars display accurate percentages
- [ ] Upgrade modal opens and closes properly
- [ ] Cancel modal opens and closes properly
- [ ] Billing cycle toggle works (monthly/yearly)
- [ ] API calls succeed and update UI
- [ ] Error handling works (network failures, validation errors)
- [ ] Loading states display during API calls
- [ ] Success messages appear after actions
- [ ] Usage widget renders on dashboard
- [ ] Widget shows top 3 metrics
- [ ] Warning indicators appear when limits approached
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Test coverage meets 70% threshold

### Code Quality Checklist
- [ ] TypeScript strict mode (no `any` types)
- [ ] All components have proper props interfaces
- [ ] Error boundaries implemented
- [ ] Loading states for async operations
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Code follows existing patterns and conventions
- [ ] No console.log statements in production code
- [ ] Comments added for complex logic

### Documentation Checklist
- [ ] Update PRD-002-Implementation-Summary.md to 100%
- [ ] Add testing documentation
- [ ] Document any new environment variables
- [ ] Update API documentation if needed

---

## Success Criteria

PRD-002 is 100% complete when:

1. ✅ Users can view all subscription plans
2. ✅ Users can upgrade their plan (with payment placeholder)
3. ✅ Users can cancel their subscription
4. ✅ Usage metrics display accurately with warnings
5. ✅ Dashboard shows usage widget
6. ✅ All tests pass with >70% coverage
7. ✅ No TypeScript errors
8. ✅ No runtime errors in console
9. ✅ Responsive on all screen sizes
10. ✅ Documentation updated

---

## Notes for Implementation

### Existing Files to Reference
- Backend services: `web-admin/lib/services/*.service.ts`
- API routes: `web-admin/app/api/v1/**/*.ts`
- UI components: `web-admin/components/ui/*.tsx`
- Settings page example: `web-admin/app/dashboard/settings/page.tsx`
- Type definitions: `web-admin/lib/types/tenant.ts`

### API Response Examples
Check `docs/api/PRD-002-API-Endpoints.md` for complete API documentation with request/response examples.

### Design Consistency
- Use existing UI components from `components/ui/`
- Follow Tailwind CSS conventions already established
- Match the look and feel of Settings page
- Use same color scheme (blue-600 primary, gray for neutral)

### Performance Considerations
- Fetch data in parallel where possible
- Cache plan data (rarely changes)
- Debounce user inputs
- Show loading skeletons for better UX

### Error Handling
- Network errors: Show retry button
- Validation errors: Highlight fields with messages
- Server errors: Show user-friendly message + error code
- Fallback to cached data if API fails

---

## Estimated Time

- **Subscription Page**: 4-6 hours
- **Usage Widget**: 2-3 hours
- **Testing**: 4-5 hours
- **Total**: 10-14 hours (1-2 days)

---

## Final Deliverables

When complete, you should have:

1. **New Files Created**:
   - `web-admin/app/dashboard/subscription/page.tsx`
   - `web-admin/components/dashboard/UsageWidget.tsx`
   - `web-admin/__tests__/services/*.test.ts`
   - `web-admin/__tests__/api/*.test.ts`
   - `web-admin/e2e/*.spec.ts`
   - `jest.config.js`
   - `playwright.config.ts`

2. **Updated Files**:
   - `web-admin/app/dashboard/page.tsx` (add UsageWidget)
   - `docs/dev/PRD-002-Implementation-Summary.md` (update to 100%)
   - `package.json` (add test scripts if missing)

3. **Test Results**:
   - All tests passing
   - Coverage report showing >70%
   - Screenshots of E2E tests passing

4. **Documentation**:
   - Updated implementation summary
   - Testing guide
   - Any troubleshooting notes

---

**START HERE**: Begin with Task 1 (Subscription Page), then Task 2 (Usage Widget), then Task 3 (Testing). Use the existing codebase as reference and maintain consistency with established patterns.

Good luck! 🚀
