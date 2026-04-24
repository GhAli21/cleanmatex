import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

import { normalizePhone } from './customers.service';
import type { TenantPublicProfile } from './tenant-resolve.service';

const CUSTOMER_TENANT_TRACE_FILE = path.join(
  process.cwd(),
  'logs',
  'customer-tenant-lookup.ndjson',
);

type CustomerTenantLookupStep =
  | 'start'
  | 'phone_normalized'
  | 'customer_query_result'
  | 'tenant_ids_resolved'
  | 'tenant_query_result'
  | 'completed'
  | 'error';

async function writeCustomerTenantTrace(
  traceId: string,
  step: CustomerTenantLookupStep,
  payload: Record<string, unknown>,
) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    step,
    payload,
  });

  await mkdir(path.dirname(CUSTOMER_TENANT_TRACE_FILE), { recursive: true });
  await appendFile(CUSTOMER_TENANT_TRACE_FILE, `${entry}\n`, 'utf8');
}

export async function listCustomerTenantsByPhone(
  phone: string,
  traceId?: string,
): Promise<TenantPublicProfile[]> {
  const activeTraceId = traceId ?? crypto.randomUUID();

  await writeCustomerTenantTrace(activeTraceId, 'start', { phone });

  const normalizedPhone = normalizePhone(phone);
  await writeCustomerTenantTrace(activeTraceId, 'phone_normalized', {
    input: phone,
    normalized: normalizedPhone.normalized,
    isValid: normalizedPhone.isValid,
  });

  if (!normalizedPhone.isValid) {
    await writeCustomerTenantTrace(activeTraceId, 'completed', {
      resultCount: 0,
      reason: 'invalid_phone',
    });
    return [];
  }

  try {
    const supabase = await createClient();

    const { data: customers, error: customersError } = await supabase
      .from('org_customers_mst')
      .select('tenant_org_id')
      .eq('phone', normalizedPhone.normalized)
      .eq('is_active', true);
    
      console.log(`customers.rowCount: ${customers?.length ?? 0}`);

    await writeCustomerTenantTrace(activeTraceId, 'customer_query_result', {
      rowCount: customers?.length ?? 0,
      error: customersError?.message ?? null,
    });

    if (customersError) {
      logger.error('Customer tenant lookup customer query failed', customersError, {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
        normalizedPhone: normalizedPhone.normalized,
      });
      throw new Error(customersError.message);
    }

    if (!customers?.length) {
      await writeCustomerTenantTrace(activeTraceId, 'completed', {
        resultCount: 0,
        reason: 'no_customer_rows',
      });
      return [];
    }

    const tenantIds = Array.from(
      new Set(
        customers
            .map((row) => row.tenant_org_id as string | null)
            .filter((tenantId): tenantId is string => !!tenantId),
      ),
    );

    await writeCustomerTenantTrace(activeTraceId, 'tenant_ids_resolved', {
      tenantIds,
      tenantCount: tenantIds.length,
    });

    if (!tenantIds.length) {
      await writeCustomerTenantTrace(activeTraceId, 'completed', {
        resultCount: 0,
        reason: 'no_tenant_ids',
      });
      return [];
    }

    const { data: tenants, error: tenantsError } = await supabase
      .from('org_tenants_mst')
      .select('id, name, name2, logo_url, brand_color_primary')
      .in('id', tenantIds)
      .eq('is_active', true)
      .order('name', { ascending: true });

    await writeCustomerTenantTrace(activeTraceId, 'tenant_query_result', {
      rowCount: tenants?.length ?? 0,
      error: tenantsError?.message ?? null,
    });

    if (tenantsError) {
      logger.error('Customer tenant lookup tenant query failed', tenantsError, {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
        normalizedPhone: normalizedPhone.normalized,
        tenantIds,
      });
      throw new Error(tenantsError.message);
    }

    if (!tenants) {
      await writeCustomerTenantTrace(activeTraceId, 'completed', {
        resultCount: 0,
        reason: 'tenant_payload_empty',
      });
      return [];
    }

    const result = tenants.map((tenant) => ({
      tenantOrgId: tenant.id as string,
      name: (tenant.name as string | null) ?? '',
      name2: (tenant.name2 as string | null) ?? null,
      logoUrl: (tenant.logo_url as string | null) ?? null,
      primaryColor: (tenant.brand_color_primary as string | null) ?? null,
    }));

    await writeCustomerTenantTrace(activeTraceId, 'completed', {
      resultCount: result.length,
      tenantOrgIds: result.map((tenant) => tenant.tenantOrgId),
    });

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown lookup error');
    await writeCustomerTenantTrace(activeTraceId, 'error', {
      message: error.message,
      stack: error.stack ?? null,
    });
    logger.error('listCustomerTenantsByPhone failed', error, {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      normalizedPhone: normalizedPhone.normalized,
    });
    throw error;
  }
}
