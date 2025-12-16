# Dashboard Feature - Continuation Guide

**Purpose**: Complete guide for continuing dashboard development from current state
**Last Session**: 2025-10-24
**Current Status**: Phase 3 - 30% Complete (Widget Framework Ready)
**Next Developer**: Read this first before continuing

---

## 📍 Current State Summary

### ✅ What's Been Completed

#### Phase 1: Navigation & Layout (100% ✅)
- ✅ Responsive sidebar with role-based filtering
- ✅ TopBar with search, notifications, tenant switcher
- ✅ Navigation configuration system (11 menu sections)
- ✅ Mobile-responsive (collapsible on <1024px)
- ✅ Active route highlighting
- ✅ Keyboard navigation ready

#### Phase 2: RBAC System (100% ✅)
- ✅ Role context provider with hooks
- ✅ `RequireRole` and `RequireFeature` guard components
- ✅ Route protection middleware
- ✅ Multi-layer security (UI + Middleware + RLS)
- ✅ Role hierarchy: admin > staff > driver

#### Phase 3: Widget Framework (30% ✅)
- ✅ Widget framework with loading/error states
- ✅ Dashboard service with caching
- ✅ 3 KPI widgets implemented:
  - OrdersTodayWidget
  - OrderStatusWidget
  - RevenueWidget

### 📂 Files Created (17 total)

#### Navigation & Layout
1. `config/navigation.ts` - Menu configuration
2. `app/dashboard/layout.tsx` - Dashboard layout wrapper
3. `components/layout/Sidebar.tsx` - Sidebar navigation
4. `components/layout/TopBar.tsx` - Top bar

#### RBAC System
5. `lib/auth/role-context.tsx` - RBAC context & hooks
6. `components/auth/RequireRole.tsx` - Role guards
7. `components/auth/RequireFeature.tsx` - Feature guards
8. `components/providers/AppProviders.tsx` - Provider wrapper

#### Widget System
9. `components/dashboard/Widget.tsx` - Widget framework
10. `lib/services/dashboard.service.ts` - Data service
11. `components/dashboard/widgets/OrdersTodayWidget.tsx`
12. `components/dashboard/widgets/OrderStatusWidget.tsx`
13. `components/dashboard/widgets/RevenueWidget.tsx`

#### Documentation
14. `docs/dev/DASHBOARD_PHASE1_PHASE2_COMPLETE.md`
15. `docs/dev/RBAC_QUICK_REFERENCE.md`
16. `docs/dev/DASHBOARD_WIDGETS_PROGRESS.md`
17. `docs/dev/DASHBOARD_CONTINUATION_GUIDE.md` (this file)

---

## 🎯 What Needs To Be Done

### Immediate Tasks (Next Session)

#### 1. Manual Widget Integration ⚠️ REQUIRED FIRST
**File**: `components/dashboard/DashboardContent.tsx`

**Problem**: File was locked during last session, widgets not integrated yet.

**Steps**:
```typescript
// 1. Add imports at top
import { OrdersTodayWidget } from '@/components/dashboard/widgets/OrdersTodayWidget'
import { OrderStatusWidget } from '@/components/dashboard/widgets/OrderStatusWidget'
import { RevenueWidget } from '@/components/dashboard/widgets/RevenueWidget'

// 2. Replace the static grid section (lines 26-43) with:
<OrdersTodayWidget />

// 3. Add after welcome section:
<OrderStatusWidget />

// 4. Replace revenue card in grid with:
<div className="lg:col-span-1">
  <RevenueWidget />
</div>
```

**Verification**: Refresh dashboard, should see 3 live widgets pulling real data.

---

### Phase 3 Continuation: Remaining Widgets (7/10)

#### Widget #4: Turnaround Time Widget
**File**: `components/dashboard/widgets/TurnaroundWidget.tsx`

**Requirements**:
- Display average turnaround time (hours)
- Compare against SLA target (e.g., 24 hours)
- Trend indicator (better/worse than last week)
- Clock icon
- Formula: `AVG(delivered_at - created_at) WHERE status = 'DELIVERED'`

**Example Code**:
```typescript
'use client'
import { Clock } from 'lucide-react'
import { StatCard } from '../Widget'
// Calculate average turnaround time from orders
// Display in hours with 1 decimal place
```

---

#### Widget #5: Delivery Rate Widget
**File**: `components/dashboard/widgets/DeliveryRateWidget.tsx`

**Requirements**:
- On-time delivery percentage
- Visual progress bar/circle
- Compare against target (95%)
- CheckCircle icon
- Formula: `(orders delivered on time / total delivered) * 100`

---

#### Widget #6: Issues Widget
**File**: `components/dashboard/widgets/IssuesWidget.tsx`

**Requirements**:
- Count of open issues/complaints
- Issues in last 7 days
- Alert color if > threshold
- AlertCircle icon
- Query: `SELECT COUNT(*) FROM org_order_items_dtl WHERE issues IS NOT NULL`

---

#### Widget #7: Payment Mix Widget
**File**: `components/dashboard/widgets/PaymentMixWidget.tsx`

**Requirements**:
- Cash vs Online percentage split
- Pie chart or dual progress bars
- Total transaction count
- CreditCard icon
- Query payment methods from orders

---

#### Widget #8: Driver Utilization Widget
**File**: `components/dashboard/widgets/DriverUtilizationWidget.tsx`

**Requirements**:
- Percentage of active drivers
- Available vs busy count
- Only show if `driver_app` feature enabled
- Truck icon
- Query driver status

---

#### Widget #9: Top Services Widget
**File**: `components/dashboard/widgets/TopServicesWidget.tsx`

**Requirements**:
- Top 5 services by revenue
- Bar chart or list with amounts
- Percentage of total revenue
- BarChart icon
- Query: Aggregate revenue by service type

---

#### Widget #10: Alerts Widget
**File**: `components/dashboard/widgets/AlertsWidget.tsx`

**Requirements**:
- Critical alerts count
- Types: Low inventory, Failed payments, SLA breaches
- Red badge for critical
- Bell icon
- Clickable to navigate to details

---

### Phase 4: Quick Actions & Filters

#### Quick Actions Component
**File**: `components/dashboard/QuickActions.tsx`

**Requirements**:
- Sticky action bar at top of content
- Buttons: "New Order", "Receive Bag", "Assign Driver", "Cash Up", "Generate Invoice", "Send WhatsApp"
- Role-based visibility
- Feature flag checks (e.g., PDF invoices, printing)

**Example Layout**:
```tsx
<div className="sticky top-16 z-20 bg-white border-b border-gray-200 px-4 py-3 flex gap-2 overflow-x-auto">
  <RequireRole roles={['admin', 'staff']}>
    <button>New Order</button>
    <button>Receive Bag</button>
  </RequireRole>
  <RequireRole roles={['admin']}>
    <button>Assign Driver</button>
  </RequireRole>
  <RequireFeature feature="pdf_invoices">
    <button>Generate Invoice</button>
  </RequireFeature>
</div>
```

---

#### Global Filters Component
**File**: `components/dashboard/GlobalFilters.tsx`

**Requirements**:
- Filter bar controlling all widgets
- Filters:
  - Branch selector (multi-branch support)
  - Date range (Today, 7d, 30d, custom)
  - Order source (POS, Mobile, Marketplace, Internal)
  - Service category dropdown
  - B2C/B2B toggle
- Filters sync to URL query params
- Apply to all widgets via context/state

**State Management**:
```typescript
// Create filter context
interface FilterContext {
  branchId?: string
  dateRange: { from: Date; to: Date }
  orderSource?: string
  serviceCategory?: string
  customerType?: 'B2C' | 'B2B'
}

// Use in widgets
const { filters } = useFilters()
const data = await dashboardService.getKPIOverview(tenantId, filters)
```

---

### Phase 5: Notifications Panel

#### Notifications Panel Component
**File**: `components/layout/NotificationsPanel.tsx`

**Requirements**:
- Right-side drawer (slides in from right)
- Real-time updates via Supabase Realtime
- Notification types:
  - New orders
  - Status changes
  - Failed payments
  - Driver events
  - Low inventory alerts
- Mark as read/unread
- Clear all button
- Group by date

**Supabase Realtime Integration**:
```typescript
useEffect(() => {
  const channel = supabase
    .channel('order-changes')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'org_orders_mst' },
      (payload) => {
        // New order notification
      }
    )
    .subscribe()

  return () => channel.unsubscribe()
}, [])
```

---

### Phase 6: Backend API Endpoints (NestJS)

#### Reports Controller
**File**: `backend/src/reports/reports.controller.ts`

**Endpoints**:
```typescript
GET /api/v1/reports/kpi-overview
  Query params: ?tenantId=&branchId=&from=&to=
  Returns: {
    orders: { today, inProcess, ready, outForDelivery },
    revenue: { today, mtd, last30d, currency },
    sla: { avgTATHours, onTimePct },
    issues: { open, last7d },
    payments: { cashPct, onlinePct },
    drivers: { activePct },
    topServices: [{ name, amount }]
  }

GET /api/v1/reports/orders-trend
  Query params: ?interval=day&from=&to=&branchId=
  Returns: [{ date, count }]

GET /api/v1/reports/revenue-trend
  Query params: ?interval=day&from=&to=&branchId=
  Returns: [{ date, amount }]
```

#### Database Views
**File**: `supabase/migrations/0011_dashboard_views.sql`

**Create materialized views for performance**:
```sql
-- View: Orders by status (refreshed hourly)
CREATE MATERIALIZED VIEW vw_orders_by_status AS
SELECT
  tenant_org_id,
  order_status,
  COUNT(*) as count,
  DATE(created_at) as order_date
FROM org_orders_mst
WHERE is_active = true
GROUP BY tenant_org_id, order_status, DATE(created_at);

-- View: Daily revenue
CREATE MATERIALIZED VIEW vw_revenue_daily AS
SELECT
  tenant_org_id,
  DATE(created_at) as revenue_date,
  SUM(total_amount) as total_revenue,
  COUNT(*) as order_count
FROM org_orders_mst
WHERE is_active = true
GROUP BY tenant_org_id, DATE(created_at);

-- Refresh strategy (cron job)
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY vw_orders_by_status;
  REFRESH MATERIALIZED VIEW CONCURRENTLY vw_revenue_daily;
END;
$$ LANGUAGE plpgsql;
```

---

### Phase 7: Internationalization (i18n)

#### Translation Files
**Files**:
- `messages/dashboard.en.json`
- `messages/dashboard.ar.json`

**Structure**:
```json
{
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back, {{name}}!",
    "widgets": {
      "ordersToday": "Today's Orders",
      "inProcess": "In Process",
      "ready": "Ready",
      "outForDelivery": "Out for Delivery",
      "revenue": "Revenue",
      "today": "Today",
      "mtd": "Month to Date",
      "last30d": "Last 30 Days",
      "turnaroundTime": "Avg Turnaround Time",
      "deliveryRate": "On-Time Delivery",
      "issues": "Issues",
      "paymentMix": "Payment Mix",
      "drivers": "Driver Utilization",
      "topServices": "Top Services",
      "alerts": "Alerts"
    },
    "quickActions": {
      "newOrder": "New Order",
      "receiveBag": "Receive Bag",
      "assignDriver": "Assign Driver",
      "cashUp": "Cash Up",
      "generateInvoice": "Generate Invoice",
      "sendWhatsApp": "Send WhatsApp Update"
    },
    "filters": {
      "branch": "Branch",
      "dateRange": "Date Range",
      "orderSource": "Order Source",
      "serviceCategory": "Service Category",
      "customerType": "Customer Type"
    }
  }
}
```

**Usage in Components**:
```typescript
import { useTranslations } from 'next-intl'

export function MyWidget() {
  const t = useTranslations('dashboard.widgets')
  return <h3>{t('ordersToday')}</h3>
}
```

---

### Phase 8: Testing & Optimization

#### Unit Tests
**File**: `components/dashboard/__tests__/Widget.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { Widget } from '../Widget'

describe('Widget', () => {
  it('renders title correctly', () => {
    render(<Widget title="Test Widget">Content</Widget>)
    expect(screen.getByText('Test Widget')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<Widget title="Test" isLoading>Content</Widget>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<Widget title="Test" error="Failed to load">Content</Widget>)
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })
})
```

#### E2E Tests
**File**: `tests/e2e/dashboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('dashboard loads and displays widgets', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'admin@demo1.com')
  await page.fill('[name="password"]', 'Admin123')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('/dashboard')

  // Check sidebar
  await expect(page.locator('aside')).toBeVisible()
  await expect(page.getByText('Dashboard')).toBeVisible()

  // Check widgets
  await expect(page.getByText("Today's Orders")).toBeVisible()
  await expect(page.getByText('In Process')).toBeVisible()
  await expect(page.getByText('Revenue')).toBeVisible()
})

test('widgets update with real data', async ({ page }) => {
  // ... login ...

  // Wait for data to load
  await page.waitForSelector('[data-testid="orders-today"]')

  // Check data is displayed
  const ordersCount = await page.textContent('[data-testid="orders-count"]')
  expect(parseInt(ordersCount)).toBeGreaterThanOrEqual(0)
})
```

#### Performance Tests
**File**: `tests/performance/dashboard-load.k6.js`

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% under 800ms
  },
}

export default function() {
  const res = http.get('http://localhost:3000/api/v1/reports/kpi-overview')

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  })

  sleep(1)
}
```

---

## 🔧 Development Setup

### Prerequisites
```bash
# Install dependencies
cd web-admin
npm install

# Ensure lucide-react is installed
npm list lucide-react  # Should show version

# Start Supabase
cd ..
supabase start

# Start dev server
cd web-admin
npm run dev
```

### Verify Current State
```bash
# 1. Check files exist
ls components/layout/Sidebar.tsx
ls components/layout/TopBar.tsx
ls components/dashboard/Widget.tsx
ls components/dashboard/widgets/OrdersTodayWidget.tsx

# 2. Test navigation
# Open http://localhost:3000/login
# Login with admin@demo1.com / Admin123
# Should see sidebar + topbar

# 3. Check widgets
# Dashboard should load (might not show widgets yet until manual integration)
```

---

## 📝 Code Patterns & Standards

### Widget Pattern
```typescript
'use client'

import { useEffect, useState } from 'react'
import { Icon } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { dashboardService } from '@/lib/services/dashboard.service'
import { StatCard } from '../Widget'

export function MyWidget() {
  const { currentTenant } = useAuth()
  const [data, setData] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!currentTenant) return

      try {
        setIsLoading(true)
        setError(null)

        const result = await dashboardService.getMyData(currentTenant.tenant_id)
        setData(result)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentTenant])

  if (error) {
    return <div className="text-red-600">{error}</div>
  }

  return (
    <StatCard
      label="My Metric"
      value={data}
      trend={10}
      trendLabel="from yesterday"
      icon={Icon}
      color="blue"
      isLoading={isLoading}
    />
  )
}
```

### Service Method Pattern
```typescript
// In dashboard.service.ts
async getMyData(tenantId: string, options?: FilterOptions): Promise<number> {
  const cacheKey = `my-data-${tenantId}-${JSON.stringify(options)}`
  const cached = cache.get<number>(cacheKey)
  if (cached) return cached

  try {
    const { data, error } = await this.supabase
      .from('my_table')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_org_id', tenantId)

    if (error) throw error

    const count = data?.length || 0
    cache.set(cacheKey, count)
    return count
  } catch (error) {
    console.error('Error:', error)
    throw new Error('Failed to fetch data')
  }
}
```

### RBAC Pattern
```typescript
// For role-based widgets
<RequireRole roles={['admin']}>
  <AdminOnlyWidget />
</RequireRole>

// For feature-based widgets
<RequireFeature feature="advanced_analytics">
  <AnalyticsWidget />
</RequireFeature>

// Programmatic check
const { hasRole } = useRole()
if (hasRole('admin')) {
  // Show admin features
}
```

---

## 🐛 Troubleshooting

### Issue: Widgets not showing
**Check**:
1. Imports added to DashboardContent.tsx?
2. Components rendered in JSX?
3. Console errors?

**Solution**: Verify manual integration step completed.

---

### Issue: "Module not found: lucide-react"
**Solution**:
```bash
cd web-admin
npm install lucide-react
```

---

### Issue: Data not loading
**Check**:
1. Supabase running? (`supabase status`)
2. User logged in?
3. Tenant context available? (console.log currentTenant)

**Solution**: Check browser console for errors, verify auth state.

---

### Issue: TypeScript errors
**Solution**:
```bash
# Regenerate types from database
supabase gen types typescript --local > types/database.ts

# Restart TS server in VSCode
Cmd+Shift+P > "TypeScript: Restart TS Server"
```

---

## 📊 Progress Tracking

### Completion Checklist

#### Phase 3: Widgets
- [x] Widget framework
- [x] Dashboard service
- [x] OrdersTodayWidget
- [x] OrderStatusWidget
- [x] RevenueWidget
- [ ] TurnaroundWidget
- [ ] DeliveryRateWidget
- [ ] IssuesWidget
- [ ] PaymentMixWidget
- [ ] DriverUtilizationWidget
- [ ] TopServicesWidget
- [ ] AlertsWidget

#### Phase 4: Actions & Filters
- [ ] QuickActions component
- [ ] GlobalFilters component
- [ ] Filter context/state
- [ ] URL sync for filters

#### Phase 5: Notifications
- [ ] NotificationsPanel component
- [ ] Supabase Realtime integration
- [ ] Notification types
- [ ] Mark as read
- [ ] Clear all

#### Phase 6: Backend
- [ ] NestJS Reports controller
- [ ] Database views
- [ ] View refresh cron job
- [ ] API documentation

#### Phase 7: i18n
- [ ] EN translation file
- [ ] AR translation file
- [ ] RTL layout adjustments
- [ ] Number formatting
- [ ] Date formatting

#### Phase 8: Testing
- [ ] Widget unit tests
- [ ] Service unit tests
- [ ] E2E dashboard tests
- [ ] Performance tests (k6)
- [ ] Cross-browser testing

---

## 📚 Key Reference Documents

1. **[DASHBOARD_PHASE1_PHASE2_COMPLETE.md](./DASHBOARD_PHASE1_PHASE2_COMPLETE.md)** - Full Phase 1 & 2 completion report
2. **[RBAC_QUICK_REFERENCE.md](./RBAC_QUICK_REFERENCE.md)** - RBAC usage guide
3. **[DASHBOARD_WIDGETS_PROGRESS.md](./DASHBOARD_WIDGETS_PROGRESS.md)** - Widget implementation status
4. **[PRD-007](../plan/007_admin_dashboard_dev_prd.md)** - Original dashboard PRD
5. **[PRD-002-02](../plan/002_02_Tenant_Dashboard%20Feature.md)** - Dashboard feature spec

---

## 🚀 Quick Start Commands

```bash
# 1. Start environment
cd /f/jhapp/cleanmatex
supabase start
cd web-admin
npm run dev

# 2. Open in browser
# http://localhost:3000/login
# admin@demo1.com / Admin123

# 3. Check current dashboard
# Should see sidebar, topbar, and basic layout
# Widgets may not show until manual integration done

# 4. Continue development
# Start with manual widget integration (see section above)
# Then proceed to remaining widgets
```

---

## 💡 Tips for Next Developer

### Best Practices
1. **Always test in browser** after each widget
2. **Use TypeScript strictly** - no `any` types
3. **Follow existing patterns** - check Widget.tsx for examples
4. **Cache aggressively** - dashboard performance is critical
5. **Handle errors gracefully** - always show error states
6. **Think mobile-first** - responsive design is required
7. **Consider RTL** - Arabic layout will come later
8. **Document as you go** - update this guide

### Performance Tips
1. Use `StatCard` for simple KPIs (faster)
2. Use `<Widget>` for complex widgets (more features)
3. Enable auto-refresh sparingly (default 60s)
4. Cache API responses (dashboard.service does this)
5. Lazy load below-fold widgets
6. Use Supabase `.select('column1, column2')` - don't select all

### Common Pitfalls
- ❌ Forgetting tenant filter in queries
- ❌ Not handling loading states
- ❌ Fetching in render (use useEffect)
- ❌ Missing error boundaries
- ❌ Hardcoding tenant IDs
- ❌ Not testing with real data

---

## 🎯 Success Criteria

### Dashboard is "Complete" When:
- ✅ All 10 KPI widgets implemented and working
- ✅ Quick Actions bar functional
- ✅ Global Filters working and synced to URL
- ✅ Notifications panel with Realtime updates
- ✅ Backend APIs implemented (or mocked)
- ✅ Full EN/AR translations
- ✅ RTL layout working
- ✅ All tests passing (unit + E2E)
- ✅ Performance targets met (p95 < 800ms)
- ✅ Mobile responsive
- ✅ RBAC enforced throughout

### Performance Targets
- Dashboard load: < 1s above-the-fold
- API responses: p50 < 300ms, p95 < 800ms
- Widget refresh: < 500ms
- Lighthouse score: 90+

---

## 📞 Need Help?

### Resources
- **Documentation**: `/docs/dev/` folder
- **Code Examples**: Look at existing widgets
- **RBAC Guide**: `RBAC_QUICK_REFERENCE.md`
- **PRD**: `docs/plan/007_admin_dashboard_dev_prd.md`

### Debug Checklist
1. Check browser console for errors
2. Verify Supabase is running (`supabase status`)
3. Check user is authenticated
4. Verify tenant context exists
5. Test with real data (create orders in DB)
6. Check RLS policies aren't blocking
7. Verify imports and exports

---

**Last Updated**: 2025-10-24
**Current Phase**: 3 (Widgets)
**Progress**: 25% of total dashboard
**Estimated Completion**: 4-5 more sessions

Good luck! 🚀
