/**
 * JWT Health Monitoring API
 * 
 * Admin endpoint to check JWT tenant context health metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJWTHealthMetrics, checkJWTHealth } from '@/lib/monitoring/jwt-health-monitor';
import { requirePermission } from '@/lib/middleware/require-permission';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/admin/jwt-health
 * Get JWT health metrics
 * Requires: admin permission
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    const authCheck = await requirePermission('admin:read')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const startTime = searchParams.get('startTime')
      ? new Date(searchParams.get('startTime')!)
      : new Date(Date.now() - hours * 60 * 60 * 1000);
    const endTime = searchParams.get('endTime')
      ? new Date(searchParams.get('endTime')!)
      : new Date();

    // Get metrics
    const metrics = await getJWTHealthMetrics(startTime, endTime);

    if (!metrics) {
      return NextResponse.json(
        { error: 'Failed to retrieve metrics' },
        { status: 500 }
      );
    }

    // Check health status
    const health = checkJWTHealth(metrics);

    return NextResponse.json({
      success: true,
      metrics,
      health,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        hours,
      },
    });
  } catch (error) {
    logger.error('Error getting JWT health metrics', error as Error, {
      feature: 'jwt-health-api',
      action: 'GET',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

