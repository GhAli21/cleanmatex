/**
 * Tenant Isolation Monitor
 * 
 * Monitors tenant isolation violations and logs them for alerting.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { validateTenantIsolation } from '../validation/tenant-isolation-validator';

export interface IsolationViolation {
  id: string;
  table: string;
  tenantId: string;
  userId: string;
  violationType: 'cross_tenant_access' | 'missing_tenant_filter' | 'invalid_tenant_context';
  details: Record<string, any>;
  detectedAt: Date;
}

/**
 * Log a tenant isolation violation
 * @param violation - Violation details
 */
export async function logIsolationViolation(
  violation: Omit<IsolationViolation, 'id' | 'detectedAt'>
): Promise<void> {
  try {
    const supabase = await createClient();
    
    // Log to sys_audit_log
    await supabase.from('sys_audit_log').insert({
      tenant_org_id: violation.tenantId,
      user_id: violation.userId,
      action: 'TENANT_ISOLATION_VIOLATION',
      entity_type: violation.table,
      new_values: {
        violation_type: violation.violationType,
        details: violation.details,
      },
      status: 'error',
    });

    logger.error('Tenant isolation violation detected', {
      feature: 'tenant-isolation-monitor',
      action: 'logIsolationViolation',
      ...violation,
    });
  } catch (error) {
    logger.error('Failed to log isolation violation', error as Error, {
      feature: 'tenant-isolation-monitor',
      action: 'logIsolationViolation',
    });
  }
}

/**
 * Monitor tenant isolation for a specific table
 * @param table - Table name to monitor
 * @param tenantId - Tenant ID
 * @param userId - User ID
 */
export async function monitorTenantIsolation(
  table: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const check = await validateTenantIsolation(table, tenantId, userId);
  
  if (!check.passed) {
    await logIsolationViolation({
      table,
      tenantId,
      userId,
      violationType: 'missing_tenant_filter',
      details: {
        error: check.error,
      },
    });
  }
}

/**
 * Get recent isolation violations
 * @param hours - Number of hours to look back
 * @returns Array of violations
 */
export async function getRecentViolations(hours: number = 24): Promise<any[]> {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('sys_audit_log')
      .select('*')
      .eq('action', 'TENANT_ISOLATION_VIOLATION')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get recent violations', error as Error, {
        feature: 'tenant-isolation-monitor',
        action: 'getRecentViolations',
      });
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error getting recent violations', error as Error, {
      feature: 'tenant-isolation-monitor',
      action: 'getRecentViolations',
    });
    return [];
  }
}

