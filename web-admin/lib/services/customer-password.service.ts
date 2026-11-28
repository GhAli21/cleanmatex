import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { normalizePhone } from './customers.service';
import { verifyVerificationToken } from './otp.service';

function scryptAsync(
  password: Parameters<typeof scrypt>[0],
  salt: Parameters<typeof scrypt>[1],
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const SCRYPT_PARAMS = {
  keylen: 64,
  N: 32768,
  r: 8,
  p: 1,
};

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

/**
 * Generates a per-tenant scrypt password hash compatible with legacy customer password login.
 * Used when tenant staff set a customer password so both global and per-tenant auth paths stay aligned.
 *
 * @param plain - Plaintext password supplied for hashing only.
 * @returns Versioned scrypt hash string.
 */
export async function hashLegacyCustomerPassword(plain: string): Promise<string> {
  return hashPassword(plain);
}

/**
 * Compares a submitted password against canonical forms of a customer's mobile number.
 * Only ever invoked when the target tenant has `org_tenants_mst.is_hq_test_demo = true`.
 *
 * @param password - Submitted plaintext password.
 * @param inputPhone - Phone number submitted in the login request.
 * @param storedPhone - Phone number stored on the customer row.
 * @returns True when the password matches one of the customer's normalized mobile formats.
 */
function isDemoMobilePasswordMatch(
  password: string,
  inputPhone: string,
  storedPhone?: string | null,
): boolean {
  const cleanedPassword = (password ?? '').trim().replace(/[\s\-\(\)]/g, '');
  if (cleanedPassword.length < 7) {
    return false;
  }

  const candidates = Array.from(
    new Set([
      ...buildPhoneLookupCandidates(inputPhone),
      ...(storedPhone ? buildPhoneLookupCandidates(storedPhone) : []),
    ]),
  );

  const submittedBuf = Buffer.from(cleanedPassword, 'utf8');
  return candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (submittedBuf.length !== candidateBuf.length) {
      return false;
    }
    return timingSafeEqual(submittedBuf, candidateBuf);
  });
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hash] = parts;
  const derived = await scryptAsync(plain, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) {
    return false;
  }
  return timingSafeEqual(derived, storedBuf);
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Returns true if the customer identified by phone + tenant has a password set.
 * @param params
 * @param params.phone
 * @param params.tenantId
 */
export async function customerHasPassword(params: {
  phone: string;
  tenantId: string;
}): Promise<boolean> {
  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return false;
  }

  const phoneCandidates = buildPhoneLookupCandidates(params.phone);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('org_customers_mst')
    .select('password_hash')
    .eq('tenant_org_id', params.tenantId)
    .in('phone', phoneCandidates)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('customerHasPassword query failed', error as Error, {
      feature: 'customer_password',
      action: 'check',
      tenantId: params.tenantId,
      phoneCandidates,
    });
    throw error;
  }

  return typeof data?.password_hash === 'string' && data.password_hash.length > 0;
}

/**
 * Sets (or replaces) the password for the customer identified by the verification token.
 * @param params
 * @param params.tenantId
 * @param params.verificationToken
 * @param params.newPassword
 */
export async function setCustomerPassword(params: {
  tenantId: string;
  verificationToken: string;
  newPassword: string;
}): Promise<void> {
  const tokenPayload = verifyVerificationToken(params.verificationToken);
  if (!tokenPayload) {
    throw new Error('Invalid or expired verification token');
  }

  const norm = normalizePhone(tokenPayload.phone);
  if (!norm.isValid) {
    throw new Error('Invalid phone in token');
  }

  if (params.newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const hash = await hashPassword(params.newPassword);

  const phoneCandidates = buildPhoneLookupCandidates(tokenPayload.phone);
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('org_customers_mst')
    .update({
      password_hash: hash,
      password_updated_at: new Date().toISOString(),
    })
    .eq('tenant_org_id', params.tenantId)
    .in('phone', phoneCandidates)
    .eq('is_active', true);

  if (error) {
    logger.error('setCustomerPassword update failed', error as Error, {
      feature: 'customer_password',
      action: 'set',
      tenantId: params.tenantId,
      phoneCandidates,
    });
    throw error;
  }
}

/**
 *
 */
export interface CustomerPasswordLoginResult {
  customerId: string;
  displayName: string | null;
  phoneNumber: string;
  tenantOrgId: string;
}

/**
 * Validates phone + password and returns session-ready customer data.
 * Returns null on wrong credentials (caller must return 401 — never leak why).
 *
 * For test/demo organizations (`org_tenants_mst.is_hq_test_demo = true`) only,
 * entering the customer's mobile number as the password is accepted to support QA testing.
 *
 * @param params
 * @param params.phone
 * @param params.password
 * @param params.tenantId - Optional only for test/demo auto-resolution; required for production tenants.
 */
export async function loginWithPassword(params: {
  phone: string;
  password: string;
  tenantId?: string;
}): Promise<CustomerPasswordLoginResult | null> {
  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return null;
  }

  const phoneCandidates = buildPhoneLookupCandidates(params.phone);
  const supabase = createAdminSupabaseClient();
  const requestedTenantId = params.tenantId?.trim() || '';

  // When no tenant is pre-selected yet (e.g. fresh mobile install), allow lookup
  // strictly across active HQ test/demo tenants only.
  if (!requestedTenantId) {
    const { data: demoTenants, error: demoTenantsError } = await supabase
      .from('org_tenants_mst')
      .select('id')
      .eq('is_hq_test_demo', true)
      .eq('is_active', true);

    if (demoTenantsError) {
      logger.error('loginWithPassword demo tenant lookup failed', demoTenantsError as Error, {
        feature: 'customer_password',
        action: 'demo_tenant_lookup',
      });
      throw demoTenantsError;
    }

    const demoTenantIds = (demoTenants ?? [])
      .map((row) => row.id as string)
      .filter((id) => Boolean(id));

    if (demoTenantIds.length === 0) {
      return null;
    }

    const { data: demoCustomer, error: demoCustomerError } = await supabase
      .from('org_customers_mst')
      .select('id, tenant_org_id, display_name, name, phone, password_hash')
      .in('tenant_org_id', demoTenantIds)
      .in('phone', phoneCandidates)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (demoCustomerError) {
      logger.error('loginWithPassword demo customer lookup failed', demoCustomerError as Error, {
        feature: 'customer_password',
        action: 'demo_customer_lookup',
      });
      throw demoCustomerError;
    }

    if (!demoCustomer) {
      return null;
    }

    const hashMatch =
      typeof demoCustomer.password_hash === 'string' && demoCustomer.password_hash.length > 0
        ? await verifyPassword(params.password, demoCustomer.password_hash)
        : false;
    const demoMobileMatch =
      !hashMatch && isDemoMobilePasswordMatch(params.password, params.phone, demoCustomer.phone);

    if (!hashMatch && !demoMobileMatch) {
      return null;
    }

    if (demoMobileMatch) {
      logger.info('Demo tenant mobile-as-password login succeeded', {
        feature: 'customer_password',
        action: 'demo_mobile_login',
        tenantId: demoCustomer.tenant_org_id,
        customerId: demoCustomer.id,
      });
    }

    return {
      customerId: demoCustomer.id,
      displayName: demoCustomer.display_name ?? demoCustomer.name ?? null,
      phoneNumber: demoCustomer.phone ?? norm.normalized,
      tenantOrgId: demoCustomer.tenant_org_id,
    };
  }

  const [tenantResult, customerResult] = await Promise.all([
    supabase
      .from('org_tenants_mst')
      .select('id, is_hq_test_demo')
      .eq('id', requestedTenantId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('org_customers_mst')
      .select('id, display_name, name, phone, password_hash')
      .eq('tenant_org_id', requestedTenantId)
      .in('phone', phoneCandidates)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  if (tenantResult.error) {
    logger.error('loginWithPassword tenant lookup failed', tenantResult.error as Error, {
      feature: 'customer_password',
      action: 'login_tenant',
      tenantId: requestedTenantId,
    });
    throw tenantResult.error;
  }

  if (customerResult.error) {
    logger.error('loginWithPassword query failed', customerResult.error as Error, {
      feature: 'customer_password',
      action: 'login',
      tenantId: requestedTenantId,
      phoneCandidates,
    });
    throw customerResult.error;
  }

  const customer = customerResult.data;
  if (!customer) {
    return null;
  }

  const isDemoTenant = tenantResult.data?.is_hq_test_demo === true;
  const hashMatch =
    typeof customer.password_hash === 'string' && customer.password_hash.length > 0
      ? await verifyPassword(params.password, customer.password_hash)
      : false;
  const demoMobileMatch =
    !hashMatch &&
    isDemoTenant &&
    isDemoMobilePasswordMatch(params.password, params.phone, customer.phone);

  if (!hashMatch && !demoMobileMatch) {
    return null;
  }

  if (demoMobileMatch) {
    logger.info('Demo tenant mobile-as-password login succeeded', {
      feature: 'customer_password',
      action: 'demo_mobile_login',
      tenantId: requestedTenantId,
      customerId: customer.id,
    });
  }

  return {
    customerId: customer.id,
    displayName: customer.display_name ?? customer.name ?? null,
    phoneNumber: customer.phone ?? norm.normalized,
    tenantOrgId: requestedTenantId,
  };
}
