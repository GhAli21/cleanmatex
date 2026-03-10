# Prisma Testing & Performance Monitoring - Quick Reference

This file is a historical quick-reference note.

## Current Rule

- use `prisma/README.md` and `prisma/related_docs_index.md` as the active Prisma documentation entrypoints for `web-admin`
- treat this file as supporting reference only
- verify any test or monitoring command here against `package.json` before relying on it

## 🧪 Running Tests (Quick Commands)

```bash
# All Prisma tests
npm run test:prisma

# Watch mode (auto-reload)
npm run test:prisma:watch

# With coverage
npm run test:coverage -- __tests__/db

# Specific test file
npm test -- __tests__/db/prisma-middleware.test.ts
```

## 📊 Performance Monitoring (Quick Access)

### 1. Via Browser/API

```bash
# Start dev server first
npm run dev

# Then access:
http://localhost:3000/api/admin/prisma-performance
```

### 2. Via PowerShell

```powershell
# Get metrics
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/prisma-performance" -Method GET | ConvertTo-Json -Depth 10

# Clear metrics
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/prisma-performance" -Method DELETE
```

### 3. Via curl

```bash
# Get metrics
curl http://localhost:3000/api/admin/prisma-performance

# Clear metrics
curl -X DELETE http://localhost:3000/api/admin/prisma-performance
```

### 4. In Code

```typescript
import {
  getPerformanceReport,
  performanceMonitor,
} from "@/lib/db/prisma-performance";

// Get full report
const report = getPerformanceReport();
console.log("Avg Duration:", report.queryStats.averageDuration, "ms");

// Get tenant metrics
const tenantMetrics = performanceMonitor.getTenantMetrics("tenant-123");

// Get slow queries
const slowQueries = performanceMonitor.getSlowQueries(1000, 10);
```

## 📈 What to Look For

### ✅ Healthy Metrics

- Average Duration: **< 50ms**
- Slow Queries: **< 1%**
- Connection Pool: **< 70%** utilized

### ⚠️ Warning Signs

- Average Duration: **50-200ms**
- Slow Queries: **1-5%**
- Connection Pool: **70-90%** utilized

### 🚨 Critical Issues

- Average Duration: **> 200ms**
- Slow Queries: **> 5%**
- Connection Pool: **> 90%** utilized

## 🔍 Test Files Location

- `__tests__/db/prisma-middleware.test.ts` - Middleware tests
- `__tests__/db/tenant-context.test.ts` - Tenant context tests
- `__tests__/db/prisma-error-scenarios.test.ts` - Error scenario tests

## 📚 Full Documentation

See `PRISMA_TESTING_AND_MONITORING_GUIDE.md` for complete details.
