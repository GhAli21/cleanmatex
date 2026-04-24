import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { normalizePhone } from './customers.service';
import { verifyVerificationToken } from './otp.service';

export interface CustomerMobileSession {
  customerId: string;
  displayName: string | null;
  phoneNumber: string;
  tenantOrgId: string;
  verificationToken: string;
}

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

export async function resolveCustomerMobileSession(params: {
  tenantId: string;
  verificationToken: string;
}): Promise<CustomerMobileSession | null> {
  const tokenPayload = verifyVerificationToken(params.verificationToken);
  if (!tokenPayload) {
    return null;
  }

  const normalizedPhone = normalizePhone(tokenPayload.phone);
  if (!normalizedPhone.isValid) {
    return null;
  }

  const phoneCandidates = buildPhoneLookupCandidates(tokenPayload.phone);
  const supabase = createAdminSupabaseClient();
  const { data: customer, error } = await supabase
    .from('org_customers_mst')
    .select('id, display_name, name, phone')
    .eq('tenant_org_id', params.tenantId)
    .in('phone', phoneCandidates)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('Resolve customer mobile session failed', error as Error, {
      feature: 'customer_mobile_session',
      action: 'resolve',
      tenantId: params.tenantId,
      phoneCandidates,
    });
    throw error;
  }

  if (!customer) {
    logger.warn('Resolve customer mobile session returned no customer', {
      feature: 'customer_mobile_session',
      action: 'resolve',
      tenantId: params.tenantId,
      normalizedPhone: normalizedPhone.normalized,
      phoneCandidates,
    });
    return null;
  }

  return {
    customerId: customer.id,
    displayName: customer.display_name ?? customer.name ?? null,
    phoneNumber: customer.phone ?? normalizedPhone.normalized,
    tenantOrgId: params.tenantId,
    verificationToken: params.verificationToken,
  };
}
