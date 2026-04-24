import { promisify } from 'util';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { normalizePhone } from './customers.service';
import { verifyVerificationToken } from './otp.service';

const scryptAsync = promisify(scrypt);

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
  const derived = (await scryptAsync(plain, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  })) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hash] = parts;
  const derived = (await scryptAsync(plain, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  })) as Buffer;
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) {
    return false;
  }
  return timingSafeEqual(derived, storedBuf);
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/** Returns true if the customer identified by phone + tenant has a password set. */
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

/** Sets (or replaces) the password for the customer identified by the verification token. */
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

export interface CustomerPasswordLoginResult {
  customerId: string;
  displayName: string | null;
  phoneNumber: string;
  tenantOrgId: string;
}

/**
 * Validates phone + password and returns session-ready customer data.
 * Returns null on wrong credentials (caller must return 401 — never leak why).
 */
export async function loginWithPassword(params: {
  phone: string;
  password: string;
  tenantId: string;
}): Promise<CustomerPasswordLoginResult | null> {
  const norm = normalizePhone(params.phone);
  if (!norm.isValid) {
    return null;
  }

  const phoneCandidates = buildPhoneLookupCandidates(params.phone);
  const supabase = createAdminSupabaseClient();
  const { data: customer, error } = await supabase
    .from('org_customers_mst')
    .select('id, display_name, name, phone, password_hash')
    .eq('tenant_org_id', params.tenantId)
    .in('phone', phoneCandidates)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('loginWithPassword query failed', error as Error, {
      feature: 'customer_password',
      action: 'login',
      tenantId: params.tenantId,
      phoneCandidates,
    });
    throw error;
  }

  if (!customer || !customer.password_hash) {
    return null;
  }

  const match = await verifyPassword(params.password, customer.password_hash);
  if (!match) {
    return null;
  }

  return {
    customerId: customer.id,
    displayName: customer.display_name ?? customer.name ?? null,
    phoneNumber: customer.phone ?? norm.normalized,
    tenantOrgId: params.tenantId,
  };
}
