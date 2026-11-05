/**
 * Prisma Performance Monitoring API Route
 *
 * GET /api/admin/prisma-performance - Get performance metrics
 * DELETE /api/admin/prisma-performance - Clear performance metrics
 *
 * Diagnostics only; no tenant data. Any authenticated user may read/clear
 * process-wide query metrics (not sensitive, not tenant-scoped).
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getPerformanceReport, performanceMonitor } from '@/lib/db/prisma-performance';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const report = getPerformanceReport();
  return NextResponse.json({
    success: true,
    data: report,
    timestamp: new Date().toISOString(),
  });
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  performanceMonitor.clearMetrics();
  return NextResponse.json({ success: true, message: 'Performance metrics cleared' });
}
