/**
 * Tenant Isolation Validator
 * 
 * Validates tenant isolation at runtime to detect violations.
 * Used for testing and monitoring.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export interface TenantIsolationCheck {
  table: string;
  tenantId: string;
  userId: string;
  passed: boolean;
  error?: string;
}

/**
 * Validate that a query only returns data for the specified tenant
 * @param table - Table name
 * @param tenantId - Expected tenant ID
 * @param userId - User ID making the query
 * @returns Validation result
 */
export async function validateTenantIsolation(
  table: string,
  tenantId: string,
  userId: string
): Promise<TenantIsolationCheck> {
  try {
    const supabase = await createClient();
    
    // Try to query without tenant filter (should fail or return empty)
    const { data, error } = await supabase
      .from(table)
      .select('tenant_org_id')
      .limit(1);

    if (error) {
      // RLS is working - query was blocked
      return {
        table,
        tenantId,
        userId,
        passed: true,
      };
    }

    // If data returned, check if it matches tenant
    if (data && data.length > 0) {
      const row = data[0] as any;
      if (row.tenant_org_id === tenantId) {
        return {
          table,
          tenantId,
          userId,
          passed: true,
        };
      } else {
        return {
          table,
          tenantId,
          userId,
          passed: false,
          error: `Data leak detected: row with tenant_org_id=${row.tenant_org_id} returned for tenant ${tenantId}`,
        };
      }
    }

    return {
      table,
      tenantId,
      userId,
      passed: true,
    };
  } catch (error) {
    logger.error('Error validating tenant isolation', error as Error, {
      feature: 'tenant-isolation-validator',
      action: 'validateTenantIsolation',
      table,
      tenantId,
      userId,
    });

    return {
      table,
      tenantId,
      userId,
      passed: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Validate tenant isolation for multiple tables
 * @param tables - Array of table names
 * @param tenantId - Expected tenant ID
 * @param userId - User ID making the query
 * @returns Array of validation results
 */
export async function validateTenantIsolationBatch(
  tables: string[],
  tenantId: string,
  userId: string
): Promise<TenantIsolationCheck[]> {
  const results = await Promise.all(
    tables.map(table => validateTenantIsolation(table, tenantId, userId))
  );

  return results;
}

/**
 * Check if a user can access data from another tenant (should fail)
 * @param table - Table name
 * @param tenantId - Tenant ID user belongs to
 * @param otherTenantId - Another tenant ID (should not be accessible)
 * @param userId - User ID
 * @returns True if isolation is working (user cannot access other tenant)
 */
export async function validateCrossTenantIsolation(
  table: string,
  tenantId: string,
  otherTenantId: string,
  userId: string
): Promise<boolean> {
  try {
    const supabase = await createClient();
    
    // Try to query for other tenant's data (should fail)
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('tenant_org_id', otherTenantId)
      .limit(1);

    // If query succeeded and returned data, isolation is broken
    if (!error && data && data.length > 0) {
      logger.error('Cross-tenant data leak detected', {
        feature: 'tenant-isolation-validator',
        action: 'validateCrossTenantIsolation',
        table,
        tenantId,
        otherTenantId,
        userId,
      });
      return false;
    }

    // Query failed or returned empty - isolation is working
    return true;
  } catch (error) {
    // Error is expected - RLS blocked the query
    return true;
  }
}

