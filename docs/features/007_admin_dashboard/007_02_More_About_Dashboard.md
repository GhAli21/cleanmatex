Claude’s Plan
Tenant Main Dashboard Implementation Plan
Overview
Build a comprehensive dashboard system with:
RBAC-based navigation (Role-Based Access Control)
Feature flag visibility (plan-based feature toggling)
Responsive sidebar layout (collapsible on mobile)
KPI widgets (real-time business metrics)
Bilingual support (EN/AR with RTL)
Phase 1: Core Navigation & Layout System
1.1 Dashboard Layout Component
File: web-admin/app/(dashboard)/layout.tsx
Create authenticated dashboard wrapper layout
Implement responsive grid: sidebar + topbar + content
Sidebar collapse on <1024px breakpoint
Persistent sidebar state across routes
Keyboard navigation support (Tab + arrows)
1.2 Sidebar Navigation Component
File: web-admin/components/layout/Sidebar.tsx
Dynamic menu generation from config JSON
Role-based menu filtering (admin/staff/driver)
Feature flag integration (hide disabled features)
Active route highlighting
Icon mapping from Lucide React
Collapsible sections
Mobile drawer variant
1.3 Top Bar Component
File: web-admin/components/layout/TopBar.tsx
Tenant switcher (multi-tenant support)
Notifications panel (right drawer)
User profile dropdown
Language switcher (EN/AR)
Global search
Breadcrumb navigation
1.4 Navigation Configuration
File: web-admin/config/navigation.ts
{
  sections: [
    { key: "home", icon: "Home", path: "/dashboard", roles: ["admin","staff"] },
    { key: "orders", icon: "PackageSearch", path: "/dashboard/orders", roles: ["admin","staff"], featureFlag: null },
    { key: "assembly", icon: "ScanBarcode", path: "/dashboard/assembly", roles: ["admin","staff"] },
    { key: "drivers", icon: "Truck", path: "/dashboard/drivers", roles: ["admin"], featureFlag: "driver_app" },
    { key: "customers", icon: "Users", path: "/dashboard/customers", roles: ["admin","staff"] },
    { key: "catalog", icon: "Tags", path: "/dashboard/catalog", roles: ["admin"] },
    { key: "billing", icon: "Receipt", path: "/dashboard/billing", roles: ["admin","staff"] },
    { key: "reports", icon: "BarChart3", path: "/dashboard/reports", roles: ["admin"], featureFlag: "advanced_analytics" },
    { key: "inventory", icon: "Boxes", path: "/dashboard/inventory", roles: ["admin","staff"] },
    { key: "settings", icon: "Settings", path: "/dashboard/settings", roles: ["admin"] },
    { key: "help", icon: "LifeBuoy", path: "/dashboard/help", roles: ["admin","staff"] }
  ]
}
Phase 2: RBAC System Enhancement
2.1 Role Context Provider
File: web-admin/lib/auth/role-context.tsx
Extend AuthContext to include role checking
useRole() hook for component-level checks
canAccess(path) permission checker
Role hierarchy: admin > staff > driver
2.2 Route Protection Middleware
File: web-admin/middleware/route-guard.ts
Server-side route protection
Role-based access control
Feature flag enforcement
Redirect to /unauthorized if blocked
2.3 UI Component Guards
Files:
web-admin/components/auth/RequireRole.tsx - Component wrapper
web-admin/components/auth/RequireFeature.tsx - Feature flag wrapper
<RequireRole roles={["admin"]}>
  <AdminOnlyContent />
</RequireRole>

<RequireFeature feature="advanced_analytics">
  <AnalyticsWidget />
</RequireFeature>
Phase 3: Dashboard Widgets & KPIs
3.1 Widget Framework
File: web-admin/components/dashboard/Widget.tsx
Lazy-loading widget container
Skeleton loading states
Error boundaries
Auto-refresh capability (default 60s)
Role/feature flag visibility
3.2 KPI Widgets (from PRD-007)
Files: web-admin/components/dashboard/widgets/
OrdersToday.tsx - Today's order count + Δ vs last week
OrderStatus.tsx - In-Process/Ready/Out-for-Delivery counts
Revenue.tsx - Today, MTD, Last 30d revenue
Turnaround.tsx - Avg turnaround time (hours)
DeliveryRate.tsx - On-time delivery %
IssuesWidget.tsx - Cancelled/Issue orders
PaymentMix.tsx - Cash vs Online split
DriverUtilization.tsx - % active drivers
TopServices.tsx - Top 5 services by sales
AlertsWidget.tsx - Alerts (inventory, payments, SLA)
3.3 Widget Data Service
File: web-admin/lib/services/dashboard.service.ts
API endpoints: /api/v1/reports/kpi-overview
Caching layer (HTTP SWR 60s)
Tenant-scoped queries
Performance monitoring (p50<300ms, p95<800ms)
Phase 4: Quick Actions & Filters
4.1 Quick Actions Strip
File: web-admin/components/dashboard/QuickActions.tsx
Sticky action bar at top of content
Buttons: "New Order", "Receive Bag", "Assign Driver", "Cash Up", "Generate Invoice", "Send WhatsApp Update"
Feature flag visibility (e.g., PDF invoices, printing)
4.2 Global Filters Bar
File: web-admin/components/dashboard/GlobalFilters.tsx
Branch selector (multi-branch support)
Date range (Today, 7d, 30d, custom)
Order source (POS, Mobile, Marketplace, Internal)
Service category filter
B2C/B2B toggle
Filter state synced to URL query params
Phase 5: Notifications Panel
5.1 Notifications Drawer
File: web-admin/components/layout/NotificationsPanel.tsx
Right-side drawer overlay
Real-time updates via Supabase Realtime
Notification types:
New orders
Status changes
Failed payments
Driver events
Low inventory alerts
Mark as read/unread
Clear all functionality
5.2 Notification Service
File: web-admin/lib/services/notifications.service.ts
Subscribe to Supabase changes
Push notification integration (future)
WhatsApp/SMS template integration
Phase 6: Backend API Endpoints
6.1 Reports API
File: backend/src/reports/reports.controller.ts (NestJS)
GET /api/v1/reports/kpi-overview?branchId=&from=&to=
Returns: {
  orders: { today: 64, inProcess: 18, ready: 22, outForDelivery: 9 },
  revenue: { today: 128.4, mtd: 3495.7, last30d: 7150.2, currency: "OMR" },
  sla: { avgTATHours: 23.5, onTimePct: 92.1 },
  issues: { open: 7, last7d: 19 },
  payments: { cashPct: 63.2, onlinePct: 36.8 },
  drivers: { activePct: 54.0 },
  topServices: [{ name: "Dry Clean", amount: 980.5 }]
}
6.2 Database Views
File: supabase/migrations/0011_dashboard_views.sql
Create materialized views for fast KPI queries:
vw_orders_by_status
vw_revenue_daily
vw_payment_mix
vw_top_services
vw_driver_activity
Refresh strategy: hourly via cron
Phase 7: Internationalization & RTL
7.1 Translation Files
Files: web-admin/messages/dashboard.{en,ar}.json
{
  "dashboard": {
    "title": "Dashboard",
    "widgets": {
      "ordersToday": "Today's Orders",
      "revenue": "Revenue",
      ...
    }
  }
}
7.2 RTL Layout Adjustments
Sidebar flip (left→right in AR)
Chart axis flip
Number formatting (Arabic numerals)
Date/time localization
Phase 8: Performance Optimization
8.1 Loading Strategy
SSR for initial dashboard load (TTFB <200ms)
Client-side widget hydration
Skeleton screens during load
Defer below-fold charts
8.2 Caching
HTTP cache headers (60s for stable widgets)
React Query for client-side caching
Redis for server-side widget data (optional)
8.3 Monitoring
Sentry for error tracking
Performance metrics (Core Web Vitals)
API response time tracking
Phase 9: Testing
9.1 Unit Tests
Widget rendering with mock data
Role/feature flag filtering logic
Navigation menu generation
9.2 E2E Tests (Playwright)
Dashboard load flow
Filter interactions
Widget drilldowns
RBAC enforcement
RTL layout validation
Implementation Order
✅ Week 1: Layout & Navigation (Phase 1)
✅ Week 2: RBAC System (Phase 2)
🔄 Week 3: Widget Framework + First 5 Widgets (Phase 3)
🔄 Week 4: Remaining Widgets + Quick Actions (Phase 3-4)
⏳ Week 5: Filters + Notifications (Phase 4-5)
⏳ Week 6: Backend APIs + Views (Phase 6)
⏳ Week 7: i18n/RTL + Performance (Phase 7-8)
⏳ Week 8: Testing + Polish (Phase 9)
Files to Create/Modify
New Files (~40 files)
Layout: (dashboard)/layout.tsx, Sidebar.tsx, TopBar.tsx
Config: navigation.ts, widget-config.ts
Widgets: 10 widget components
Services: dashboard.service.ts, notifications.service.ts
Context: role-context.tsx
Middleware: route-guard.ts
Components: RequireRole.tsx, RequireFeature.tsx, Widget.tsx, QuickActions.tsx, GlobalFilters.tsx, NotificationsPanel.tsx
Backend: reports.controller.ts, reports.service.ts
Migrations: 0011_dashboard_views.sql
Messages: dashboard.en.json, dashboard.ar.json
Tests: ~15 test files
Modified Files (~5 files)
web-admin/lib/auth/auth-context.tsx - Add role helpers
web-admin/middleware.ts - Add route guards
web-admin/app/dashboard/page.tsx - Replace with widget grid
web-admin/lib/services/feature-flags.service.ts - Add UI integration
web-admin/components/ui/index.ts - Export new components
Acceptance Criteria
 Dashboard renders <1s above-the-fold
 All KPIs correct vs SQL baselines
 EN/AR switch toggles UI + number formatting
 RBAC verified: admin sees all, staff sees limited
 Feature flags hide disabled widgets
 Sidebar collapses on mobile (<1024px)
 Keyboard navigation works (Tab + arrows)
 RTL layout correct in Arabic
 API p50<300ms, p95<800ms
 80%+ test coverage on critical paths
 
 
Update Todos

Create dashboard layout structure with responsive sidebar

Build navigation configuration system with RBAC

Implement Sidebar component with role filtering

Create TopBar with tenant switcher and notifications

Setup role context provider and RBAC hooks

Implement route protection middleware

Create RequireRole and RequireFeature guard components

Build widget framework with lazy loading

Implement KPI widgets (10 widgets)

Create dashboard service and API endpoints

Add Quick Actions and Global Filters

Implement notifications panel

Add i18n translations for dashboard

Test and optimize performance

