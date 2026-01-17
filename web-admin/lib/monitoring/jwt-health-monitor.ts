/**
 * JWT Health Monitor
 * 
 * Monitors JWT tenant context health and provides metrics.
 * Tracks validation, repair, and refresh events.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface JWTHealthMetrics {
  totalEvents: number;
  eventsWithTenant: number;
  eventsWithoutTenant: number;
  eventsWithOrgUser: number;
  eventsWithoutOrgUser: number;
  eventsWithAuthUser: number;
  eventsWithoutAuthUser: number;
  repairAttempts: number;
  repairSuccesses: number;
  repairFailures: number;
  coverageRate: number; // Percentage of JWTs with tenant context
  repairSuccessRate: number; // Percentage of successful repairs
}

export interface JWTHealthEvent {
  userId: string;
  eventType: 'validation' | 'repair' | 'refresh' | 'switch';
  tenantId?: string;
  orgUserId?: string;
  authUserId?: string;
  hadTenantContext: boolean;
  repairAttempted?: boolean;
  repairSuccessful?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Log a JWT health event to the database
 */
export async function logJWTHealthEvent(event: JWTHealthEvent): Promise<void> {
  try {
    const supabase = await createClient();
    
    const { error } = await (supabase.rpc as any)('log_jwt_tenant_health_event', {
      p_user_id: event.userId,
      p_event_type: event.eventType,
      p_tenant_id: event.tenantId || null,
      p_org_user_id: event.orgUserId || null,
      p_auth_user_id: event.authUserId || null,
      p_had_tenant_context: event.hadTenantContext,
      p_repair_attempted: event.repairAttempted || false,
      p_repair_successful: event.repairSuccessful || false,
      p_error_message: event.errorMessage || null,
      p_metadata: event.metadata || null,
    });

    if (error) {
      logger.error('Failed to log JWT health event', error as Error, {
        feature: 'jwt-health-monitor',
        action: 'logJWTHealthEvent',
        event,
      });
    }
  } catch (error) {
    logger.error('Error logging JWT health event', error as Error, {
      feature: 'jwt-health-monitor',
      action: 'logJWTHealthEvent',
      event,
    });
  }
}

/**
 * Get JWT health metrics for a time period
 * @param startTime - Start time (default: 24 hours ago)
 * @param endTime - End time (default: now)
 */
export async function getJWTHealthMetrics(
  startTime?: Date,
  endTime?: Date
): Promise<JWTHealthMetrics | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await (supabase.rpc as any)('get_jwt_tenant_health_metrics', {
      p_start_time: startTime?.toISOString() || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      p_end_time: endTime?.toISOString() || new Date().toISOString(),
    });

    if (error) {
      logger.error('Failed to get JWT health metrics', error as Error, {
        feature: 'jwt-health-monitor',
        action: 'getJWTHealthMetrics',
      });
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        totalEvents: 0,
        eventsWithTenant: 0,
        eventsWithoutTenant: 0,
        eventsWithOrgUser: 0,
        eventsWithoutOrgUser: 0,
        eventsWithAuthUser: 0,
        eventsWithoutAuthUser: 0,
        repairAttempts: 0,
        repairSuccesses: 0,
        repairFailures: 0,
        coverageRate: 100, // Default to 100% if no events
        repairSuccessRate: 100,
      };
    }

    const metrics = Array.isArray(data) ? data[0] : data;
    
    return {
      totalEvents: Number(metrics.total_events) || 0,
      eventsWithTenant: Number(metrics.events_with_tenant) || 0,
      eventsWithoutTenant: Number(metrics.events_without_tenant) || 0,
      eventsWithOrgUser: Number(metrics.events_with_org_user) || 0,
      eventsWithoutOrgUser: Number(metrics.events_without_org_user) || 0,
      eventsWithAuthUser: Number(metrics.events_with_auth_user) || 0,
      eventsWithoutAuthUser: Number(metrics.events_without_auth_user) || 0,
      repairAttempts: Number(metrics.repair_attempts) || 0,
      repairSuccesses: Number(metrics.repair_successes) || 0,
      repairFailures: Number(metrics.repair_failures) || 0,
      coverageRate: Number(metrics.coverage_rate) || 0,
      repairSuccessRate: Number(metrics.repair_success_rate) || 0,
    };
  } catch (error) {
    logger.error('Error getting JWT health metrics', error as Error, {
      feature: 'jwt-health-monitor',
      action: 'getJWTHealthMetrics',
    });
    return null;
  }
}

/**
 * Check if JWT health is within acceptable thresholds
 * @param metrics - Health metrics to check
 * @returns Object with health status and alerts
 */
export function checkJWTHealth(metrics: JWTHealthMetrics): {
  healthy: boolean;
  alerts: string[];
} {
  const alerts: string[] = [];

  // Coverage rate should be > 99%
  if (metrics.coverageRate < 99) {
    alerts.push(
      `JWT tenant context coverage is ${metrics.coverageRate.toFixed(2)}% (target: >99%)`
    );
  }

  // Repair success rate should be > 95%
  if (metrics.repairAttempts > 0 && metrics.repairSuccessRate < 95) {
    alerts.push(
      `JWT repair success rate is ${metrics.repairSuccessRate.toFixed(2)}% (target: >95%)`
    );
  }

  // Repair rate should be < 1% of total events
  if (metrics.totalEvents > 0) {
    const repairRate = (metrics.repairAttempts / metrics.totalEvents) * 100;
    if (repairRate > 1) {
      alerts.push(
        `JWT repair rate is ${repairRate.toFixed(2)}% (target: <1%)`
      );
    }
  }

  return {
    healthy: alerts.length === 0,
    alerts,
  };
}

