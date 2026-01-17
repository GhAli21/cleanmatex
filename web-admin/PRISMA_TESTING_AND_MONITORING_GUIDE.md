# Prisma Testing and Performance Monitoring Guide

**Date**: 2025-01-16  
**Status**: ✅ **Complete Guide**

---

## 🧪 Part 1: Running Tests

### Prerequisites

Ensure you have the required dependencies:

```bash
cd web-admin
npm install
```

### Running Prisma Tests

#### Option 1: Run All Prisma Tests

```bash
# From web-admin directory
npm test -- __tests__/db
```

#### Option 2: Run Specific Test Files

```bash
# Test middleware behavior
npm test -- __tests__/db/prisma-middleware.test.ts

# Test tenant context isolation
npm test -- __tests__/db/tenant-context.test.ts

# Test error scenarios
npm test -- __tests__/db/prisma-error-scenarios.test.ts
```

#### Option 3: Run with Watch Mode

```bash
# Watch mode - automatically re-runs tests on file changes
npm run test:watch -- __tests__/db
```

#### Option 4: Run with Coverage

```bash
# Generate coverage report
npm run test:coverage -- __tests__/db

# Coverage report will be generated in:
# - web-admin/coverage/lcov-report/index.html (open in browser)
# - web-admin/coverage/coverage-final.json (JSON format)
```

#### Option 5: Run Single Test Case

```bash
# Run specific test by name pattern
npm test -- __tests__/db/prisma-middleware.test.ts -t "should add tenant_org_id to findMany"
```

### Test Output Examples

#### Successful Test Run

```
PASS  __tests__/db/prisma-middleware.test.ts
  Prisma Multi-Tenant Middleware
    Tenant Filtering for org_* Tables
      ✓ should add tenant_org_id to findMany where clause (5ms)
      ✓ should add tenant_org_id to findUnique where clause (3ms)
      ✓ should add tenant_org_id to count where clause (2ms)
    CREATE Operations
      ✓ should add tenant_org_id to create data (4ms)
      ✓ should add tenant_org_id to createMany data array (6ms)
    ...
```

#### Failed Test Example

```
FAIL  __tests__/db/prisma-middleware.test.ts
  Prisma Multi-Tenant Middleware
    Tenant Filtering for org_* Tables
      ✕ should add tenant_org_id to findMany where clause (10ms)

      Expected: { status: 'active', tenant_org_id: 'tenant-123' }
      Received: { status: 'active' }

      Difference: - tenant_org_id: 'tenant-123'
```

### Troubleshooting Tests

#### Issue: Tests fail with "Cannot find module"

**Solution**: Ensure you're running from `web-admin` directory:

```bash
cd web-admin
npm test -- __tests__/db
```

#### Issue: Tests fail with Prisma client errors

**Solution**: Generate Prisma client first:

```bash
cd web-admin
npm run prisma:generate
npm test -- __tests__/db
```

#### Issue: Tests timeout

**Solution**: Increase Jest timeout in test file:

```typescript
jest.setTimeout(10000); // 10 seconds
```

---

## 📊 Part 2: Performance Monitoring

### Accessing Performance Metrics

#### Method 1: Via API Endpoint (Recommended)

**Endpoint**: `GET /api/admin/prisma-performance`

**Using Browser**:

1. Start your development server:
   ```bash
   cd web-admin
   npm run dev
   ```
2. Navigate to: `http://localhost:3000/api/admin/prisma-performance`
3. You'll see JSON response with all metrics

**Using curl**:

```bash
curl http://localhost:3000/api/admin/prisma-performance
```

**Using PowerShell**:

```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/prisma-performance" -Method GET
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "queryStats": {
      "totalQueries": 150,
      "averageDuration": 45.2,
      "slowQueries": 3,
      "queriesByModel": {
        "org_orders_mst": 50,
        "org_invoice_mst": 30,
        "org_gift_cards_mst": 20
      },
      "queriesByAction": {
        "findMany": 80,
        "create": 20,
        "update": 30,
        "findUnique": 20
      }
    },
    "connectionPool": {
      "activeConnections": 5,
      "idleConnections": 5,
      "totalConnections": 10,
      "timestamp": "2025-01-16T10:30:00.000Z"
    },
    "tenantMetrics": [
      {
        "tenantId": "tenant-123",
        "operationCount": 100,
        "totalDuration": 4520,
        "averageDuration": 45.2,
        "timestamp": "2025-01-16T10:30:00.000Z"
      },
      {
        "tenantId": "tenant-456",
        "operationCount": 50,
        "totalDuration": 2100,
        "averageDuration": 42.0,
        "timestamp": "2025-01-16T10:29:45.000Z"
      }
    ],
    "slowQueries": [
      {
        "model": "org_orders_mst",
        "action": "findMany",
        "duration": 1250,
        "tenantId": "tenant-123",
        "timestamp": "2025-01-16T10:25:00.000Z"
      },
      {
        "model": "org_invoice_mst",
        "action": "aggregate",
        "duration": 1100,
        "tenantId": "tenant-123",
        "timestamp": "2025-01-16T10:20:00.000Z"
      }
    ]
  },
  "timestamp": "2025-01-16T10:30:00.000Z"
}
```

#### Method 2: Programmatically in Code

**In Server Actions or API Routes**:

```typescript
import {
  getPerformanceReport,
  performanceMonitor,
} from "@/lib/db/prisma-performance";

// Get full performance report
export async function getPerformanceStats() {
  const report = getPerformanceReport();

  console.log("Total Queries:", report.queryStats.totalQueries);
  console.log("Average Duration:", report.queryStats.averageDuration, "ms");
  console.log("Slow Queries:", report.queryStats.slowQueries);

  return report;
}

// Get metrics for specific tenant
export async function getTenantPerformance(tenantId: string) {
  const metrics = performanceMonitor.getTenantMetrics(tenantId);

  if (metrics) {
    console.log(`Tenant ${tenantId}:`);
    console.log(`  Operations: ${metrics.operationCount}`);
    console.log(`  Total Duration: ${metrics.totalDuration}ms`);
    console.log(`  Average Duration: ${metrics.averageDuration}ms`);
  }

  return metrics;
}

// Get slow queries
export async function getSlowQueries(threshold: number = 1000) {
  const slowQueries = performanceMonitor.getSlowQueries(threshold, 10);
  return slowQueries;
}
```

**In React Components (Server Components)**:

```typescript
// app/dashboard/admin/performance/page.tsx
import { getPerformanceReport } from "@/lib/db/prisma-performance";

export default async function PerformancePage() {
  const report = await getPerformanceReport();

  return (
    <div>
      <h1>Prisma Performance Metrics</h1>
      <div>
        <h2>Query Statistics</h2>
        <p>Total Queries: {report.queryStats.totalQueries}</p>
        <p>
          Average Duration: {report.queryStats.averageDuration.toFixed(2)}ms
        </p>
        <p>Slow Queries: {report.queryStats.slowQueries}</p>
      </div>

      <div>
        <h2>Slow Queries</h2>
        <ul>
          {report.slowQueries.map((query, idx) => (
            <li key={idx}>
              {query.model}.{query.action} - {query.duration}ms (Tenant:{" "}
              {query.tenantId})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

#### Method 3: Console Logs (Development Mode)

Performance monitoring automatically logs slow queries in development mode:

**Console Output Example**:

```
[Prisma Performance] Slow query detected: org_orders_mst.findMany took 1250ms (tenant: tenant-123)
[Prisma Performance] Slow query detected: org_invoice_mst.aggregate took 1100ms (tenant: tenant-123)
```

### Clearing Performance Metrics

**Via API**:

```bash
# DELETE request to clear metrics
curl -X DELETE http://localhost:3000/api/admin/prisma-performance
```

**Programmatically**:

```typescript
import { performanceMonitor } from "@/lib/db/prisma-performance";

// Clear all metrics
performanceMonitor.clearMetrics();
```

### Performance Metrics Explained

#### Query Statistics

- **totalQueries**: Total number of Prisma queries executed
- **averageDuration**: Average query duration in milliseconds
- **slowQueries**: Number of queries exceeding 1000ms threshold
- **queriesByModel**: Breakdown of queries by database model
- **queriesByAction**: Breakdown of queries by operation type (findMany, create, etc.)

#### Connection Pool Metrics

- **activeConnections**: Estimated number of active database connections
- **idleConnections**: Estimated number of idle connections
- **totalConnections**: Total connection pool size (default: 10)

#### Tenant Metrics

- **tenantId**: Tenant organization ID
- **operationCount**: Number of operations for this tenant
- **totalDuration**: Cumulative duration of all operations
- **averageDuration**: Average operation duration for this tenant

#### Slow Queries

Queries exceeding 1000ms threshold, sorted by duration (slowest first).

---

## 🎯 Practical Examples

### Example 1: Monitor Performance During Development

```typescript
// In your development workflow
import { getPerformanceReport } from "@/lib/db/prisma-performance";

// After running some operations
const report = getPerformanceReport();

if (report.queryStats.averageDuration > 100) {
  console.warn(
    "⚠️ Average query duration is high:",
    report.queryStats.averageDuration,
    "ms"
  );
}

if (report.queryStats.slowQueries > 0) {
  console.warn("⚠️ Found", report.queryStats.slowQueries, "slow queries");
  report.slowQueries.forEach((query) => {
    console.warn(`  - ${query.model}.${query.action}: ${query.duration}ms`);
  });
}
```

### Example 2: Create Performance Dashboard Component

```typescript
// components/admin/performance-dashboard.tsx
"use client";

import { useEffect, useState } from "react";

interface PerformanceData {
  queryStats: {
    totalQueries: number;
    averageDuration: number;
    slowQueries: number;
  };
  tenantMetrics: Array<{
    tenantId: string;
    operationCount: number;
    averageDuration: number;
  }>;
  slowQueries: Array<{
    model: string;
    action: string;
    duration: number;
    tenantId: string;
  }>;
}

export function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/admin/prisma-performance");
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch performance metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading performance metrics...</div>;
  if (!data) return <div>No data available</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Prisma Performance Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold">Total Queries</h3>
          <p className="text-3xl">{data.queryStats.totalQueries}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold">Avg Duration</h3>
          <p className="text-3xl">
            {data.queryStats.averageDuration.toFixed(2)}ms
          </p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold">Slow Queries</h3>
          <p className="text-3xl text-red-600">{data.queryStats.slowQueries}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Slow Queries</h2>
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Model</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">Tenant</th>
              </tr>
            </thead>
            <tbody>
              {data.slowQueries.map((query, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">{query.model}</td>
                  <td className="px-4 py-2">{query.action}</td>
                  <td className="px-4 py-2 text-red-600">{query.duration}ms</td>
                  <td className="px-4 py-2">{query.tenantId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Tenant Metrics</h2>
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Tenant ID</th>
                <th className="px-4 py-2 text-left">Operations</th>
                <th className="px-4 py-2 text-left">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {data.tenantMetrics.map((tenant, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">{tenant.tenantId}</td>
                  <td className="px-4 py-2">{tenant.operationCount}</td>
                  <td className="px-4 py-2">
                    {tenant.averageDuration.toFixed(2)}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### Example 3: Automated Performance Alerts

```typescript
// lib/utils/performance-alerts.ts
import { getPerformanceReport } from "@/lib/db/prisma-performance";

export async function checkPerformanceAlerts() {
  const report = getPerformanceReport();
  const alerts: string[] = [];

  // Alert if average duration is high
  if (report.queryStats.averageDuration > 200) {
    alerts.push(
      `⚠️ High average query duration: ${report.queryStats.averageDuration.toFixed(
        2
      )}ms`
    );
  }

  // Alert if too many slow queries
  if (report.queryStats.slowQueries > 10) {
    alerts.push(
      `⚠️ High number of slow queries: ${report.queryStats.slowQueries}`
    );
  }

  // Alert if connection pool is exhausted
  const poolMetrics = report.connectionPool;
  if (poolMetrics.activeConnections >= poolMetrics.totalConnections * 0.9) {
    alerts.push(
      `⚠️ Connection pool nearly exhausted: ${poolMetrics.activeConnections}/${poolMetrics.totalConnections}`
    );
  }

  // Alert for tenant-specific issues
  report.tenantMetrics.forEach((tenant) => {
    if (tenant.averageDuration > 300) {
      alerts.push(
        `⚠️ Tenant ${
          tenant.tenantId
        } has high average duration: ${tenant.averageDuration.toFixed(2)}ms`
      );
    }
  });

  return alerts;
}
```

---

## 🔧 Configuration

### Adjusting Slow Query Threshold

Edit `lib/db/prisma-performance.ts`:

```typescript
// Change threshold from 1000ms to 500ms
if (duration > 500 && process.env.NODE_ENV === "development") {
  console.warn(`[Prisma Performance] Slow query detected...`);
}
```

### Adjusting Metrics History Size

Edit `lib/db/prisma-performance.ts`:

```typescript
private maxMetricsHistory = 2000; // Keep last 2000 queries (default: 1000)
```

### Disabling Performance Monitoring

To disable performance monitoring (e.g., in production for performance reasons):

```typescript
// In lib/db/prisma.ts, comment out:
// if (!(prismaClient as any).__performanceMiddlewareApplied) {
//   applyPerformanceMiddleware(prismaClient);
//   (prismaClient as any).__performanceMiddlewareApplied = true;
// }
```

---

## 📈 Interpreting Performance Metrics

### Healthy Metrics

- **Average Duration**: < 50ms
- **Slow Queries**: < 1% of total queries
- **Connection Pool**: < 70% utilization

### Warning Signs

- **Average Duration**: 50-200ms
- **Slow Queries**: 1-5% of total queries
- **Connection Pool**: 70-90% utilization

### Critical Issues

- **Average Duration**: > 200ms
- **Slow Queries**: > 5% of total queries
- **Connection Pool**: > 90% utilization

### Common Performance Issues

1. **N+1 Queries**: Multiple queries instead of one with includes

   - **Solution**: Use Prisma `include` or `select` to fetch related data

2. **Missing Indexes**: Slow queries on large tables

   - **Solution**: Add database indexes on frequently queried columns

3. **Large Result Sets**: Fetching too much data

   - **Solution**: Use pagination (`take`, `skip`) or limit results

4. **Complex Joins**: Expensive queries with multiple relations
   - **Solution**: Optimize query structure or use raw SQL for complex queries

---

## 🚀 Quick Start Checklist

### Testing

- [ ] Run `npm test -- __tests__/db` to verify all tests pass
- [ ] Check test coverage with `npm run test:coverage -- __tests__/db`
- [ ] Review test output for any failures

### Performance Monitoring

- [ ] Start development server: `npm run dev`
- [ ] Access metrics: `http://localhost:3000/api/admin/prisma-performance`
- [ ] Perform some operations (create orders, invoices, etc.)
- [ ] Check metrics again to see performance data
- [ ] Review slow queries if any appear

---

## 📚 Additional Resources

- [Prisma Performance Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Jest Testing Documentation](https://jestjs.io/docs/getting-started)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**Last Updated**: 2025-01-16  
**Status**: ✅ **COMPLETE GUIDE**
