---
prd_code: PRD-SAAS-MNG-0004
title: Analytics & Reporting
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: High
category: Platform Management - Analytics
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0003 (Billing & Subscriptions)
  - PRD-SAAS-MNG-0012 (Observability & SLO)
---

# PRD-SAAS-MNG-0004: Analytics & Reporting

## Executive Summary

The **Analytics & Reporting** module provides comprehensive data intelligence for the CleanMateX platform, enabling platform administrators to make data-driven decisions about tenant health, revenue trends, system performance, and business growth. This system aggregates metrics across all tenants while maintaining tenant isolation and providing both real-time and historical analytics.

### Problem Statement

Platform administrators currently lack:
- ❌ **Unified visibility** into platform-wide metrics
- ❌ **Tenant health monitoring** and churn prediction
- ❌ **Revenue analytics** and forecasting capabilities
- ❌ **Usage pattern** insights for capacity planning
- ❌ **Performance benchmarking** across tenants
- ❌ **Automated reporting** for stakeholders
- ❌ **Data export** capabilities for external analysis

### Solution Overview

Build a **comprehensive analytics engine** that:
- ✅ Collects metrics from all platform components
- ✅ Provides real-time dashboards for platform admins
- ✅ Generates scheduled reports automatically
- ✅ Predicts tenant churn and growth opportunities
- ✅ Tracks revenue, usage, and system performance
- ✅ Supports custom queries and ad-hoc analysis
- ✅ Exports data in multiple formats (CSV, Excel, PDF)

### Business Value

**For Platform Administrators:**
- Make informed decisions with data-driven insights
- Identify at-risk tenants early for proactive intervention
- Optimize infrastructure based on actual usage patterns
- Track KPIs and business metrics in real-time

**For Business Growth:**
- Identify upsell opportunities (tenants approaching limits)
- Understand feature adoption and usage trends
- Forecast revenue with precision
- Benchmark tenant performance for success stories

**For Operations:**
- Monitor system health and capacity utilization
- Plan infrastructure scaling proactively
- Identify performance bottlenecks
- Track SLA compliance across all tenants

---

## Table of Contents

1. [Scope & Objectives](#1-scope--objectives)
2. [User Personas](#2-user-personas)
3. [Key Features](#3-key-features)
4. [Analytics Categories](#4-analytics-categories)
5. [Metrics & KPIs](#5-metrics--kpis)
6. [Dashboard Designs](#6-dashboard-designs)
7. [Report Types](#7-report-types)
8. [Database Schema](#8-database-schema)
9. [Data Collection & Aggregation](#9-data-collection--aggregation)
10. [API Specifications](#10-api-specifications)
11. [UI/UX Design](#11-uiux-design)
12. [Real-Time Analytics](#12-real-time-analytics)
13. [Export & Scheduling](#13-export--scheduling)
14. [Predictive Analytics](#14-predictive-analytics)
15. [Security & Privacy](#15-security--privacy)
16. [Performance Considerations](#16-performance-considerations)
17. [Implementation Plan](#17-implementation-plan)
18. [Testing Strategy](#18-testing-strategy)
19. [Monitoring & Observability](#19-monitoring--observability)
20. [Future Enhancements](#20-future-enhancements)

---

## 1. Scope & Objectives

### 1.1 In Scope

**Analytics Capabilities:**
- Platform-wide metrics aggregation
- Per-tenant analytics and comparisons
- Revenue and billing analytics
- Usage pattern analysis
- System performance metrics
- Tenant health scoring
- Churn prediction
- Growth forecasting

**Reporting Features:**
- Real-time dashboards
- Scheduled automated reports
- Custom report builder
- Data exports (CSV, Excel, PDF)
- Email delivery of reports
- Report versioning and history

**Data Sources:**
- Tenant lifecycle events
- Billing and payment data
- Usage metrics (orders, customers, storage)
- System performance metrics
- Support ticket data
- Audit logs and activity
- Feature usage tracking

### 1.2 Out of Scope

- ❌ Tenant-facing analytics (separate feature)
- ❌ Public reporting or data sharing
- ❌ Machine learning model training (future phase)
- ❌ Custom integrations with BI tools (Phase 2)
- ❌ Real-time alerting (covered in PRD-0012 Observability)

### 1.3 Success Criteria

**Business Metrics:**
- Reduce churn by 20% through early intervention
- Increase upsells by 30% via growth opportunity identification
- Achieve 95% forecast accuracy for monthly revenue

**Technical Metrics:**
- Dashboard load time < 2 seconds
- Report generation < 30 seconds
- Data freshness < 5 minutes for real-time metrics
- Support 100k+ metric data points per day

**User Satisfaction:**
- 90%+ platform admin satisfaction with analytics
- 80%+ usage rate of automated reports
- < 5% manual data analysis required

---

## 2. User Personas

### 2.1 Platform Owner (Super Admin)

**Primary Use Cases:**
- Monitor overall platform health and growth
- Review revenue and financial metrics
- Track strategic KPIs and OKRs
- Identify business opportunities and risks
- Make data-driven product decisions

**Key Reports:**
- Executive dashboard (high-level KPIs)
- Monthly revenue reports
- Tenant growth and churn analysis
- Feature adoption trends
- Strategic forecasts

### 2.2 Finance/Billing Manager

**Primary Use Cases:**
- Track revenue and payment metrics
- Monitor billing cycles and collections
- Analyze MRR/ARR trends
- Forecast cash flow
- Identify payment issues

**Key Reports:**
- Revenue analytics dashboard
- Subscription metrics
- Payment success rates
- Dunning effectiveness
- Financial forecasts

### 2.3 Customer Success Manager

**Primary Use Cases:**
- Monitor tenant health scores
- Identify at-risk tenants
- Track feature adoption
- Analyze usage patterns
- Measure customer engagement

**Key Reports:**
- Tenant health dashboard
- Churn risk analysis
- Feature usage reports
- Engagement metrics
- Success stories (high performers)

### 2.4 Platform Analyst

**Primary Use Cases:**
- Perform ad-hoc data analysis
- Build custom reports
- Export data for external tools
- Create data visualizations
- Track detailed metrics

**Key Reports:**
- Custom query builder
- Advanced filtering
- Multi-dimensional analysis
- Data exports
- Historical trend analysis

---

## 3. Key Features

### 3.1 Real-Time Dashboards

**Executive Dashboard:**
- Total tenant count with growth trend
- Monthly Recurring Revenue (MRR) with trend
- Churn rate and at-risk tenants
- System performance overview
- Active users across all tenants
- Top 5 growing tenants
- Revenue vs. forecast comparison

**Revenue Dashboard:**
- MRR, ARR, and revenue growth rate
- Revenue by subscription plan
- Payment success/failure rates
- Outstanding invoices and overdue amounts
- Revenue per tenant (RPT)
- Customer Lifetime Value (LTV)
- Churn impact on revenue

**Tenant Health Dashboard:**
- Health score distribution
- At-risk tenant list with risk factors
- Tenant engagement metrics
- Feature adoption rates
- Support ticket volume per tenant
- Usage vs. plan limits
- Tenant satisfaction scores (if available)

**Usage Analytics Dashboard:**
- Total orders processed (all tenants)
- Storage utilization
- API call volume
- Database query performance
- Active user sessions
- Feature usage heatmap
- Peak usage times

### 3.2 Scheduled Reports

**Daily Reports:**
- New tenant signups
- Payment processing summary
- Critical system alerts
- Support ticket volume

**Weekly Reports:**
- Tenant activity summary
- Revenue collection report
- At-risk tenant analysis
- Feature usage trends

**Monthly Reports:**
- Executive summary (for stakeholders)
- Financial performance
- Churn and retention analysis
- Growth metrics and forecasts
- System capacity utilization

**Quarterly Reports:**
- Business review report
- Strategic KPI tracking
- Competitive analysis (if data available)
- Investment recommendations

### 3.3 Custom Report Builder

**Query Capabilities:**
- Drag-and-drop interface
- Multi-dimensional filtering
- Custom date ranges
- Aggregation functions (SUM, AVG, COUNT, etc.)
- Grouping and sorting
- Chart type selection

**Saved Reports:**
- Save custom queries for reuse
- Share reports with team members
- Version control for reports
- Schedule custom reports
- Clone and modify existing reports

### 3.4 Data Export

**Export Formats:**
- CSV (for Excel/Sheets)
- Excel (.xlsx) with formatting
- PDF (for presentations/printing)
- JSON (for API consumption)

**Export Options:**
- Full data export
- Filtered subset export
- Scheduled exports to email/S3
- API endpoint for programmatic access

---

## 4. Analytics Categories

### 4.1 Tenant Analytics

**Lifecycle Metrics:**
- Tenant acquisition rate
- Onboarding completion rate
- Time to first value (activation)
- Tenure distribution
- Churn rate (monthly/quarterly/annual)
- Retention rate
- Reactivation rate

**Engagement Metrics:**
- Daily/Weekly/Monthly Active Tenants
- Session duration
- Feature usage frequency
- Login frequency
- User invitations sent
- Team size per tenant
- Multi-branch adoption

**Growth Metrics:**
- Expansion revenue
- Plan upgrades/downgrades
- Add-on purchases
- Storage expansion
- User count growth per tenant

### 4.2 Revenue Analytics

**Subscription Metrics:**
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- MRR growth rate (month-over-month)
- New MRR (from new tenants)
- Expansion MRR (from upgrades)
- Churned MRR (from cancellations)
- Contraction MRR (from downgrades)

**Financial Metrics:**
- Revenue per tenant (RPT)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- LTV:CAC ratio
- Average Revenue Per User (ARPU)
- Payment success rate
- Dunning recovery rate

**Billing Metrics:**
- Invoice generation volume
- Payment processing time
- Failed payment rate
- Refund rate
- Outstanding receivables
- Days Sales Outstanding (DSO)

### 4.3 Usage Analytics

**Order Metrics:**
- Total orders processed (platform-wide)
- Orders per tenant (average/median)
- Order growth trends
- Order value distribution
- Order status breakdown
- Average order processing time

**Customer Metrics:**
- Total end-customers across platform
- Customers per tenant (average)
- Customer growth rate
- Repeat customer rate
- Customer acquisition trends

**System Usage:**
- Storage consumed (total/per tenant)
- API call volume
- Database transaction count
- Concurrent user sessions
- Peak usage periods
- Feature-specific usage

### 4.4 Performance Analytics

**System Performance:**
- Average API response time
- Database query performance
- Page load times
- Error rates (4xx, 5xx)
- Uptime percentage
- Infrastructure utilization

**Tenant Performance:**
- Fastest/slowest performing tenants
- Resource consumption per tenant
- Query performance by tenant
- Error rates per tenant
- SLA compliance tracking

### 4.5 Support Analytics

**Ticket Metrics:**
- Total ticket volume
- Tickets per tenant
- Average resolution time
- First response time
- Ticket priority distribution
- Escalation rate
- Satisfaction scores

**Issue Trends:**
- Common issue categories
- Bugs vs. feature requests
- Critical issues count
- Recurring issues per tenant

---

## 5. Metrics & KPIs

### 5.1 Platform-Level KPIs

**Growth KPIs:**
```typescript
interface PlatformGrowthKPIs {
  // Tenant Metrics
  total_tenants: number;
  active_tenants: number;           // Active in last 30 days
  new_tenants_mtd: number;          // Month-to-date
  churned_tenants_mtd: number;
  net_tenant_growth: number;        // New - Churned
  tenant_growth_rate: number;       // Percentage

  // Revenue Metrics
  mrr: number;                      // Monthly Recurring Revenue
  arr: number;                      // Annual Recurring Revenue
  mrr_growth_rate: number;          // Month-over-month
  arr_growth_rate: number;          // Year-over-year

  // Engagement Metrics
  dau: number;                      // Daily Active Users
  wau: number;                      // Weekly Active Users
  mau: number;                      // Monthly Active Users
  dau_mau_ratio: number;            // Stickiness metric
}
```

**Health KPIs:**
```typescript
interface PlatformHealthKPIs {
  // System Health
  uptime_percentage: number;        // 99.9% target
  avg_response_time_ms: number;     // < 300ms target
  error_rate: number;               // < 0.1% target

  // Tenant Health
  healthy_tenants: number;          // Health score > 80
  at_risk_tenants: number;          // Health score < 50
  avg_health_score: number;         // 0-100

  // Financial Health
  payment_success_rate: number;     // > 95% target
  outstanding_receivables: number;
  churn_rate: number;               // < 5% target
}
```

**Efficiency KPIs:**
```typescript
interface PlatformEfficiencyKPIs {
  // Support Efficiency
  avg_ticket_resolution_hours: number;
  first_response_time_minutes: number;
  ticket_satisfaction_score: number;  // 1-5

  // Operational Efficiency
  infrastructure_utilization: number; // Percentage
  cost_per_tenant: number;
  support_tickets_per_tenant: number;

  // Product Efficiency
  feature_adoption_rate: number;      // Percentage
  onboarding_completion_rate: number;
  time_to_first_value_days: number;
}
```

### 5.2 Tenant-Specific KPIs

```typescript
interface TenantKPIs {
  tenant_id: string;
  tenant_name: string;

  // Health Score (0-100)
  health_score: number;
  health_trend: 'improving' | 'stable' | 'declining';

  // Usage Metrics
  active_users: number;
  orders_last_30d: number;
  storage_used_gb: number;
  api_calls_last_30d: number;

  // Engagement
  last_login_date: Date;
  login_frequency: number;          // Logins per week
  feature_usage_count: number;      // Unique features used

  // Financial
  mrr_contribution: number;
  ltv: number;
  payment_history_score: number;    // 0-100

  // Support
  open_tickets: number;
  avg_ticket_resolution_days: number;
  satisfaction_score: number;       // If available

  // Risk Factors
  churn_risk_score: number;         // 0-100 (higher = more risk)
  risk_factors: string[];           // ['low_usage', 'payment_issues', etc.]
}
```

---

## 6. Dashboard Designs

### 6.1 Executive Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Platform HQ Console - Executive Dashboard                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Total       │  │  MRR         │  │  Churn Rate  │      │
│  │  Tenants     │  │  $45,250     │  │  3.2%        │      │
│  │  127 ▲ 8%   │  │  ▲ 12.5%    │  │  ▼ 0.5%     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Active      │  │  Health      │  │  Support     │      │
│  │  Users       │  │  Score       │  │  Tickets     │      │
│  │  1,543 ▲ 5% │  │  87/100      │  │  23 Open     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MRR Trend (Last 12 Months)                        │    │
│  │                                  ╱                  │    │
│  │                              ╱╱╱                    │    │
│  │                          ╱╱╱                        │    │
│  │  $20K ──────────────╱╱╱─────────────────────────   │    │
│  │       Jan  Mar  May  Jul  Sep  Nov  Jan           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  Top Growing Tenants     │  │  At-Risk Tenants       │  │
│  │  1. Luxury Laundry +45% │  │  1. Quick Clean (42)   │  │
│  │  2. Eco Wash +38%       │  │  2. Express Dry (38)   │  │
│  │  3. Premium Clean +32%  │  │  3. Fast Wash (35)     │  │
│  └──────────────────────────┘  └────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Widgets:**

1. **Key Metrics Cards** (Top Row)
   - Total Tenants (with growth trend)
   - MRR (with growth percentage)
   - Churn Rate (with trend indicator)
   - Active Users (across all tenants)
   - Platform Health Score
   - Open Support Tickets

2. **MRR Trend Chart**
   - Line graph showing 12-month MRR history
   - Forecast line for next 3 months
   - Annotations for significant events
   - Hover tooltips with exact values

3. **Top Growing Tenants Table**
   - Tenant name
   - Growth percentage
   - Current MRR
   - Quick action buttons (View Details)

4. **At-Risk Tenants Alert**
   - Tenant name
   - Health score (color-coded)
   - Risk factors summary
   - Action buttons (Contact, View)

### 6.2 Revenue Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Revenue Analytics Dashboard                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  MRR     │ │  ARR     │ │  New MRR │ │  Churned │       │
│  │  $45,250 │ │  $543K   │ │  $5,200  │ │  MRR     │       │
│  │  ▲ 12%   │ │  ▲ 15%   │ │          │ │  $1,450  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Revenue Breakdown by Plan                          │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │ Free      ████ 15% ($0)                   │     │    │
│  │  │ Starter   ████████████ 30% ($13,575)      │     │    │
│  │  │ Growth    ████████████████ 35% ($15,838)  │     │    │
│  │  │ Pro       ████████ 20% ($9,050)           │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  Payment Metrics         │  │  Financial Health      │  │
│  │  Success Rate: 96.3%    │  │  Outstanding: $12,450 │  │
│  │  Failed: $1,850          │  │  Overdue: $3,200      │  │
│  │  Pending: $4,200         │  │  DSO: 18 days         │  │
│  │  Refunded: $250          │  │  LTV:CAC: 4.2:1       │  │
│  └──────────────────────────┘  └────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Revenue Forecast (Next 6 Months)                   │    │
│  │  Projected MRR: $65,000 by July 2025                │    │
│  │  [Interactive Chart: Actual vs. Forecast]           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Tenant Health Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Tenant Health Dashboard                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Health Score Distribution                          │    │
│  │  ┌────────────────────────────────────────────┐     │    │
│  │  │ Excellent (80-100)  ████████████ 45 (35%) │     │    │
│  │  │ Good (60-79)        ████████ 38 (30%)     │     │    │
│  │  │ Fair (40-59)        ██████ 28 (22%)       │     │    │
│  │  │ At Risk (0-39)      ████ 16 (13%)         │     │    │
│  │  └────────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  At-Risk Tenants (Health Score < 40)                │    │
│  │  ┌──────────┬────────┬──────────┬─────────────────┐ │    │
│  │  │ Tenant   │ Score  │ Risk     │ Actions         │ │    │
│  │  ├──────────┼────────┼──────────┼─────────────────┤ │    │
│  │  │ QuickClean│  38   │ Low Usage│ [Contact] [View]│ │    │
│  │  │ ExpressDry│  35   │ Payment  │ [Contact] [View]│ │    │
│  │  │ FastWash  │  32   │ Support  │ [Contact] [View]│ │    │
│  │  └──────────┴────────┴──────────┴─────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  Engagement Metrics      │  │  Churn Prediction      │  │
│  │  DAU/MAU: 0.42           │  │  High Risk: 8          │  │
│  │  Avg Session: 28 min     │  │  Medium Risk: 15       │  │
│  │  Feature Usage: 68%      │  │  Low Risk: 104         │  │
│  └──────────────────────────┘  └────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Usage Analytics Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Usage Analytics Dashboard                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Total   │ │  Storage │ │  API     │ │  Active  │       │
│  │  Orders  │ │  Used    │ │  Calls   │ │  Users   │       │
│  │  45,230  │ │  1.2 TB  │ │  2.4M    │ │  1,543   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Order Volume Trend (Last 30 Days)                  │    │
│  │  [Interactive Line Chart]                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────┐  ┌────────────────────────┐  │
│  │  Feature Adoption        │  │  Peak Usage Times      │  │
│  │  Orders: 95%             │  │  Mon-Fri: 9AM-2PM      │  │
│  │  Customers: 88%          │  │  Sat: 10AM-12PM        │  │
│  │  Invoicing: 72%          │  │  Sun: Closed (most)    │  │
│  │  Subscriptions: 45%      │  │  Evening: Light        │  │
│  └──────────────────────────┘  └────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Tenant Usage Comparison                            │    │
│  │  [Table: Top 10 by Orders, Storage, API Calls]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Report Types

### 7.1 Executive Summary Report

**Frequency:** Monthly
**Recipients:** Platform Owner, Stakeholders
**Format:** PDF

**Sections:**
1. **Executive Summary** (1 page)
   - Key achievements this month
   - Critical metrics overview
   - Strategic recommendations

2. **Platform Growth** (2 pages)
   - Tenant acquisition and churn
   - Revenue growth (MRR/ARR)
   - User growth trends
   - Market expansion (if applicable)

3. **Financial Performance** (2 pages)
   - Revenue breakdown by plan
   - Payment success rates
   - Outstanding receivables
   - Forecast vs. actual

4. **Tenant Health** (1 page)
   - Health score distribution
   - At-risk tenants summary
   - Churn analysis and prevention

5. **Operational Metrics** (1 page)
   - System uptime and performance
   - Support ticket metrics
   - Infrastructure utilization

6. **Strategic Initiatives** (1 page)
   - Product roadmap progress
   - New feature adoption
   - Competitive insights
   - Recommendations for next month

**Sample Template:**
```markdown
# CleanMateX Platform - Executive Summary
## January 2025

### Key Highlights
- 🎉 Added 8 new tenants (+6.7%)
- 💰 MRR grew by $5,200 (+12.5%)
- ⚡ Platform uptime: 99.97%
- 😊 Customer satisfaction: 4.3/5

### Platform Overview
**Tenants:** 127 total (8 new, 4 churned)
**MRR:** $45,250 (target: $43,000 ✅)
**ARR:** $543,000
**Active Users:** 1,543 (+5% MoM)

[... detailed sections follow ...]
```

### 7.2 Revenue Report

**Frequency:** Weekly (summary), Monthly (detailed)
**Recipients:** Finance Team, Platform Owner
**Format:** Excel + PDF

**Metrics:**
- MRR and MRR growth rate
- Revenue by subscription plan
- New revenue, expansion, churn, contraction
- Payment processing summary
- Outstanding invoices and overdue amounts
- Revenue forecast vs. actual

**Excel Tabs:**
1. **Summary** - High-level metrics
2. **MRR Breakdown** - Detailed MRR components
3. **Payments** - Payment transactions log
4. **Invoices** - Invoice status tracking
5. **Forecasts** - Revenue projections
6. **Cohort Analysis** - Tenant cohorts

### 7.3 Tenant Health Report

**Frequency:** Weekly
**Recipients:** Customer Success Team
**Format:** CSV + PDF Summary

**Contents:**
- All tenants with health scores
- Risk categorization (high/medium/low)
- Risk factors for at-risk tenants
- Recommended actions
- Historical health trends
- Churn prediction scores

**Action Items:**
- Contact list for high-risk tenants
- Upsell opportunities (tenants near limits)
- Success stories (high performers)

### 7.4 Usage Analytics Report

**Frequency:** Monthly
**Recipients:** Product Team, Platform Owner
**Format:** PDF

**Metrics:**
- Total orders processed
- Storage utilization trends
- API call volume and patterns
- Feature adoption rates
- User activity metrics
- Peak usage analysis

**Insights:**
- Capacity planning recommendations
- Feature usage patterns
- Tenant segmentation by usage
- Growth projections

### 7.5 Support Performance Report

**Frequency:** Weekly
**Recipients:** Support Team Lead
**Format:** PDF

**Metrics:**
- Ticket volume and trends
- Average resolution time
- First response time
- Ticket priority distribution
- Top issues and categories
- Tenant satisfaction scores
- SLA compliance

### 7.6 System Performance Report

**Frequency:** Daily (alerts), Weekly (summary)
**Recipients:** DevOps Team, Platform Owner
**Format:** Email digest + Dashboard

**Metrics:**
- Uptime percentage
- API response times
- Error rates
- Database performance
- Infrastructure utilization
- Cost per tenant
- Capacity alerts

---

## 8. Database Schema

### 8.1 Analytics Tables

**Table: `platform_metrics_agg`**
```sql
CREATE TABLE platform_metrics_agg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time dimension
  metric_date DATE NOT NULL,
  metric_hour INTEGER,              -- 0-23 for hourly granularity
  aggregation_level VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'

  -- Metric type
  metric_category VARCHAR(50) NOT NULL, -- 'tenant', 'revenue', 'usage', 'system'
  metric_name VARCHAR(100) NOT NULL,

  -- Values
  metric_value_numeric DECIMAL(15,2),
  metric_value_json JSONB,          -- For complex metrics

  -- Dimensions
  tenant_id UUID,                    -- NULL for platform-wide metrics
  plan_type VARCHAR(50),
  region VARCHAR(50),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- Indexes
  CONSTRAINT unique_metric UNIQUE (metric_date, metric_hour, metric_category, metric_name, tenant_id)
);

CREATE INDEX idx_metrics_date ON platform_metrics_agg(metric_date DESC);
CREATE INDEX idx_metrics_category ON platform_metrics_agg(metric_category, metric_name);
CREATE INDEX idx_metrics_tenant ON platform_metrics_agg(tenant_id, metric_date DESC);
```

**Table: `platform_tenant_health_scores`**
```sql
CREATE TABLE platform_tenant_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Calculated date
  calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  calculation_date DATE NOT NULL,

  -- Health score components (0-100 each)
  overall_health_score INTEGER NOT NULL,
  usage_score INTEGER NOT NULL,         -- Based on activity
  engagement_score INTEGER NOT NULL,    -- Login frequency, features used
  financial_score INTEGER NOT NULL,     -- Payment history
  support_score INTEGER NOT NULL,       -- Ticket volume, satisfaction
  growth_score INTEGER NOT NULL,        -- User/order growth

  -- Risk assessment
  churn_risk_score INTEGER NOT NULL,    -- 0-100 (higher = more risk)
  churn_probability DECIMAL(5,2),       -- 0.00-100.00%
  risk_category VARCHAR(20) NOT NULL,   -- 'low', 'medium', 'high', 'critical'

  -- Risk factors
  risk_factors JSONB,                   -- Array of risk indicators
  /*
    Example:
    {
      "low_usage": { "severity": "high", "details": "< 10 orders/month" },
      "payment_failed": { "severity": "critical", "details": "2 failed payments" },
      "no_recent_login": { "severity": "medium", "details": "No login in 14 days" }
    }
  */

  -- Recommendations
  recommended_actions JSONB,            -- Suggested interventions

  -- Trend
  health_trend VARCHAR(20),             -- 'improving', 'stable', 'declining'
  previous_score INTEGER,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT unique_tenant_date UNIQUE (tenant_id, calculation_date)
);

CREATE INDEX idx_health_tenant ON platform_tenant_health_scores(tenant_id, calculation_date DESC);
CREATE INDEX idx_health_score ON platform_tenant_health_scores(overall_health_score);
CREATE INDEX idx_health_risk ON platform_tenant_health_scores(churn_risk_score DESC);
```

**Table: `platform_revenue_metrics`**
```sql
CREATE TABLE platform_revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time dimension
  metric_month DATE NOT NULL,           -- First day of month

  -- MRR breakdown
  mrr_total DECIMAL(10,2) NOT NULL,
  mrr_new DECIMAL(10,2) DEFAULT 0,      -- From new tenants
  mrr_expansion DECIMAL(10,2) DEFAULT 0, -- From upgrades
  mrr_contraction DECIMAL(10,2) DEFAULT 0, -- From downgrades
  mrr_churned DECIMAL(10,2) DEFAULT 0,  -- From cancellations

  -- ARR
  arr_total DECIMAL(10,2) NOT NULL,

  -- Growth rates
  mrr_growth_rate DECIMAL(5,2),         -- Percentage
  arr_growth_rate DECIMAL(5,2),

  -- Tenant metrics
  total_paying_tenants INTEGER NOT NULL,
  new_tenants INTEGER DEFAULT 0,
  churned_tenants INTEGER DEFAULT 0,

  -- Financial health
  revenue_per_tenant DECIMAL(10,2),     -- MRR / tenants
  ltv_average DECIMAL(10,2),
  cac_average DECIMAL(10,2),
  ltv_cac_ratio DECIMAL(5,2),

  -- Payment metrics
  payment_success_rate DECIMAL(5,2),
  failed_payment_amount DECIMAL(10,2),
  outstanding_receivables DECIMAL(10,2),

  -- Metadata
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT unique_month UNIQUE (metric_month)
);

CREATE INDEX idx_revenue_month ON platform_revenue_metrics(metric_month DESC);
```

**Table: `platform_reports_mst`**
```sql
CREATE TABLE platform_reports_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Report definition
  report_name VARCHAR(250) NOT NULL,
  report_type VARCHAR(50) NOT NULL,     -- 'executive', 'revenue', 'health', 'usage'
  report_description TEXT,

  -- Scheduling
  schedule_type VARCHAR(20) NOT NULL,   -- 'daily', 'weekly', 'monthly', 'adhoc'
  schedule_cron VARCHAR(50),            -- Cron expression
  next_run_at TIMESTAMP,

  -- Configuration
  report_config JSONB NOT NULL,
  /*
    Example:
    {
      "metrics": ["mrr", "tenant_count", "churn_rate"],
      "filters": { "plan_type": "Growth" },
      "date_range": "last_30_days",
      "format": "pdf",
      "charts": ["mrr_trend", "tenant_distribution"]
    }
  */

  -- Recipients
  recipients JSONB NOT NULL,            -- Email addresses
  /*
    Example:
    {
      "to": ["admin@cleanmatex.com"],
      "cc": ["finance@cleanmatex.com"],
      "bcc": []
    }
  */

  -- Delivery
  delivery_method VARCHAR(20) NOT NULL, -- 'email', 's3', 'api'
  delivery_config JSONB,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  last_run_status VARCHAR(20),          -- 'success', 'failed', 'running'

  -- Ownership
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by UUID,

  rec_status SMALLINT DEFAULT 1,
  rec_notes VARCHAR(200)
);

CREATE INDEX idx_reports_type ON platform_reports_mst(report_type);
CREATE INDEX idx_reports_schedule ON platform_reports_mst(schedule_type, next_run_at);
CREATE INDEX idx_reports_active ON platform_reports_mst(is_active);
```

**Table: `platform_report_runs_dtl`**
```sql
CREATE TABLE platform_report_runs_dtl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES platform_reports_mst(id) ON DELETE CASCADE,

  -- Execution details
  run_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL,          -- 'pending', 'running', 'success', 'failed'

  -- Results
  report_file_path VARCHAR(500),        -- S3/storage path
  report_file_size_kb INTEGER,
  report_format VARCHAR(10),            -- 'pdf', 'csv', 'xlsx'

  -- Performance
  execution_time_ms INTEGER,
  rows_processed INTEGER,

  -- Errors
  error_message TEXT,
  error_stack TEXT,

  -- Delivery
  delivered_at TIMESTAMP,
  delivery_status VARCHAR(20),          -- 'pending', 'sent', 'failed'
  delivery_error TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_runs_report ON platform_report_runs_dtl(report_id, run_date DESC);
CREATE INDEX idx_runs_date ON platform_report_runs_dtl(run_date DESC);
CREATE INDEX idx_runs_status ON platform_report_runs_dtl(status);
```

### 8.2 Analytics Views

**View: `v_platform_dashboard_metrics`**
```sql
CREATE VIEW v_platform_dashboard_metrics AS
SELECT
  -- Current metrics
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = true) as total_tenants,
  COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = true AND t.last_login_at > NOW() - INTERVAL '30 days') as active_tenants,

  -- Revenue (from latest revenue metrics)
  (SELECT mrr_total FROM platform_revenue_metrics ORDER BY metric_month DESC LIMIT 1) as current_mrr,
  (SELECT arr_total FROM platform_revenue_metrics ORDER BY metric_month DESC LIMIT 1) as current_arr,

  -- Health scores
  AVG(hs.overall_health_score) as avg_health_score,
  COUNT(*) FILTER (WHERE hs.risk_category = 'high' OR hs.risk_category = 'critical') as at_risk_tenants,

  -- Support
  COUNT(DISTINCT st.id) FILTER (WHERE st.status NOT IN ('closed', 'resolved')) as open_tickets,

  -- System (from metrics table)
  (SELECT metric_value_numeric
   FROM platform_metrics_agg
   WHERE metric_name = 'uptime_percentage'
   AND metric_date = CURRENT_DATE
   ORDER BY created_at DESC LIMIT 1) as uptime_percentage

FROM org_tenants_mst t
LEFT JOIN platform_tenant_health_scores hs ON t.id = hs.tenant_id
  AND hs.calculation_date = (SELECT MAX(calculation_date) FROM platform_tenant_health_scores WHERE tenant_id = t.id)
LEFT JOIN platform_support_tickets st ON t.id = st.tenant_id;
```

**View: `v_tenant_analytics_summary`**
```sql
CREATE VIEW v_tenant_analytics_summary AS
SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.plan_type,
  t.status,

  -- Health
  hs.overall_health_score,
  hs.churn_risk_score,
  hs.risk_category,

  -- Usage (last 30 days)
  COUNT(DISTINCT o.id) as orders_last_30d,
  COUNT(DISTINCT c.id) as customers_count,
  SUM(o.total_amount) as revenue_last_30d,

  -- Engagement
  t.last_login_at,
  COUNT(DISTINCT u.id) as active_users,

  -- Financial
  s.mrr as monthly_revenue,

  -- Support
  COUNT(DISTINCT st.id) FILTER (WHERE st.status NOT IN ('closed', 'resolved')) as open_tickets

FROM org_tenants_mst t
LEFT JOIN platform_tenant_health_scores hs ON t.id = hs.tenant_id
  AND hs.calculation_date = CURRENT_DATE
LEFT JOIN org_orders_mst o ON t.id = o.tenant_org_id
  AND o.created_at > NOW() - INTERVAL '30 days'
LEFT JOIN org_customers_mst c ON t.id = c.tenant_org_id
LEFT JOIN org_subscriptions_mst s ON t.id = s.tenant_org_id
  AND s.status = 'active'
LEFT JOIN org_users_mst u ON t.id = u.tenant_org_id
  AND u.last_login_at > NOW() - INTERVAL '30 days'
LEFT JOIN platform_support_tickets st ON t.id = st.tenant_id
GROUP BY t.id, t.name, t.plan_type, t.status, hs.overall_health_score,
         hs.churn_risk_score, hs.risk_category, t.last_login_at, s.mrr;
```

---

## 9. Data Collection & Aggregation

### 9.1 Collection Strategy

**Real-Time Metrics** (Event-Driven):
```typescript
// Collect metrics immediately when events occur
interface MetricEvent {
  type: 'order_created' | 'payment_processed' | 'user_login' | 'api_call';
  tenant_id?: string;
  timestamp: Date;
  data: any;
}

// Example: Order created event
async function trackOrderCreated(order: Order) {
  await metricsQueue.add('track-metric', {
    type: 'order_created',
    tenant_id: order.tenant_org_id,
    timestamp: new Date(),
    data: {
      order_id: order.id,
      order_value: order.total_amount,
      order_status: order.status
    }
  });
}
```

**Batch Aggregation** (Scheduled):
```typescript
// Run daily at 00:30 to aggregate previous day's data
async function aggregateDailyMetrics(date: Date) {
  // Tenant metrics
  await aggregateTenantMetrics(date);

  // Revenue metrics
  await aggregateRevenueMetrics(date);

  // Usage metrics
  await aggregateUsageMetrics(date);

  // System metrics
  await aggregateSystemMetrics(date);

  // Calculate health scores
  await calculateTenantHealthScores(date);
}
```

### 9.2 Aggregation Workers

**Worker: `analytics-aggregation-worker.ts`**
```typescript
import { Worker } from 'bullmq';
import { prisma } from '@cleanmatex/database';

const aggregationWorker = new Worker('analytics-aggregation-queue', async (job) => {
  const { date, aggregationType } = job.data;

  switch (aggregationType) {
    case 'daily_tenants':
      return await aggregateDailyTenantMetrics(date);

    case 'daily_revenue':
      return await aggregateDailyRevenueMetrics(date);

    case 'daily_usage':
      return await aggregateDailyUsageMetrics(date);

    case 'health_scores':
      return await calculateHealthScores(date);

    case 'monthly_revenue':
      return await aggregateMonthlyRevenueMetrics(date);
  }
});

async function aggregateDailyTenantMetrics(date: Date) {
  const metrics = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT id) FILTER (WHERE status = 'active') as active_tenants,
      COUNT(DISTINCT id) FILTER (WHERE created_at::date = ${date}) as new_tenants,
      COUNT(DISTINCT id) FILTER (WHERE status = 'churned' AND updated_at::date = ${date}) as churned_tenants,
      COUNT(DISTINCT id) FILTER (WHERE last_login_at::date = ${date}) as logged_in_today
    FROM org_tenants_mst
    WHERE created_at::date <= ${date}
  `;

  // Store aggregated metrics
  await prisma.platform_metrics_agg.createMany({
    data: [
      {
        metric_date: date,
        aggregation_level: 'daily',
        metric_category: 'tenant',
        metric_name: 'active_tenants',
        metric_value_numeric: metrics[0].active_tenants
      },
      {
        metric_date: date,
        aggregation_level: 'daily',
        metric_category: 'tenant',
        metric_name: 'new_tenants',
        metric_value_numeric: metrics[0].new_tenants
      },
      {
        metric_date: date,
        aggregation_level: 'daily',
        metric_category: 'tenant',
        metric_name: 'churned_tenants',
        metric_value_numeric: metrics[0].churned_tenants
      }
    ]
  });
}

async function calculateHealthScores(date: Date) {
  const tenants = await prisma.org_tenants_mst.findMany({
    where: { is_active: true },
    include: {
      subscription: true,
      orders: {
        where: {
          created_at: {
            gte: new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      },
      users: {
        where: {
          last_login_at: {
            gte: new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      },
      support_tickets: {
        where: {
          created_at: {
            gte: new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }
    }
  });

  for (const tenant of tenants) {
    const healthScore = await calculateTenantHealthScore(tenant);

    await prisma.platform_tenant_health_scores.create({
      data: {
        tenant_id: tenant.id,
        calculation_date: date,
        ...healthScore
      }
    });
  }
}
```

**Health Score Calculation:**
```typescript
interface HealthScoreComponents {
  overall_health_score: number;
  usage_score: number;
  engagement_score: number;
  financial_score: number;
  support_score: number;
  growth_score: number;
  churn_risk_score: number;
  risk_category: string;
  risk_factors: any;
}

async function calculateTenantHealthScore(tenant: any): Promise<HealthScoreComponents> {
  // Usage Score (0-100) - Based on order activity
  const usageScore = calculateUsageScore(tenant.orders.length);

  // Engagement Score (0-100) - Based on login frequency
  const engagementScore = calculateEngagementScore(
    tenant.users.filter(u => u.last_login_at).length,
    tenant.users.length
  );

  // Financial Score (0-100) - Based on payment history
  const financialScore = calculateFinancialScore(tenant.subscription);

  // Support Score (0-100) - Based on ticket volume (inverse)
  const supportScore = calculateSupportScore(tenant.support_tickets.length);

  // Growth Score (0-100) - Based on order growth trend
  const growthScore = calculateGrowthScore(tenant.orders);

  // Overall score (weighted average)
  const overall_health_score = Math.round(
    (usageScore * 0.3) +
    (engagementScore * 0.25) +
    (financialScore * 0.25) +
    (supportScore * 0.1) +
    (growthScore * 0.1)
  );

  // Churn risk calculation
  const churn_risk_score = 100 - overall_health_score;

  // Risk category
  let risk_category = 'low';
  if (churn_risk_score > 70) risk_category = 'critical';
  else if (churn_risk_score > 50) risk_category = 'high';
  else if (churn_risk_score > 30) risk_category = 'medium';

  // Identify risk factors
  const risk_factors: any = {};
  if (usageScore < 30) {
    risk_factors.low_usage = {
      severity: 'high',
      details: `Only ${tenant.orders.length} orders in last 30 days`
    };
  }
  if (engagementScore < 40) {
    risk_factors.low_engagement = {
      severity: 'high',
      details: `Low login activity`
    };
  }
  if (financialScore < 50) {
    risk_factors.payment_issues = {
      severity: 'critical',
      details: 'Payment failures detected'
    };
  }

  return {
    overall_health_score,
    usage_score: usageScore,
    engagement_score: engagementScore,
    financial_score: financialScore,
    support_score: supportScore,
    growth_score: growthScore,
    churn_risk_score,
    risk_category,
    risk_factors
  };
}

function calculateUsageScore(orderCount: number): number {
  // Score based on order volume
  // 0 orders = 0, 100+ orders = 100
  return Math.min(100, orderCount);
}

function calculateEngagementScore(activeUsers: number, totalUsers: number): number {
  if (totalUsers === 0) return 0;
  const ratio = activeUsers / totalUsers;
  return Math.round(ratio * 100);
}

function calculateFinancialScore(subscription: any): number {
  if (!subscription) return 0;

  let score = 100;

  // Deduct for payment failures
  if (subscription.payment_failures > 0) {
    score -= subscription.payment_failures * 20;
  }

  // Deduct for overdue invoices
  if (subscription.overdue_amount > 0) {
    score -= 30;
  }

  return Math.max(0, score);
}

function calculateSupportScore(ticketCount: number): number {
  // Lower ticket count = higher score
  // 0 tickets = 100, 10+ tickets = 0
  return Math.max(0, 100 - (ticketCount * 10));
}

function calculateGrowthScore(orders: any[]): number {
  // Compare first half vs. second half of period
  if (orders.length === 0) return 0;

  const midpoint = 15; // 15 days ago
  const recent = orders.filter(o =>
    (new Date().getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24) < midpoint
  ).length;
  const older = orders.length - recent;

  if (older === 0) return 100; // All orders are recent

  const growthRate = ((recent - older) / older) * 100;
  return Math.min(100, Math.max(0, 50 + growthRate));
}
```

### 9.3 Scheduled Jobs

**Cron Jobs:**
```typescript
import cron from 'node-cron';
import { analyticsQueue } from './queues';

// Daily aggregation at 00:30
cron.schedule('30 0 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await analyticsQueue.add('aggregate-daily-metrics', {
    date: yesterday
  });
});

// Hourly metrics collection
cron.schedule('0 * * * *', async () => {
  await analyticsQueue.add('aggregate-hourly-metrics', {
    date: new Date()
  });
});

// Monthly revenue aggregation on 1st of month at 02:00
cron.schedule('0 2 1 * *', async () => {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  await analyticsQueue.add('aggregate-monthly-revenue', {
    month: lastMonth
  });
});

// Health score calculation - daily at 01:00
cron.schedule('0 1 * * *', async () => {
  await analyticsQueue.add('calculate-health-scores', {
    date: new Date()
  });
});
```

---

## 10. API Specifications

### 10.1 Dashboard Metrics API

**Endpoint:** `GET /api/v1/platform/analytics/dashboard`

**Description:** Get real-time metrics for executive dashboard

**Authentication:** Platform Admin JWT

**Request:**
```http
GET /api/v1/platform/analytics/dashboard HTTP/1.1
Host: api-platform.cleanmatex.com
Authorization: Bearer <platform_admin_jwt>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tenants": {
      "total": 127,
      "active": 118,
      "new_this_month": 8,
      "churned_this_month": 4,
      "growth_rate": 6.7
    },
    "revenue": {
      "mrr": 45250.00,
      "arr": 543000.00,
      "mrr_growth_rate": 12.5,
      "mrr_trend": [
        { "month": "2024-07", "value": 32500 },
        { "month": "2024-08", "value": 35200 },
        { "month": "2024-09", "value": 38100 },
        { "month": "2024-10", "value": 40300 },
        { "month": "2024-11", "value": 42800 },
        { "month": "2024-12", "value": 45250 }
      ]
    },
    "health": {
      "average_score": 72,
      "at_risk_count": 16,
      "high_performers": 45,
      "distribution": {
        "excellent": 45,
        "good": 38,
        "fair": 28,
        "at_risk": 16
      }
    },
    "support": {
      "open_tickets": 23,
      "avg_resolution_time_hours": 4.2,
      "satisfaction_score": 4.3
    },
    "system": {
      "uptime_percentage": 99.97,
      "avg_response_time_ms": 245,
      "error_rate": 0.08
    }
  },
  "meta": {
    "generated_at": "2025-01-14T10:30:00Z",
    "data_freshness_minutes": 2
  }
}
```

### 10.2 Tenant Health API

**Endpoint:** `GET /api/v1/platform/analytics/tenants/health`

**Description:** Get health scores and risk analysis for all tenants

**Authentication:** Platform Admin JWT

**Query Parameters:**
- `risk_category` (optional): Filter by risk category ('low', 'medium', 'high', 'critical')
- `min_score` (optional): Minimum health score
- `max_score` (optional): Maximum health score
- `sort` (optional): Sort field ('score', 'risk', 'name')
- `order` (optional): Sort order ('asc', 'desc')
- `limit` (optional): Results per page (default: 20)
- `offset` (optional): Pagination offset

**Request:**
```http
GET /api/v1/platform/analytics/tenants/health?risk_category=high&limit=10 HTTP/1.1
Host: api-platform.cleanmatex.com
Authorization: Bearer <platform_admin_jwt>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tenant_id": "uuid-123",
      "tenant_name": "Quick Clean Laundry",
      "health_score": 38,
      "churn_risk_score": 62,
      "risk_category": "high",
      "risk_factors": {
        "low_usage": {
          "severity": "high",
          "details": "Only 8 orders in last 30 days"
        },
        "no_recent_login": {
          "severity": "medium",
          "details": "No login in 12 days"
        }
      },
      "recommended_actions": [
        "Contact tenant to offer assistance",
        "Review their usage patterns",
        "Offer training or onboarding refresh"
      ],
      "trend": "declining",
      "previous_score": 52,
      "calculated_at": "2025-01-14T01:00:00Z"
    }
  ],
  "pagination": {
    "total": 16,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### 10.3 Revenue Analytics API

**Endpoint:** `GET /api/v1/platform/analytics/revenue`

**Description:** Get detailed revenue analytics

**Authentication:** Platform Admin JWT

**Query Parameters:**
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `granularity` (optional): 'daily', 'weekly', 'monthly' (default: 'monthly')
- `breakdown_by` (optional): 'plan', 'region', 'tenant'

**Request:**
```http
GET /api/v1/platform/analytics/revenue?start_date=2024-01-01&end_date=2024-12-31&granularity=monthly&breakdown_by=plan HTTP/1.1
Host: api-platform.cleanmatex.com
Authorization: Bearer <platform_admin_jwt>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_revenue": 543000.00,
      "mrr": 45250.00,
      "arr": 543000.00,
      "growth_rate": 45.2,
      "paying_tenants": 112
    },
    "mrr_breakdown": {
      "mrr_new": 5200.00,
      "mrr_expansion": 2800.00,
      "mrr_contraction": -850.00,
      "mrr_churned": -1450.00,
      "net_mrr_growth": 5700.00
    },
    "by_plan": [
      {
        "plan_type": "Free",
        "tenants": 19,
        "revenue": 0,
        "percentage": 0
      },
      {
        "plan_type": "Starter",
        "tenants": 38,
        "revenue": 13575.00,
        "percentage": 30
      },
      {
        "plan_type": "Growth",
        "tenants": 44,
        "revenue": 15837.50,
        "percentage": 35
      },
      {
        "plan_type": "Pro",
        "tenants": 26,
        "revenue": 9050.00,
        "percentage": 20
      }
    ],
    "trend": [
      { "month": "2024-01", "mrr": 31200, "arr": 374400, "paying_tenants": 87 },
      { "month": "2024-02", "mrr": 32800, "arr": 393600, "paying_tenants": 91 },
      { "month": "2024-03", "mrr": 34500, "arr": 414000, "paying_tenants": 96 },
      { "month": "2024-12", "mrr": 45250, "arr": 543000, "paying_tenants": 112 }
    ],
    "forecast": {
      "next_month_mrr": 47800,
      "confidence": 0.85,
      "model": "linear_regression"
    }
  },
  "meta": {
    "generated_at": "2025-01-14T10:35:00Z"
  }
}
```

### 10.4 Usage Analytics API

**Endpoint:** `GET /api/v1/platform/analytics/usage`

**Description:** Get platform-wide usage metrics

**Authentication:** Platform Admin JWT

**Query Parameters:**
- `start_date` (required)
- `end_date` (required)
- `metric_type` (optional): 'orders', 'storage', 'api_calls', 'users'
- `tenant_id` (optional): Filter by specific tenant

**Request:**
```http
GET /api/v1/platform/analytics/usage?start_date=2024-12-01&end_date=2024-12-31&metric_type=orders HTTP/1.1
Host: api-platform.cleanmatex.com
Authorization: Bearer <platform_admin_jwt>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_orders": 45230,
      "total_customers": 12450,
      "storage_used_gb": 1245.6,
      "api_calls": 2400000,
      "active_users": 1543
    },
    "trends": {
      "orders_per_day": [
        { "date": "2024-12-01", "count": 1423 },
        { "date": "2024-12-02", "count": 1502 },
        { "date": "2024-12-31", "count": 1389 }
      ]
    },
    "top_tenants": [
      {
        "tenant_id": "uuid-1",
        "tenant_name": "Luxury Laundry",
        "orders": 3245,
        "percentage": 7.2
      }
    ],
    "peak_usage": {
      "day_of_week": "Tuesday",
      "hour_of_day": 11,
      "avg_concurrent_users": 245
    }
  }
}
```

### 10.5 Custom Report API

**Endpoint:** `POST /api/v1/platform/analytics/reports/custom`

**Description:** Create and execute custom report

**Authentication:** Platform Admin JWT

**Request:**
```json
{
  "report_name": "Top Performing Tenants - Q1 2025",
  "metrics": ["mrr", "order_count", "growth_rate", "health_score"],
  "filters": {
    "plan_type": ["Growth", "Pro"],
    "health_score": { "min": 70 },
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-03-31"
    }
  },
  "sort": {
    "field": "growth_rate",
    "order": "desc"
  },
  "limit": 20,
  "format": "excel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid-report-123",
    "status": "processing",
    "estimated_completion": "2025-01-14T10:38:00Z"
  }
}
```

**Poll for completion:**
```http
GET /api/v1/platform/analytics/reports/custom/uuid-report-123
```

**Response (when complete):**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid-report-123",
    "status": "completed",
    "download_url": "https://storage.cleanmatex.com/reports/uuid-report-123.xlsx",
    "expires_at": "2025-01-21T10:40:00Z",
    "file_size_kb": 245
  }
}
```

### 10.6 Export Data API

**Endpoint:** `POST /api/v1/platform/analytics/export`

**Description:** Export raw data for external analysis

**Authentication:** Platform Admin JWT

**Request:**
```json
{
  "data_type": "tenant_metrics",
  "format": "csv",
  "columns": ["tenant_id", "tenant_name", "mrr", "health_score", "order_count"],
  "filters": {
    "status": "active",
    "created_after": "2024-01-01"
  },
  "delivery": {
    "method": "email",
    "email": "admin@cleanmatex.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Export queued successfully",
  "export_id": "uuid-export-456",
  "estimated_completion": "2025-01-14T10:45:00Z"
}
```

---

## 11. UI/UX Design

### 11.1 Navigation Structure

**Main Menu:**
```
Platform HQ Console
├── 📊 Dashboard (Executive)
├── 💰 Revenue Analytics
├── 🏥 Tenant Health
├── 📈 Usage Analytics
├── 📋 Reports
│   ├── Scheduled Reports
│   ├── Custom Reports
│   └── Report History
├── 📤 Exports
└── ⚙️ Settings
```

### 11.2 Dashboard Components

**KPI Cards:**
- Large, prominent numbers
- Trend indicators (▲ ▼)
- Color coding (green = good, red = bad)
- Sparkline mini-charts
- Click to drill down

**Charts:**
- **Line Charts**: Trends over time (MRR, tenant count)
- **Bar Charts**: Comparisons (revenue by plan)
- **Pie Charts**: Distribution (health score categories)
- **Heatmaps**: Usage patterns (time-based)
- **Gauges**: Single metrics (health score, uptime)

**Tables:**
- Sortable columns
- Filterable rows
- Pagination
- Export to CSV
- Inline actions
- Row expansion for details

### 11.3 Interactive Features

**Date Range Selector:**
```
┌─────────────────────────────────────────┐
│ Date Range: [Last 30 Days ▼]            │
│                                         │
│ Quick Ranges:                           │
│ • Today                                 │
│ • Last 7 Days                          │
│ • Last 30 Days                         │
│ • Last 90 Days                         │
│ • This Month                           │
│ • Last Month                           │
│ • This Quarter                         │
│ • Custom Range                         │
└─────────────────────────────────────────┘
```

**Filters Panel:**
```
┌─────────────────────────────────────────┐
│ Filters                                  │
├─────────────────────────────────────────┤
│ Plan Type:                              │
│ ☐ Free                                  │
│ ☑ Starter                               │
│ ☑ Growth                                │
│ ☑ Pro                                   │
│                                         │
│ Health Score:                           │
│ Min: [0   ] Max: [100  ]               │
│                                         │
│ Status:                                 │
│ ☑ Active                                │
│ ☐ Suspended                             │
│ ☐ Churned                               │
│                                         │
│ [Apply Filters] [Reset]                 │
└─────────────────────────────────────────┘
```

**Chart Controls:**
```
┌─────────────────────────────────────────┐
│ MRR Trend                               │
│ [Line ▼] [Export 📊] [Fullscreen ⛶]   │
├─────────────────────────────────────────┤
│                                         │
│ [Chart displays here]                   │
│                                         │
└─────────────────────────────────────────┘
```

### 11.4 Responsive Design

**Desktop (1920px):**
- 3-column layout for KPI cards
- Full-width charts
- Side-by-side tables

**Tablet (768px):**
- 2-column layout for KPI cards
- Stacked charts
- Full-width tables with horizontal scroll

**Mobile (375px):**
- Single column layout
- Simplified charts
- Mobile-optimized tables (card view)

### 11.5 Color Scheme

**Status Colors:**
- 🟢 Green (#10B981): Positive trends, healthy metrics
- 🟡 Yellow (#F59E0B): Warnings, at-risk
- 🔴 Red (#EF4444): Critical issues, declining metrics
- 🔵 Blue (#3B82F6): Neutral information

**Chart Palette:**
- Primary: #3B82F6
- Secondary: #8B5CF6
- Success: #10B981
- Warning: #F59E0B
- Danger: #EF4444
- Info: #06B6D4

---

## 12. Real-Time Analytics

### 12.1 WebSocket Updates

**Connection:**
```typescript
// platform-web/lib/websocket.ts
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_PLATFORM_API_URL!, {
  auth: {
    token: getPlatformAdminToken()
  }
});

// Subscribe to real-time metrics
socket.on('metrics:update', (data) => {
  updateDashboard(data);
});

socket.on('tenant:health:alert', (alert) => {
  showHealthAlert(alert);
});

socket.on('revenue:milestone', (milestone) => {
  showRevenueMilestone(milestone);
});
```

**Server-Side (platform-api):**
```typescript
// platform-api/src/analytics/analytics.gateway.ts
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class AnalyticsGateway {
  @WebSocketServer()
  server: Server;

  // Broadcast metric update to all connected platform admins
  broadcastMetricUpdate(metric: any) {
    this.server.emit('metrics:update', metric);
  }

  // Alert when tenant health drops below threshold
  alertTenantHealth(alert: any) {
    this.server.emit('tenant:health:alert', alert);
  }

  // Celebrate revenue milestones
  celebrateRevenueMilestone(milestone: any) {
    this.server.emit('revenue:milestone', milestone);
  }
}
```

### 12.2 Live Metrics Ticker

**Component:**
```tsx
// platform-web/components/LiveMetricsTicker.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/lib/websocket';

export function LiveMetricsTicker() {
  const [metrics, setMetrics] = useState({
    ordersToday: 0,
    activeUsers: 0,
    revenueToday: 0
  });

  const socket = useWebSocket();

  useEffect(() => {
    socket.on('metrics:realtime', (data) => {
      setMetrics(prev => ({
        ordersToday: data.orders_today || prev.ordersToday,
        activeUsers: data.active_users || prev.activeUsers,
        revenueToday: data.revenue_today || prev.revenueToday
      }));
    });
  }, [socket]);

  return (
    <div className="bg-blue-50 border-b border-blue-100 px-6 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <span className="text-blue-600 font-medium">🔴 LIVE</span>
          <span>Orders Today: <strong>{metrics.ordersToday}</strong></span>
          <span>Active Users: <strong>{metrics.activeUsers}</strong></span>
          <span>Revenue Today: <strong>${metrics.revenueToday.toFixed(2)}</strong></span>
        </div>
        <span className="text-blue-500 text-xs">
          Updated 2 seconds ago
        </span>
      </div>
    </div>
  );
}
```

### 12.3 Auto-Refresh

**Configuration:**
```typescript
// Auto-refresh dashboard every 5 minutes
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

useEffect(() => {
  const interval = setInterval(() => {
    refetchDashboardData();
  }, REFRESH_INTERVAL);

  return () => clearInterval(interval);
}, []);
```

---

## 13. Export & Scheduling

### 13.1 Export Formats

**CSV Export:**
```typescript
async function exportToCSV(data: any[], filename: string) {
  const csv = Papa.unparse(data, {
    quotes: true,
    header: true
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString()}.csv`;
  link.click();
}
```

**Excel Export:**
```typescript
import * as XLSX from 'xlsx';

async function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  // Add formatting
  worksheet['!cols'] = [
    { wch: 20 }, // Column A width
    { wch: 15 }, // Column B width
    { wch: 10 }  // Column C width
  ];

  XLSX.writeFile(workbook, `${filename}_${new Date().toISOString()}.xlsx`);
}
```

**PDF Export:**
```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

async function exportToPDF(data: any[], filename: string) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text('CleanMateX Platform Report', 14, 22);
  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  // Table
  autoTable(doc, {
    head: [['Tenant', 'MRR', 'Health Score', 'Status']],
    body: data.map(row => [
      row.tenant_name,
      `$${row.mrr.toFixed(2)}`,
      row.health_score,
      row.status
    ]),
    startY: 40,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(`${filename}_${new Date().toISOString()}.pdf`);
}
```

### 13.2 Scheduled Reports

**Report Scheduler:**
```typescript
// platform-workers/src/jobs/scheduled-reports.ts
import cron from 'node-cron';
import { generateReport } from './report-generator';
import { sendEmail } from './email-service';

// Daily executive summary at 8 AM
cron.schedule('0 8 * * *', async () => {
  const report = await generateReport({
    type: 'executive_summary',
    date: new Date()
  });

  await sendEmail({
    to: ['admin@cleanmatex.com'],
    subject: `Daily Executive Summary - ${new Date().toLocaleDateString()}`,
    attachments: [
      {
        filename: 'executive_summary.pdf',
        content: report.pdf
      }
    ]
  });
});

// Weekly revenue report on Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  const report = await generateReport({
    type: 'weekly_revenue',
    startDate: getLastWeekStart(),
    endDate: getLastWeekEnd()
  });

  await sendEmail({
    to: ['finance@cleanmatex.com'],
    subject: 'Weekly Revenue Report',
    attachments: [
      {
        filename: 'weekly_revenue.xlsx',
        content: report.excel
      }
    ]
  });
});

// Monthly comprehensive report on 1st at 10 AM
cron.schedule('0 10 1 * *', async () => {
  const report = await generateReport({
    type: 'monthly_comprehensive',
    month: getLastMonth()
  });

  await sendEmail({
    to: ['admin@cleanmatex.com', 'finance@cleanmatex.com'],
    subject: 'Monthly Platform Report',
    attachments: [
      {
        filename: 'monthly_report.pdf',
        content: report.pdf
      }
    ]
  });
});
```

### 13.3 Email Templates

**Executive Summary Email:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .header { background: #3B82F6; color: white; padding: 20px; }
    .metric { background: #F3F4F6; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .positive { color: #10B981; }
    .negative { color: #EF4444; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CleanMateX Platform - Daily Summary</h1>
    <p>{{date}}</p>
  </div>

  <div class="metric">
    <h3>Total Tenants: {{total_tenants}}</h3>
    <p class="{{tenant_trend_class}}">{{tenant_trend}}</p>
  </div>

  <div class="metric">
    <h3>MRR: ${{mrr}}</h3>
    <p class="{{mrr_trend_class}}">{{mrr_trend}}</p>
  </div>

  <div class="metric">
    <h3>At-Risk Tenants: {{at_risk_count}}</h3>
    <ul>
      {{#each at_risk_tenants}}
      <li>{{name}} (Score: {{health_score}})</li>
      {{/each}}
    </ul>
  </div>

  <p>Full report attached as PDF.</p>
</body>
</html>
```

---

## 14. Predictive Analytics

### 14.1 Churn Prediction Model

**Features for Prediction:**
```typescript
interface ChurnPredictionFeatures {
  // Usage features
  orders_last_30d: number;
  orders_trend: number;              // Percentage change
  active_users_ratio: number;
  login_frequency: number;

  // Engagement features
  features_used_count: number;
  last_login_days_ago: number;
  session_duration_avg: number;

  // Financial features
  payment_failures: number;
  days_overdue: number;
  revenue_trend: number;

  // Support features
  open_tickets: number;
  avg_resolution_time: number;
  satisfaction_score: number;

  // Tenure
  days_since_signup: number;
  plan_type: string;
}
```

**Simple Churn Scoring:**
```typescript
function calculateChurnRiskScore(features: ChurnPredictionFeatures): number {
  let riskScore = 0;

  // Usage factors (40% weight)
  if (features.orders_last_30d < 10) riskScore += 20;
  if (features.orders_trend < -20) riskScore += 20;

  // Engagement factors (25% weight)
  if (features.last_login_days_ago > 14) riskScore += 15;
  if (features.active_users_ratio < 0.3) riskScore += 10;

  // Financial factors (25% weight)
  if (features.payment_failures > 0) riskScore += 15;
  if (features.days_overdue > 7) riskScore += 10;

  // Support factors (10% weight)
  if (features.open_tickets > 3) riskScore += 5;
  if (features.satisfaction_score < 3) riskScore += 5;

  return Math.min(100, riskScore);
}
```

**Advanced ML Model (Future):**
```python
# Future implementation with scikit-learn
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# Train churn prediction model
def train_churn_model(historical_data):
    X = historical_data[features]
    y = historical_data['churned']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    accuracy = model.score(X_test, y_test)
    print(f"Model accuracy: {accuracy}")

    return model

# Predict churn for active tenants
def predict_churn(tenant_features):
    probability = model.predict_proba([tenant_features])[0][1]
    return probability * 100  # Return as percentage
```

### 14.2 Revenue Forecasting

**Linear Regression Forecast:**
```typescript
function forecastMRR(historicalData: RevenueMetric[], monthsAhead: number): number[] {
  // Simple linear regression
  const n = historicalData.length;
  const x = historicalData.map((_, i) => i);
  const y = historicalData.map(d => d.mrr_total);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Generate forecast
  const forecast = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const forecastValue = slope * (n + i - 1) + intercept;
    forecast.push(forecastValue);
  }

  return forecast;
}
```

**Example Usage:**
```typescript
const historicalRevenue = await getHistoricalRevenue(12); // Last 12 months
const forecast = forecastMRR(historicalRevenue, 6); // Next 6 months

console.log('MRR Forecast:');
forecast.forEach((mrr, i) => {
  console.log(`Month ${i+1}: $${mrr.toFixed(2)}`);
});

// Output:
// MRR Forecast:
// Month 1: $47,823.50
// Month 2: $50,102.75
// Month 3: $52,381.00
// ...
```

### 14.3 Growth Opportunity Identification

**Upsell Opportunities:**
```typescript
async function identifyUpsellOpportunities(): Promise<UpsellOpportunity[]> {
  const opportunities = await prisma.$queryRaw`
    SELECT
      t.id as tenant_id,
      t.name as tenant_name,
      t.plan_type as current_plan,
      COUNT(o.id) as orders_last_30d,
      SUM(o.total_amount) as revenue_last_30d,
      t.storage_used_gb,
      COUNT(DISTINCT u.id) as active_users,

      -- Identify constraints
      CASE
        WHEN COUNT(o.id) > (pl.order_limit * 0.8) THEN 'approaching_order_limit'
        WHEN t.storage_used_gb > (pl.storage_limit_gb * 0.8) THEN 'approaching_storage_limit'
        WHEN COUNT(DISTINCT u.id) > (pl.user_limit * 0.8) THEN 'approaching_user_limit'
        ELSE NULL
      END as constraint_type,

      -- Suggest next plan
      CASE
        WHEN t.plan_type = 'Starter' THEN 'Growth'
        WHEN t.plan_type = 'Growth' THEN 'Pro'
        WHEN t.plan_type = 'Pro' THEN 'Enterprise'
        ELSE NULL
      END as suggested_plan

    FROM org_tenants_mst t
    INNER JOIN org_subscriptions_mst s ON t.id = s.tenant_org_id
    INNER JOIN sys_plans_mst pl ON s.plan_type = pl.plan_type
    LEFT JOIN org_orders_mst o ON t.id = o.tenant_org_id
      AND o.created_at > NOW() - INTERVAL '30 days'
    LEFT JOIN org_users_mst u ON t.id = u.tenant_org_id
      AND u.last_login_at > NOW() - INTERVAL '30 days'

    WHERE t.is_active = true
      AND t.plan_type != 'Enterprise'
      AND (
        COUNT(o.id) > (pl.order_limit * 0.8) OR
        t.storage_used_gb > (pl.storage_limit_gb * 0.8) OR
        COUNT(DISTINCT u.id) > (pl.user_limit * 0.8)
      )

    GROUP BY t.id, t.name, t.plan_type, t.storage_used_gb, pl.order_limit,
             pl.storage_limit_gb, pl.user_limit

    ORDER BY revenue_last_30d DESC
  `;

  return opportunities;
}
```

**Expected Output:**
```json
[
  {
    "tenant_id": "uuid-1",
    "tenant_name": "Luxury Laundry",
    "current_plan": "Growth",
    "orders_last_30d": 890,
    "revenue_last_30d": 8450.00,
    "storage_used_gb": 82.5,
    "active_users": 12,
    "constraint_type": "approaching_order_limit",
    "suggested_plan": "Pro",
    "upsell_value": 150.00,
    "confidence": 0.92
  }
]
```

---

## 15. Security & Privacy

### 15.1 Data Access Control

**Role-Based Access:**
```typescript
enum PlatformAdminRole {
  SUPER_ADMIN = 'super_admin',       // Full access
  FINANCE_MANAGER = 'finance_manager', // Revenue data only
  ANALYST = 'analyst',                 // Read-only analytics
  SUPPORT_STAFF = 'support_staff'      // Limited tenant data
}

interface AnalyticsPermissions {
  canViewRevenue: boolean;
  canViewTenantDetails: boolean;
  canExportData: boolean;
  canScheduleReports: boolean;
  canViewPII: boolean;                 // Personal Identifiable Information
}

function getPermissions(role: PlatformAdminRole): AnalyticsPermissions {
  switch (role) {
    case PlatformAdminRole.SUPER_ADMIN:
      return {
        canViewRevenue: true,
        canViewTenantDetails: true,
        canExportData: true,
        canScheduleReports: true,
        canViewPII: true
      };

    case PlatformAdminRole.FINANCE_MANAGER:
      return {
        canViewRevenue: true,
        canViewTenantDetails: false,
        canExportData: true,
        canScheduleReports: true,
        canViewPII: false
      };

    case PlatformAdminRole.ANALYST:
      return {
        canViewRevenue: true,
        canViewTenantDetails: true,
        canExportData: false,
        canScheduleReports: false,
        canViewPII: false
      };

    case PlatformAdminRole.SUPPORT_STAFF:
      return {
        canViewRevenue: false,
        canViewTenantDetails: true,
        canExportData: false,
        canScheduleReports: false,
        canViewPII: false
      };
  }
}
```

### 15.2 Audit Logging

**Track all analytics access:**
```typescript
// Log analytics access
async function logAnalyticsAccess(access: AnalyticsAccessLog) {
  await prisma.platform_analytics_access_log.create({
    data: {
      admin_user_id: access.admin_user_id,
      action: access.action,            // 'view_dashboard', 'export_data', 'run_report'
      resource_type: access.resource_type, // 'revenue', 'health', 'usage'
      resource_id: access.resource_id,  // Specific report/dashboard ID
      tenant_ids_accessed: access.tenant_ids, // For tenant-specific queries
      ip_address: access.ip_address,
      user_agent: access.user_agent,
      timestamp: new Date()
    }
  });
}
```

### 15.3 Data Anonymization

**Anonymize tenant data for analysts:**
```typescript
function anonymizeTenantData(tenant: Tenant, userRole: PlatformAdminRole): AnonymizedTenant {
  if (userRole === PlatformAdminRole.SUPER_ADMIN ||
      userRole === PlatformAdminRole.FINANCE_MANAGER) {
    return tenant; // Full access
  }

  // Anonymize for analysts
  return {
    ...tenant,
    name: `Tenant ${hashString(tenant.id).substring(0, 6)}`,
    email: null,
    phone: null,
    owner_name: null,
    address: null
  };
}
```

### 15.4 Rate Limiting

**Prevent abuse of analytics APIs:**
```typescript
import rateLimit from 'express-rate-limit';

const analyticsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each admin to 100 requests per window
  message: 'Too many analytics requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Apply to analytics routes
app.use('/api/v1/platform/analytics', analyticsRateLimiter);
```

---

## 16. Performance Considerations

### 16.1 Database Optimization

**Partitioning for large tables:**
```sql
-- Partition metrics table by date
CREATE TABLE platform_metrics_agg_2025_01
  PARTITION OF platform_metrics_agg
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE platform_metrics_agg_2025_02
  PARTITION OF platform_metrics_agg
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

**Materialized Views:**
```sql
-- Pre-calculate common aggregations
CREATE MATERIALIZED VIEW mv_daily_platform_summary AS
SELECT
  metric_date,
  COUNT(DISTINCT tenant_id) as active_tenants,
  SUM(CASE WHEN metric_name = 'orders_count' THEN metric_value_numeric ELSE 0 END) as total_orders,
  AVG(CASE WHEN metric_name = 'health_score' THEN metric_value_numeric ELSE NULL END) as avg_health_score
FROM platform_metrics_agg
WHERE aggregation_level = 'daily'
GROUP BY metric_date;

-- Refresh daily
CREATE INDEX ON mv_daily_platform_summary (metric_date DESC);
REFRESH MATERIALIZED VIEW mv_daily_platform_summary;
```

**Indexes:**
```sql
-- Composite indexes for common queries
CREATE INDEX idx_metrics_tenant_date ON platform_metrics_agg(tenant_id, metric_date DESC);
CREATE INDEX idx_metrics_category_date ON platform_metrics_agg(metric_category, metric_name, metric_date DESC);
CREATE INDEX idx_health_scores_date ON platform_tenant_health_scores(calculation_date DESC, overall_health_score);
```

### 16.2 Caching Strategy

**Cache dashboard data:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getDashboardMetrics() {
  const cacheKey = 'dashboard:metrics:platform';

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Calculate from database
  const metrics = await calculateDashboardMetrics();

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(metrics));

  return metrics;
}
```

**Cache invalidation:**
```typescript
// Invalidate cache when new data arrives
async function invalidateDashboardCache() {
  await redis.del('dashboard:metrics:platform');
  await redis.del('dashboard:revenue:*');
  await redis.del('dashboard:health:*');
}
```

### 16.3 Query Optimization

**Avoid N+1 queries:**
```typescript
// ❌ Bad: N+1 queries
const tenants = await prisma.org_tenants_mst.findMany();
for (const tenant of tenants) {
  const health = await prisma.platform_tenant_health_scores.findFirst({
    where: { tenant_id: tenant.id }
  });
}

// ✅ Good: Single query with join
const tenants = await prisma.org_tenants_mst.findMany({
  include: {
    health_scores: {
      orderBy: { calculation_date: 'desc' },
      take: 1
    }
  }
});
```

**Pagination:**
```typescript
// Always paginate large result sets
async function getTenantsHealth(page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const [tenants, total] = await Promise.all([
    prisma.org_tenants_mst.findMany({
      skip: offset,
      take: limit,
      include: { health_scores: true }
    }),
    prisma.org_tenants_mst.count()
  ]);

  return {
    data: tenants,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
}
```

### 16.4 Background Processing

**Offload heavy calculations to workers:**
```typescript
// Instead of calculating on-demand, queue job
async function requestHealthScoreRecalculation(tenantId: string) {
  await analyticsQueue.add('calculate-health-score', {
    tenant_id: tenantId
  }, {
    priority: 2,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  return { message: 'Calculation queued' };
}
```

---

## 17. Implementation Plan

### 17.1 Phase 1: Core Analytics (Weeks 1-4)

**Week 1: Database Schema**
- [ ] Create `platform_metrics_agg` table
- [ ] Create `platform_tenant_health_scores` table
- [ ] Create `platform_revenue_metrics` table
- [ ] Create indexes and partitions
- [ ] Set up materialized views

**Week 2: Data Collection**
- [ ] Implement event tracking for orders, payments, logins
- [ ] Build metrics aggregation worker
- [ ] Implement daily aggregation jobs
- [ ] Create health score calculation logic

**Week 3: Dashboard API**
- [ ] Build dashboard metrics API
- [ ] Implement revenue analytics API
- [ ] Create tenant health API
- [ ] Add usage analytics API

**Week 4: Frontend Dashboard**
- [ ] Build executive dashboard UI
- [ ] Create revenue dashboard
- [ ] Implement tenant health dashboard
- [ ] Add usage analytics dashboard

### 17.2 Phase 2: Reporting & Export (Weeks 5-6)

**Week 5: Reports**
- [ ] Create report templates (PDF, Excel)
- [ ] Build report generation worker
- [ ] Implement scheduled reports
- [ ] Add email delivery for reports

**Week 6: Exports**
- [ ] Implement CSV export
- [ ] Add Excel export with formatting
- [ ] Create PDF export
- [ ] Build custom query builder UI

### 17.3 Phase 3: Advanced Analytics (Weeks 7-8)

**Week 7: Predictions**
- [ ] Implement churn risk scoring
- [ ] Build revenue forecasting
- [ ] Add upsell opportunity identification
- [ ] Create growth predictions

**Week 8: Real-Time**
- [ ] Set up WebSocket connections
- [ ] Implement live metrics ticker
- [ ] Add real-time alerts
- [ ] Build notification system

---

## 18. Testing Strategy

### 18.1 Unit Tests

**Health Score Calculation:**
```typescript
describe('Health Score Calculation', () => {
  it('should calculate correct usage score', () => {
    const score = calculateUsageScore(75);
    expect(score).toBe(75);
  });

  it('should cap usage score at 100', () => {
    const score = calculateUsageScore(150);
    expect(score).toBe(100);
  });

  it('should assign correct risk category', () => {
    expect(getRiskCategory(85)).toBe('critical');
    expect(getRiskCategory(65)).toBe('high');
    expect(getRiskCategory(45)).toBe('medium');
    expect(getRiskCategory(20)).toBe('low');
  });
});
```

**Revenue Calculations:**
```typescript
describe('Revenue Metrics', () => {
  it('should calculate MRR correctly', () => {
    const tenants = [
      { mrr: 100 },
      { mrr: 200 },
      { mrr: 150 }
    ];
    const totalMRR = calculateTotalMRR(tenants);
    expect(totalMRR).toBe(450);
  });

  it('should calculate growth rate correctly', () => {
    const previous = 40000;
    const current = 45000;
    const growthRate = calculateGrowthRate(previous, current);
    expect(growthRate).toBe(12.5);
  });
});
```

### 18.2 Integration Tests

**API Tests:**
```typescript
describe('Analytics API', () => {
  it('should return dashboard metrics', async () => {
    const response = await request(app)
      .get('/api/v1/platform/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('tenants');
    expect(response.body.data).toHaveProperty('revenue');
    expect(response.body.data).toHaveProperty('health');
  });

  it('should filter tenant health by risk category', async () => {
    const response = await request(app)
      .get('/api/v1/platform/analytics/tenants/health?risk_category=high')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.every(t => t.risk_category === 'high')).toBe(true);
  });
});
```

### 18.3 Performance Tests

**Load Testing:**
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% under 2s
  },
};

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${__ENV.ADMIN_TOKEN}`,
    },
  };

  const res = http.get('http://api-platform.cleanmatex.com/api/v1/platform/analytics/dashboard', params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

---

## 19. Monitoring & Observability

### 19.1 Metrics to Track

**Analytics System Health:**
- Aggregation job success rate
- Average aggregation time
- Cache hit rate
- API response times
- Database query performance
- Export generation time

**Data Quality:**
- Data freshness (time since last update)
- Missing metrics count
- Data validation errors
- Outlier detection

### 19.2 Alerts

**Critical Alerts:**
- Aggregation job failures
- Dashboard load time > 5 seconds
- Cache misses > 50%
- Database query timeout

**Warning Alerts:**
- Data freshness > 10 minutes
- Export generation > 60 seconds
- Unusual metric values (outliers)

---

## 20. Future Enhancements

### 20.1 Phase 2 Enhancements

**Advanced ML Models:**
- LSTM for time series forecasting
- Gradient boosting for churn prediction
- Anomaly detection for unusual patterns
- Cohort analysis automation

**BI Tool Integration:**
- Tableau connector
- Power BI integration
- Metabase setup
- Looker Studio dashboards

**Custom Metrics:**
- User-defined metrics
- Custom formulas
- Metric alerts
- Metric comparisons

### 20.2 Phase 3 Enhancements

**Advanced Visualizations:**
- Sankey diagrams for flow analysis
- Geographic heat maps
- Network graphs for relationships
- 3D visualizations

**AI-Powered Insights:**
- Automatic insight generation
- Natural language queries
- Recommendation engine
- Predictive alerts

**Collaboration:**
- Shared dashboards
- Commenting on reports
- Dashboard templates
- Team workspaces

---

## Related PRDs

- **[PRD-SAAS-MNG-0001](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)** - Platform HQ Console (Master)
- **[PRD-SAAS-MNG-0002](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)** - Tenant Lifecycle Management
- **[PRD-SAAS-MNG-0003](PRD-SAAS-MNG-0003_Billing_Subscriptions.md)** - Billing & Subscription Management
- **[PRD-SAAS-MNG-0005](PRD-SAAS-MNG-0005_Support_Ticketing.md)** - Support & Ticketing System
- **[PRD-SAAS-MNG-0012](PRD-SAAS-MNG-0012_Observability_SLO.md)** - Observability & SLO

---

## Glossary

- **MRR**: Monthly Recurring Revenue
- **ARR**: Annual Recurring Revenue
- **Churn**: Percentage of tenants who cancel subscriptions
- **Health Score**: Composite metric indicating tenant engagement and success (0-100)
- **DAU**: Daily Active Users
- **MAU**: Monthly Active Users
- **LTV**: Lifetime Value of a customer
- **CAC**: Customer Acquisition Cost
- **RPT**: Revenue Per Tenant
- **DSO**: Days Sales Outstanding

---

## Appendix A: Sample SQL Queries

**Get platform-wide summary:**
```sql
SELECT
  COUNT(DISTINCT t.id) as total_tenants,
  COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) as active_tenants,
  SUM(s.mrr) as total_mrr,
  AVG(hs.overall_health_score) as avg_health_score
FROM org_tenants_mst t
LEFT JOIN org_subscriptions_mst s ON t.id = s.tenant_org_id AND s.status = 'active'
LEFT JOIN platform_tenant_health_scores hs ON t.id = hs.tenant_id
  AND hs.calculation_date = CURRENT_DATE;
```

**Get at-risk tenants:**
```sql
SELECT
  t.id,
  t.name,
  hs.overall_health_score,
  hs.churn_risk_score,
  hs.risk_factors
FROM org_tenants_mst t
INNER JOIN platform_tenant_health_scores hs ON t.id = hs.tenant_id
WHERE hs.calculation_date = CURRENT_DATE
  AND hs.risk_category IN ('high', 'critical')
ORDER BY hs.churn_risk_score DESC;
```

---

**End of PRD-SAAS-MNG-0004: Analytics & Reporting**

---

**Document Status**: Draft v0.1.0
**Next Review**: After implementation of Phase 1
**Approved By**: Pending
**Implementation Start**: TBD
