/**
 * Prisma Performance Monitoring API
 * 
 * API endpoints and utilities for accessing performance metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceReport, performanceMonitor } from './prisma-performance';
import { getTenantIdFromSession } from './tenant-context';

/**
 * GET /api/admin/prisma-performance
 * Get performance metrics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin access
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In production, add admin role check here
    // if (!isAdmin(user)) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const report = getPerformanceReport();

    return NextResponse.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/prisma-performance
 * Clear performance metrics
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromSession();
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // In production, add admin role check here
    performanceMonitor.clearMetrics();

    return NextResponse.json({
      success: true,
      message: 'Performance metrics cleared',
    });
  } catch (error) {
    console.error('Error clearing performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

