import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  CustomerAppAuthError,
  resolveCustomerAppSession,
} from './customer-app-auth.service';
import { normalizePhone } from './customers.service';
import { verifyVerificationToken } from './otp.service';

/**
 * Verified tenant-scoped customer mobile session resolved from either an opaque
 * global Customer App bearer token (0854) or a legacy OTP verification token.
 */
export interface CustomerMobileSession {
  /** Tenant-scoped org_customers_mst.id. */
  customerId: string;
  /** Global sys_customers_mst.id when the customer has a global identity. */
  sysCustomerId: string | null;
  displayName: string | null;
  phoneNumber: string;
  tenantOrgId: string;
  verificationToken: string;
  /** Distinguishes opaque global session auth from legacy OTP token auth. */
  authKind: 'GLOBAL_SESSION' | 'OTP_TOKEN';
}

/**
 * Verified tenant-less customer identity resolved before selecting an Organization.
 */
export interface CustomerGlobalIdentitySession {
  sysCustomerId: string | null;
  phoneNumber: string | null;
  authKind: 'GLOBAL_SESSION' | 'OTP_TOKEN';
  requiresPasswordChange: boolean;
}

function buildPhoneLookupCandidates(inputPhone: string): string[] {
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

/**
 * Extracts a raw Bearer token from an Authorization header without logging it.
 *
 * @param authorization - Raw HTTP Authorization header value.
 * @returns Bearer token string or null when absent/malformed.
 */
export function extractMobileBearerToken(authorization: string | null): string | null {
  const raw = authorization ?? '';
  if (!raw.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = raw.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves a tenant-less global Customer App session or legacy OTP token.
 * Used by endpoints that operate across Organizations (e.g. My Laundries list).
 *
 * @param bearerToken - Raw Bearer token from the Authorization header.
 * @returns Verified global identity context or null when invalid/expired.
 */
export async function resolveCustomerGlobalIdentity(
  bearerToken: string,
): Promise<CustomerGlobalIdentitySession | null> {
  // Prefer opaque global sessions (0854); fall back cleanly to legacy OTP tokens.
  try {
    const globalSession = await resolveCustomerAppSession({
      accessToken: bearerToken,
    });
    return {
      sysCustomerId: globalSession.customerId,
      phoneNumber: null,
      authKind: 'GLOBAL_SESSION',
      requiresPasswordChange: globalSession.requiresPasswordChange,
    };
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      throw error;
    }
    // Token is not an active global opaque session; try legacy OTP verification token.
  }

  const tokenPayload = verifyVerificationToken(bearerToken);
  if (!tokenPayload) {
    return null;
  }

  const normalizedPhone = normalizePhone(tokenPayload.phone);
  if (!normalizedPhone.isValid) {
    return null;
  }

  // Attempt to locate linked global sys_customers_mst row if one exists.
  const supabase = createAdminSupabaseClient();
  const phoneCandidates = buildPhoneLookupCandidates(tokenPayload.phone);
  const { data: sysCustomer } = await supabase
    .from('sys_customers_mst')
    .select('id')
    .or(
      `mobile_e164.eq.${normalizedPhone.normalized},phone.in.(${phoneCandidates.map((p) => `"${p.replace(/"/g, '')}"`).join(',')})`,
    )
    .limit(1)
    .maybeSingle();

  return {
    sysCustomerId: (sysCustomer?.id as string | undefined) ?? null,
    phoneNumber: normalizedPhone.normalized,
    authKind: 'OTP_TOKEN',
    requiresPasswordChange: false,
  };
}

/**
 * Resolves a tenant-scoped Customer Mobile Session from either a global opaque
 * Customer App access token or a legacy OTP verification token.
 *
 * @param params.tenantId - Organization tenant_org_id scoped for the request.
 * @param params.verificationToken - Bearer token from Authorization header.
 * @returns Verified tenant-scoped customer session or null when unauthorized.
 * @example
 * const session = await resolveCustomerMobileSession({ tenantId, verificationToken });
 */
export async function resolveCustomerMobileSession(params: {
  tenantId: string;
  verificationToken: string;
}): Promise<CustomerMobileSession | null> {
  const supabase = createAdminSupabaseClient();

  // ─── Path 1: Global Opaque Customer App Session (0854) ───────────────────
  try {
    const globalSession = await resolveCustomerAppSession({
      accessToken: params.verificationToken,
    });

    const { data: orgCustomer, error: orgError } = await supabase
      .from('org_customers_mst')
      .select('id, customer_id, display_name, name, phone')
      .eq('tenant_org_id', params.tenantId)
      .eq('customer_id', globalSession.customerId)
      .eq('is_active', true)
      .maybeSingle();

    if (orgError) {
      logger.error('Resolve global customer tenant membership failed', orgError as Error, {
        feature: 'customer_mobile_session',
        action: 'resolve_global',
        tenantId: params.tenantId,
      });
      throw orgError;
    }

    if (orgCustomer) {
      return {
        customerId: orgCustomer.id,
        sysCustomerId: orgCustomer.customer_id ?? globalSession.customerId,
        displayName: orgCustomer.display_name ?? orgCustomer.name ?? null,
        phoneNumber: orgCustomer.phone ?? '',
        tenantOrgId: params.tenantId,
        verificationToken: params.verificationToken,
        authKind: 'GLOBAL_SESSION',
      };
    }

    return null;
  } catch (error) {
    if (error instanceof CustomerAppAuthError && error.code === 'PASSWORD_CHANGE_REQUIRED') {
      throw error;
    }
    // Fall through to legacy OTP token verification.
  }

  // ─── Path 2: Legacy OTP Verification Token ───────────────────────────────
  const tokenPayload = verifyVerificationToken(params.verificationToken);
  if (!tokenPayload) {
    return null;
  }

  const normalizedPhone = normalizePhone(tokenPayload.phone);
  if (!normalizedPhone.isValid) {
    return null;
  }

  const phoneCandidates = buildPhoneLookupCandidates(tokenPayload.phone);
  const { data: customer, error } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id, display_name, name, phone')
    .eq('tenant_org_id', params.tenantId)
    .in('phone', phoneCandidates)
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
    logger.warn('Resolve customer mobile session returned no customer', {
      feature: 'customer_mobile_session',
      action: 'resolve',
      tenantId: params.tenantId,
    });
    return null;
  }

  return {
    customerId: customer.id,
    sysCustomerId: (customer.customer_id as string | null) ?? null,
    displayName: customer.display_name ?? customer.name ?? null,
    phoneNumber: customer.phone ?? normalizedPhone.normalized,
    tenantOrgId: params.tenantId,
    verificationToken: params.verificationToken,
    authKind: 'OTP_TOKEN',
  };
}
