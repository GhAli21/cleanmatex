# Plan: Dashboard Widgets (PaymentMix, Turnaround, Issues, DriverUtilization, DeliveryRate, Alerts)

## Overview

Six dashboard widgets currently use placeholder or partial data. Each needs real queries against Supabase/tables to display meaningful KPIs.

## Current State Summary

| Widget | File | TODOs / Issue |
|--------|------|---------------|
| PaymentMixWidget | widgets/PaymentMixWidget.tsx | cardPct: 0, otherPct: 0 |
| TurnaroundTimeWidget | widgets/TurnaroundTimeWidget.tsx | trend: 0 (historical) |
| IssuesWidget | widgets/IssuesWidget.tsx | critical: 0, resolved: 0 |
| DriverUtilizationWidget | widgets/DriverUtilizationWidget.tsx | totalDrivers: 0, activeDrivers: 0, avgDeliveries: 0 |
| DeliveryRateWidget | widgets/DeliveryRateWidget.tsx | TODO: actual delivery metrics query |
| AlertsWidget | widgets/AlertsWidget.tsx | TODO: actual alerts query |

## Prerequisites

- `dashboard.service.ts` has `getKPIOverview` and can be extended
- Tables: org_orders_mst, org_payments_dtl_tr, org_order_item_issues, org_users_mst (drivers), org_dlv_* (delivery)
- KPIOverview type already defines payments, sla, issues, drivers

## Implementation Steps (Per Widget)

### 1. PaymentMixWidget

- **Data:** Cash, card, online, other payment method percentages
- **Source:** `org_payments_dtl_tr` or org_orders_mst.payment_type_code
- **Action:** Extend `getKPIOverview().payments` to include cardPct, otherPct from payment method distribution
- **Schema check:** payment_method_code values (CASH, CARD, ONLINE, etc.)

### 2. TurnaroundTimeWidget

- **Data:** trend = week-over-week or period-over-period change in avg TAT
- **Source:** org_orders_mst (created_at, delivered_at or status_history)
- **Action:** Add `getTATTrend(tenantId)` or extend getKPIOverview to return `sla.trend`
- **Formula:** Compare this week avg TAT vs last week

### 3. IssuesWidget

- **Data:** critical count, resolved count
- **Source:** org_order_item_issues or equivalent
- **Action:** Query issues table: status = critical, status = resolved (or resolved_at not null)
- **Extend:** getKPIOverview().issues or new method getIssuesSummary

### 4. DriverUtilizationWidget

- **Data:** totalDrivers, activeDrivers, avgDeliveriesPerDriver
- **Source:** org_users_mst (role = driver), org_dlv_stops_dtl / routes
- **Action:** Count drivers; count active (e.g. has delivery today); avg stops per active driver
- **Extend:** getKPIOverview().drivers with full fields

### 5. DeliveryRateWidget

- **Data:** On-time delivery %, delivered today, etc.
- **Source:** org_dlv_stops_dtl, org_orders_mst (status, delivered_at)
- **Action:** Implement delivery metrics query; add to dashboard service
- **Extend:** getKPIOverview or new getDeliveryMetrics

### 6. AlertsWidget

- **Data:** List of alerts (overdue orders, low stock, expiring trials, etc.)
- **Source:** org_orders_mst, inventory, org_pln_subscriptions_mst
- **Action:** Define alert types; query each; return structured list
- **Extend:** New method getAlerts(tenantId) returning Alert[]

## Common Steps

1. Add methods or extend getKPIOverview in dashboard.service.ts
2. Ensure all queries filter by tenant_org_id
3. Update KPIOverview type if needed
4. Update each widget to use new data fields
5. Handle loading/error states (already in place)

## Acceptance Criteria

- [ ] Each widget displays real data (no hardcoded 0 for TODOs)
- [ ] Queries are tenant-scoped
- [ ] No N+1 or heavy queries on dashboard load (consider caching)
- [ ] Build passes

## Production Checklist

- [ ] Indexes on filtered columns (tenant_org_id, dates)
- [ ] Dashboard load time acceptable
- [ ] i18n for any new labels

## References

- web-admin/lib/services/dashboard.service.ts
- web-admin/src/features/dashboard/ui/
- docs/features/Dashboard_Feature/DASHBOARD_CONTINUATION_GUIDE.md
