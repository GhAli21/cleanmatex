# 15 - Dashboard Service and Widgets

## Summary

Implemented real Supabase queries in dashboard service and wired widgets to use actual data. Added recent orders list.

## Files Affected

- `web-admin/lib/services/dashboard.service.ts`
- `web-admin/components/dashboard/widgets/OrdersTodayWidget.tsx`
- `web-admin/components/dashboard/widgets/RevenueWidget.tsx`
- `web-admin/components/dashboard/RecentOrdersList.tsx` (new)
- `web-admin/components/dashboard/DashboardContent.tsx`

## Changes

### 1. Dashboard Service - getKPIOverview

Replaced mock data with real queries against `org_orders_mst`:
- Today's orders, in-process, ready, out-for-delivery counts
- Revenue: today, MTD, last 30 days from order totals

### 2. Dashboard Service - getOrdersTrend / getRevenueTrend

Implemented date-grouped queries for trend charts.

### 3. Dashboard Service - getOrdersCountForDate / getRecentOrders

- `getOrdersCountForDate(tenantId, date, branchId?)` for any date
- `getRecentOrders(tenantId, limit)` for recent orders list

### 4. OrdersTodayWidget - Trend

Calculates trend from yesterday's count: `((today - yesterday) / yesterday) * 100`

### 5. RevenueWidget

Uses `getKPIOverview()` for today, MTD, last 30d revenue.

### 6. RecentOrdersList

New component fetching `getRecentOrders()` and displaying links to order details.

### 7. DashboardContent

Replaced TODO placeholder with `<RecentOrdersList />`.

## Effects

- Dashboard now shows real order and revenue data
- Tenant isolation via `tenant_org_id` filter
