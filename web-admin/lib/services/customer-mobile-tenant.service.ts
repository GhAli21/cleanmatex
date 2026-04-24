import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

import { normalizePhone } from './customers.service';
import type { TenantPublicProfile } from './tenant-resolve.service';

function buildPhoneLookupCandidates(inputPhone: string) {
  const raw = (inputPhone ?? '').trim().replace(/[\s\-\(\)]/g, '');
  const normalized = normalizePhone(inputPhone);

  return Array.from(
    new Set(
      [
        raw,
        raw.replace(/^\+/, ''),
        normalized.normalized,
        normalized.normalized.replace(/^\+/, ''),
        normalized.nationalNumber,
        normalized.nationalNumber.replace(/^0+/, ''),
      ].filter((value): value is string => value.length > 0),
    ),
  );
}

export async function listCustomerTenantsByPhone(
  phone: string,
  traceId?: string,
): Promise<TenantPublicProfile[]> {
  const activeTraceId = traceId ?? crypto.randomUUID();
  logger.info('Customer tenant lookup started', {
    feature: 'customer-mobile-tenant',
    action: 'listCustomerTenantsByPhone',
    traceId: activeTraceId,
    phone,
  });

  const normalizedPhone = normalizePhone(phone);
  const phoneCandidates = buildPhoneLookupCandidates(phone);
  logger.info('Customer tenant lookup normalized phone', {
    feature: 'customer-mobile-tenant',
    action: 'listCustomerTenantsByPhone',
    traceId: activeTraceId,
    input: phone,
    normalized: normalizedPhone.normalized,
    nationalNumber: normalizedPhone.nationalNumber,
    isValid: normalizedPhone.isValid,
    phoneCandidates,
  });

  if (!normalizedPhone.isValid) {
    logger.warn('Customer tenant lookup rejected invalid phone', {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      resultCount: 0,
      reason: 'invalid_phone',
    });
    return [];
  }

  try {
    const supabase = createAdminSupabaseClient();

    const { data: customers, error: customersError } = await supabase
      .from('org_customers_mst')
      .select('tenant_org_id')
      .in('phone', phoneCandidates)
      .eq('is_active', true);

    logger.info('Customer tenant lookup customer query completed', {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      rowCount: customers?.length ?? 0,
      error: customersError?.message ?? null,
      phoneCandidates,
    });

    if (customersError) {
      logger.error('Customer tenant lookup customer query failed', customersError, {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
        normalizedPhone: normalizedPhone.normalized,
        phoneCandidates,
      });
      throw new Error(customersError.message);
    }

    if (!customers?.length) {
      logger.info('Customer tenant lookup returned no customer rows', {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
        resultCount: 0,
        reason: 'no_customer_rows',
        phoneCandidates,
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

    logger.info('Customer tenant lookup resolved tenant ids', {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      tenantIds,
      tenantCount: tenantIds.length,
    });

    if (!tenantIds.length) {
      logger.warn('Customer tenant lookup found no tenant ids', {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
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

    logger.info('Customer tenant lookup tenant query completed', {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
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
      logger.warn('Customer tenant lookup tenant payload was empty', {
        feature: 'customer-mobile-tenant',
        action: 'listCustomerTenantsByPhone',
        traceId: activeTraceId,
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

    logger.info('Customer tenant lookup completed', {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      resultCount: result.length,
      tenantOrgIds: result.map((tenant) => tenant.tenantOrgId),
    });

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown lookup error');
    logger.error('listCustomerTenantsByPhone failed', error, {
      feature: 'customer-mobile-tenant',
      action: 'listCustomerTenantsByPhone',
      traceId: activeTraceId,
      normalizedPhone: normalizedPhone.normalized,
      phoneCandidates,
    });
    throw error;
  }
}
