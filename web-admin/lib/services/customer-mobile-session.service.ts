import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from('org_customers_mst')
    .select('id, display_name, name, phone')
    .eq('tenant_org_id', params.tenantId)
    .eq('phone', normalizedPhone.normalized)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('Resolve customer mobile session failed', error as Error, {
      feature: 'customer_mobile_session',
      action: 'resolve',
      tenantId: params.tenantId,
    });
    throw error;
  }

  if (!customer) {
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
