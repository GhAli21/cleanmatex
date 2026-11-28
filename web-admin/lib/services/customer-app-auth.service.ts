import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { hashLegacyCustomerPassword } from './customer-password.service';
import { normalizePhone } from './customers.service';

// Short-lived bearer minimizes exposure if a mobile token is copied from an unlocked device.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
// Refresh lifetime supports a persistent mobile sign-in without retaining a password on-device.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Aligns application lockout with the public IP rate limiter to slow credential guessing.
const MAX_FAILED_SIGN_INS = 5;
// Keeps a legitimate customer recoverable while making repeated online guessing impractical.
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const TEMPORARY_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000;
// Allows memorable passphrases while rejecting short tenant-issued temporary PIN replacements.
const PASSWORD_MIN_LENGTH = 8;
// OWASP-aligned Argon2id work factors for the interactive Customer App sign-in boundary.
const ARGON2_MEMORY_KIB = 64 * 1024;
const ARGON2_PASSES = 3;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;

/** Narrow runtime contract for Node's Argon2id input parameters. */
type Argon2Parameters = {
  message: Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

/** Completion callback for Node's asynchronous Argon2id operation. */
type Argon2Callback = (error: Error | null, derivedKey?: Buffer) => void;
/** Runtime contract retained locally until the repository's Node type package exposes crypto.argon2. */
type Argon2Function = (
  algorithm: 'argon2id',
  parameters: Argon2Parameters,
  callback: Argon2Callback,
) => void;

// @types/node 20 does not yet expose the current Node runtime's crypto.argon2
// declaration. Keep the narrow local contract until the type package catches up.
const { argon2 } = require('crypto') as { argon2: Argon2Function };

/** Global Customer App login identity; tenant identity is intentionally absent. */
export type CustomerAppIdentity =
  | { kind: 'PHONE'; countryCode: string; mobileNumber: string }
  | { kind: 'EMAIL'; email: string };

/** Opaque token pair returned only over authenticated HTTPS API responses. */
export interface CustomerAppTokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Customer-safe result returned after password verification. */
export interface CustomerAppSignInResult {
  customerId: string;
  displayName: string | null;
  mobileE164: string | null;
  email: string | null;
  requiresPasswordChange: boolean;
  tokens: CustomerAppTokenPair;
}

/** Verified server-side session context for subsequent Customer App authorization. */
export interface CustomerAppSessionContext {
  customerId: string;
  sessionId: string;
  requiresPasswordChange: boolean;
}

/** Stable internal error vocabulary that routes map to non-enumerating public responses. */
export class CustomerAppAuthError extends Error {
  /**
   * @param code - Internal reason retained for server-side response mapping only.
   */
  constructor(
    public readonly code:
      | 'INVALID_CREDENTIALS'
      | 'PASSWORD_CHANGE_REQUIRED'
      | 'INVALID_SESSION'
      | 'INVALID_PASSWORD',
  ) {
    super(code);
    this.name = 'CustomerAppAuthError';
  }
}

/** Minimal credential projection so password and lockout fields never spread through feature code. */
type CustomerCredentialRow = {
  id: string;
  display_name: string | null;
  mobile_e164: string | null;
  email_normalized: string | null;
  app_password_hash: string | null;
  app_password_must_change: boolean;
  app_temp_password_expires_at: string | null;
  app_failed_sign_in_count: number;
  app_locked_until: string | null;
  app_session_version: number;
};

/**
 * Hashes high-entropy opaque tokens before persistence so a database read cannot replay a session.
 *
 * @param token - Raw opaque token received or issued only within the current request.
 * @returns Stable SHA-256 lookup value.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Generates an opaque token with enough entropy to resist offline guessing. */
function issueOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Derives an Argon2id key using the feature's fixed interactive work factors.
 *
 * @param password - Plaintext supplied only within the request lifetime.
 * @param nonce - Unique per-password salt retained alongside the derived key.
 * @returns Promise resolving to the fixed-length derived key.
 */
function deriveArgon2id(password: string, nonce: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: Buffer.from(password, 'utf8'),
        nonce,
        parallelism: ARGON2_PARALLELISM,
        tagLength: ARGON2_TAG_LENGTH,
        memory: ARGON2_MEMORY_KIB,
        passes: ARGON2_PASSES,
      },
      (error, derivedKey) => {
        if (error || !derivedKey) {
          reject(error ?? new Error('Argon2id derivation did not return a key'));
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

/**
 * Builds a self-describing Argon2id password record suitable for the global Customer App authority.
 *
 * @param password - New plaintext password, never written to logs or database columns.
 * @returns Versioned Argon2id record containing salt and derived key.
 */
async function hashCustomerAppPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derivedKey = await deriveArgon2id(password, nonce);
  return `argon2id:v1:${nonce.toString('base64url')}:${derivedKey.toString('base64url')}`;
}

/**
 * Verifies a presented password without accepting legacy or malformed hash encodings.
 *
 * @param password - Plaintext password supplied for this request only.
 * @param storedHash - Persisted versioned Argon2id record.
 * @returns True only when the derived key matches in constant time.
 */
async function verifyCustomerAppPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, version, nonceValue, hashValue] = storedHash.split(':');
  if (algorithm !== 'argon2id' || version !== 'v1' || !nonceValue || !hashValue) return false;

  try {
    const nonce = Buffer.from(nonceValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    if (nonce.length !== 16 || expected.length !== ARGON2_TAG_LENGTH) return false;
    const actual = await deriveArgon2id(password, nonce);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * Normalizes one login identity into the unique global database column and value.
 *
 * @param identity - Phone fields or email entered by the customer.
 * @returns Canonical lookup input, or null when the identity is invalid.
 */
function normalizeIdentity(identity: CustomerAppIdentity):
  | { column: 'mobile_e164'; value: string }
  | { column: 'email_normalized'; value: string }
  | null {
  if (identity.kind === 'EMAIL') {
    const value = identity.email.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? { column: 'email_normalized', value }
      : null;
  }

  const countryCode = identity.countryCode.trim();
  const mobileNumber = identity.mobileNumber.trim();
  if (!/^\+\d{1,3}$/.test(countryCode) || !/^\d{4,14}$/.test(mobileNumber)) {
    return null;
  }

  const phone = normalizePhone(`${countryCode}${mobileNumber}`, countryCode);
  return phone.isValid ? { column: 'mobile_e164', value: phone.normalized } : null;
}

/**
 * Finds only the credential projection required for global login.
 *
 * @param identity - Global login identity after client-side entry validation.
 * @returns Matching credential record, or null without disclosing account existence.
 */
async function findCustomer(
  identity: CustomerAppIdentity,
): Promise<CustomerCredentialRow | null> {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('sys_customers_mst')
    .select(
      'id, display_name, mobile_e164, email_normalized, app_password_hash, app_password_must_change, app_temp_password_expires_at, app_failed_sign_in_count, app_locked_until, app_session_version',
    )
    .eq(normalized.column, normalized.value)
    .maybeSingle();

  if (error) {
    logger.error('Customer App global identity lookup failed', error as Error, {
      feature: 'customer_app_auth',
      action: 'find_customer',
      identityKind: identity.kind,
    });
    throw error;
  }

  return data as CustomerCredentialRow | null;
}

/**
 * Issues one persisted opaque token pair under the customer session epoch.
 *
 * @param customerId - Global customer identity that owns the new session.
 * @param sessionVersion - Current customer-wide invalidation epoch.
 * @returns Newly generated opaque access and refresh credentials.
 */
async function createSession(
  customerId: string,
  sessionVersion: number,
): Promise<CustomerAppTokenPair> {
  const accessToken = issueOpaqueToken();
  const refreshToken = issueOpaqueToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from('sys_cust_app_sessions_mst').insert({
    customer_id: customerId,
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    session_version: sessionVersion,
    access_expires_at: accessExpiresAt.toISOString(),
    refresh_expires_at: refreshExpiresAt.toISOString(),
    created_by: 'customer-app-auth',
    created_info: 'customer_app',
  });

  if (error) {
    logger.error('Customer App session creation failed', error as Error, {
      feature: 'customer_app_auth',
      action: 'create_session',
      customerId,
    });
    throw error;
  }

  return {
    accessToken,
    accessTokenExpiresAt: accessExpiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
}

/**
 * Records a generic failed sign-in without exposing identity state to the caller.
 *
 * @param customer - Credential projection whose lockout state must be updated.
 * @returns Promise that resolves after best-effort accounting; authentication remains failed if audit storage is unavailable.
 */
async function recordFailedSignIn(customer: CustomerCredentialRow): Promise<void> {
  const failedCount = Math.min(customer.app_failed_sign_in_count + 1, MAX_FAILED_SIGN_INS);
  const lockedUntil =
    failedCount >= MAX_FAILED_SIGN_INS
      ? new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString()
      : null;
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('sys_customers_mst')
    .update({
      app_failed_sign_in_count: failedCount,
      app_locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
      updated_info: 'failed_sign_in',
    })
    .eq('id', customer.id);

  if (error) {
    logger.error('Customer App failed sign-in accounting failed', error as Error, {
      feature: 'customer_app_auth',
      action: 'record_failed_sign_in',
      customerId: customer.id,
    });
  }
}

/**
 * Determines whether a prior lockout is still active at the current UTC instant.
 *
 * @param customer - Credential projection containing the lockout deadline.
 * @returns True when login must remain blocked.
 */
function isTemporarilyLocked(customer: CustomerCredentialRow): boolean {
  return customer.app_locked_until !== null && new Date(customer.app_locked_until).getTime() > Date.now();
}

/**
 * Determines whether a tenant-issued temporary password can no longer start the activation flow.
 *
 * @param customer - Credential projection containing forced-change state and expiry.
 * @returns True when the temporary credential has expired.
 */
function isTemporaryPasswordExpired(customer: CustomerCredentialRow): boolean {
  return (
    customer.app_password_must_change &&
    customer.app_temp_password_expires_at !== null &&
    new Date(customer.app_temp_password_expires_at).getTime() <= Date.now()
  );
}

/**
 * Authenticates one global Customer App identity without receiving a tenant ID.
 * It always returns the same public credential failure for absent, locked, or
 * invalid records, preventing account-state enumeration.
 *
 * @param params - Global identity and password supplied for this one login attempt.
 * @param params.identity - Phone or email identity; never a client-selected tenant.
 * @param params.password - Plaintext password used only for Argon2id verification.
 * @returns Customer-safe profile data, forced-change state, and opaque token pair.
 * @throws CustomerAppAuthError when credentials are absent, invalid, locked, or expired.
 *
 * @example
 * const result = await signInCustomerApp({
 *   identity: { kind: 'PHONE', countryCode: '+968', mobileNumber: '90123456' },
 *   password: 'temporary-password',
 * });
 */
export async function signInCustomerApp(params: {
  identity: CustomerAppIdentity;
  password: string;
}): Promise<CustomerAppSignInResult> {
  const customer = await findCustomer(params.identity);
  if (
    !customer ||
    !customer.app_password_hash ||
    isTemporarilyLocked(customer) ||
    isTemporaryPasswordExpired(customer)
  ) {
    if (customer) await recordFailedSignIn(customer);
    throw new CustomerAppAuthError('INVALID_CREDENTIALS');
  }

  const passwordMatches = await verifyCustomerAppPassword(params.password, customer.app_password_hash);
  if (!passwordMatches) {
    await recordFailedSignIn(customer);
    throw new CustomerAppAuthError('INVALID_CREDENTIALS');
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('sys_customers_mst')
    .update({
      app_failed_sign_in_count: 0,
      app_locked_until: null,
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
      updated_info: 'successful_sign_in',
    })
    .eq('id', customer.id);
  if (error) throw error;

  return {
    customerId: customer.id,
    displayName: customer.display_name,
    mobileE164: customer.mobile_e164,
    email: customer.email_normalized,
    requiresPasswordChange: customer.app_password_must_change,
    tokens: await createSession(customer.id, customer.app_session_version),
  };
}

/** Safe credential metadata returned to authorized tenant staff (never includes hashes or plaintext). */
export interface CustomerAppCredentialStatus {
  hasPassword: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  tempPasswordExpiresAt: string | null;
  isLocked: boolean;
  hasContactIdentity: boolean;
}

/**
 * Resolves the tenant-owned customer relationship and guarantees a linked global
 * `sys_customers_mst` record when at least one valid phone or email exists.
 *
 * @param params - Authenticated tenant staff context and Organization customer ID.
 * @returns Global customer ID linked to the tenant customer row.
 */
async function resolveOrLinkGlobalCustomerForStaff(params: {
  tenantId: string;
  orgCustomerId: string;
  actorId: string;
}): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data: orgCustomer, error: orgCustomerError } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id, phone, email, display_name, first_name, last_name')
    .eq('tenant_org_id', params.tenantId)
    .eq('id', params.orgCustomerId)
    .eq('is_active', true)
    .maybeSingle();
  if (orgCustomerError) throw orgCustomerError;
  if (!orgCustomer) throw new Error('Customer relationship was not found');

  let customerId = orgCustomer.customer_id;
  if (!customerId) {
    const mobile = orgCustomer.phone ? normalizePhone(orgCustomer.phone).normalized : null;
    const validMobile = mobile && /^\+\d{10,15}$/.test(mobile) ? mobile : null;
    const normalizedEmail = orgCustomer.email?.trim().toLowerCase() || null;
    const validEmail = normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
      ? normalizedEmail
      : null;
    if (!validMobile && !validEmail) {
      throw new Error('Customer needs a valid mobile number or email before an app password can be issued');
    }

    const [mobileResult, emailResult] = await Promise.all([
      validMobile
        ? supabase.from('sys_customers_mst').select('id').eq('mobile_e164', validMobile).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      validEmail
        ? supabase.from('sys_customers_mst').select('id').eq('email_normalized', validEmail).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (mobileResult.error) throw mobileResult.error;
    if (emailResult.error) throw emailResult.error;
    if (mobileResult.data && emailResult.data && mobileResult.data.id !== emailResult.data.id) {
      throw new Error('Customer mobile and email belong to different global customer identities');
    }

    const existingGlobalCustomer = mobileResult.data ?? emailResult.data;
    if (existingGlobalCustomer) {
      customerId = existingGlobalCustomer.id;
    } else {
      // The database requires a code (0855) and fills none by itself.
      const { data: customerCode, error: customerCodeError } = await supabase.rpc('gen_sys_customer_code');
      if (customerCodeError) throw customerCodeError;
      const { data: createdGlobalCustomer, error: createGlobalCustomerError } = await supabase
        .from('sys_customers_mst')
        .insert({
          customer_code: customerCode,
          first_name: orgCustomer.first_name,
          last_name: orgCustomer.last_name,
          display_name: orgCustomer.display_name,
          phone: orgCustomer.phone,
          email: orgCustomer.email,
          mobile_e164: validMobile,
          email_normalized: validEmail,
          first_tenant_org_id: params.tenantId,
          created_by: params.actorId,
          created_info: 'customer_app_credential_link',
        })
        .select('id')
        .single();
      if (createGlobalCustomerError) throw createGlobalCustomerError;
      customerId = createdGlobalCustomer.id;
    }

    const { error: linkError } = await supabase
      .from('org_customers_mst')
      .update({
        customer_id: customerId,
        updated_at: new Date().toISOString(),
        updated_by: params.actorId,
        updated_info: 'customer_app_credential_link',
      })
      .eq('tenant_org_id', params.tenantId)
      .eq('id', params.orgCustomerId);
    if (linkError) throw linkError;
  }

  return customerId;
}

/**
 * Reads safe Customer App password status for a tenant-owned customer row.
 * Never returns password hashes or plaintext secrets.
 *
 * @param params - Authenticated tenant ID and Organization customer ID.
 * @returns Non-sensitive password state for staff visibility.
 */
export async function getCustomerAppCredentialStatus(params: {
  tenantId: string;
  orgCustomerId: string;
}): Promise<CustomerAppCredentialStatus> {
  const supabase = createAdminSupabaseClient();
  const { data: orgCustomer, error: orgCustomerError } = await supabase
    .from('org_customers_mst')
    .select('id, customer_id, phone, email, password_hash, password_updated_at')
    .eq('tenant_org_id', params.tenantId)
    .eq('id', params.orgCustomerId)
    .eq('is_active', true)
    .maybeSingle();

  if (orgCustomerError) throw orgCustomerError;
  if (!orgCustomer) throw new Error('Customer relationship was not found');

  const mobile = orgCustomer.phone ? normalizePhone(orgCustomer.phone).normalized : null;
  const validMobile = Boolean(mobile && /^\+\d{10,15}$/.test(mobile));
  const normalizedEmail = orgCustomer.email?.trim().toLowerCase() || '';
  const validEmail = Boolean(normalizedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail));
  const hasContactIdentity = validMobile || validEmail;

  let sysHasPassword = false;
  let mustChangePassword = false;
  let sysPasswordChangedAt: string | null = null;
  let tempPasswordExpiresAt: string | null = null;
  let isLocked = false;

  if (orgCustomer.customer_id) {
    const { data: sysCustomer, error: sysError } = await supabase
      .from('sys_customers_mst')
      .select(
        'app_password_hash, app_password_changed_at, app_password_must_change, app_temp_password_expires_at, app_locked_until',
      )
      .eq('id', orgCustomer.customer_id)
      .maybeSingle();
    if (sysError) throw sysError;
    if (sysCustomer) {
      sysHasPassword = typeof sysCustomer.app_password_hash === 'string' && sysCustomer.app_password_hash.length > 0;
      mustChangePassword = Boolean(sysCustomer.app_password_must_change);
      sysPasswordChangedAt = (sysCustomer.app_password_changed_at as string | null) ?? null;
      tempPasswordExpiresAt = (sysCustomer.app_temp_password_expires_at as string | null) ?? null;
      isLocked =
        sysCustomer.app_locked_until !== null &&
        new Date(sysCustomer.app_locked_until as string).getTime() > Date.now();
    }
  }

  const orgHasPassword =
    typeof orgCustomer.password_hash === 'string' && orgCustomer.password_hash.length > 0;

  return {
    hasPassword: sysHasPassword || orgHasPassword,
    mustChangePassword,
    passwordChangedAt: sysPasswordChangedAt ?? ((orgCustomer.password_updated_at as string | null) ?? null),
    tempPasswordExpiresAt,
    isLocked,
    hasContactIdentity,
  };
}

/**
 * Sets or resets a Customer App password directly by authorized tenant staff.
 * Updates both the global Argon2id authority (`sys_customers_mst`) and the tenant-scoped
 * scrypt hash (`org_customers_mst`), clears lockouts, and revokes existing mobile sessions.
 *
 * @param params - Staff actor, tenant customer ID, replacement password, and forced-change flag.
 * @returns Updated safe credential metadata.
 */
export async function setCustomerAppPasswordByStaff(params: {
  tenantId: string;
  orgCustomerId: string;
  actorId: string;
  newPassword: string;
  requirePasswordChange?: boolean;
}): Promise<CustomerAppCredentialStatus> {
  if (params.newPassword.length < PASSWORD_MIN_LENGTH || params.newPassword.length > 128) {
    throw new CustomerAppAuthError('INVALID_PASSWORD');
  }

  const supabase = createAdminSupabaseClient();
  const customerId = await resolveOrLinkGlobalCustomerForStaff({
    tenantId: params.tenantId,
    orgCustomerId: params.orgCustomerId,
    actorId: params.actorId,
  });

  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .select('app_session_version')
    .eq('id', customerId)
    .single();
  if (customerError) throw customerError;

  const nowIso = new Date().toISOString();
  const [argon2Hash, legacyScryptHash] = await Promise.all([
    hashCustomerAppPassword(params.newPassword),
    hashLegacyCustomerPassword(params.newPassword),
  ]);

  const { error: credentialError } = await supabase
    .from('sys_customers_mst')
    .update({
      app_password_hash: argon2Hash,
      app_password_changed_at: nowIso,
      app_password_must_change: Boolean(params.requirePasswordChange),
      app_temp_password_expires_at: null,
      app_failed_sign_in_count: 0,
      app_locked_until: null,
      app_session_version: customer.app_session_version + 1,
      updated_at: nowIso,
      updated_by: params.actorId,
      updated_info: 'staff_password_set',
    })
    .eq('id', customerId)
    .eq('app_session_version', customer.app_session_version);
  if (credentialError) throw credentialError;

  const { error: orgUpdateError } = await supabase
    .from('org_customers_mst')
    .update({
      password_hash: legacyScryptHash,
      password_updated_at: nowIso,
      updated_at: nowIso,
      updated_by: params.actorId,
      updated_info: 'staff_password_set',
    })
    .eq('tenant_org_id', params.tenantId)
    .eq('id', params.orgCustomerId);
  if (orgUpdateError) throw orgUpdateError;

  const { error: revokeError } = await supabase
    .from('sys_cust_app_sessions_mst')
    .update({
      revoked_at: nowIso,
      revoke_reason_code: 'PASSWORD_RESET',
      updated_at: nowIso,
      updated_by: params.actorId,
    })
    .eq('customer_id', customerId)
    .is('revoked_at', null);
  if (revokeError) throw revokeError;

  return getCustomerAppCredentialStatus({
    tenantId: params.tenantId,
    orgCustomerId: params.orgCustomerId,
  });
}

/**
 * Issues a one-time six-digit temporary password for a tenant-owned customer.
 * The tenant relationship lookup is explicitly scoped before any global
 * identity is loaded or linked, so a staff member cannot issue a credential
 * for another Organization's customer row.
 *
 * @param params - Authenticated tenant staff context and Organization customer ID.
 * @returns The plaintext temporary password exactly once and its UTC expiry.
 */
export async function issueCustomerAppTemporaryPassword(params: {
  tenantId: string;
  orgCustomerId: string;
  actorId: string;
}): Promise<{ temporaryPassword: string; expiresAt: string }> {
  const supabase = createAdminSupabaseClient();
  const customerId = await resolveOrLinkGlobalCustomerForStaff(params);

  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .select('app_session_version')
    .eq('id', customerId)
    .single();
  if (customerError) throw customerError;

  const temporaryPassword = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MS).toISOString();
  const nowIso = new Date().toISOString();
  const [argon2Hash, legacyScryptHash] = await Promise.all([
    hashCustomerAppPassword(temporaryPassword),
    hashLegacyCustomerPassword(temporaryPassword),
  ]);

  const { error: credentialError } = await supabase
    .from('sys_customers_mst')
    .update({
      app_password_hash: argon2Hash,
      app_password_changed_at: nowIso,
      app_password_must_change: true,
      app_temp_password_expires_at: expiresAt,
      app_failed_sign_in_count: 0,
      app_locked_until: null,
      app_session_version: customer.app_session_version + 1,
      updated_at: nowIso,
      updated_by: params.actorId,
      updated_info: 'temporary_password_issued',
    })
    .eq('id', customerId)
    .eq('app_session_version', customer.app_session_version);
  if (credentialError) throw credentialError;

  // Keep per-tenant scrypt fallback aligned with the newly issued temporary password.
  const { error: orgUpdateError } = await supabase
    .from('org_customers_mst')
    .update({
      password_hash: legacyScryptHash,
      password_updated_at: nowIso,
      updated_at: nowIso,
      updated_by: params.actorId,
      updated_info: 'temporary_password_issued',
    })
    .eq('tenant_org_id', params.tenantId)
    .eq('id', params.orgCustomerId);
  if (orgUpdateError) throw orgUpdateError;

  const { error: revokeError } = await supabase
    .from('sys_cust_app_sessions_mst')
    .update({
      revoked_at: nowIso,
      revoke_reason_code: 'PASSWORD_RESET',
      updated_at: nowIso,
      updated_by: params.actorId,
    })
    .eq('customer_id', customerId)
    .is('revoked_at', null);
  if (revokeError) throw revokeError;

  return { temporaryPassword, expiresAt };
}

/**
 * Resolves a Customer App access token and keeps forced password changes from becoming full sessions.
 *
 * @param params - Opaque access token and the endpoint's forced-change admission policy.
 * @param params.accessToken - Raw bearer token received only through HTTPS authorization header.
 * @param params.allowPasswordChange - Allows the restricted password-change endpoint to use a forced-change session.
 * @returns Verified customer and session identifiers for server-side authorization.
 * @throws CustomerAppAuthError when the session is expired, revoked, stale, or insufficient for the endpoint.
 *
 * @example
 * const session = await resolveCustomerAppSession({ accessToken: bearerToken });
 */
export async function resolveCustomerAppSession(params: {
  accessToken: string;
  allowPasswordChange?: boolean;
}): Promise<CustomerAppSessionContext> {
  const supabase = createAdminSupabaseClient();
  const { data: session, error } = await supabase
    .from('sys_cust_app_sessions_mst')
    .select('id, customer_id, session_version, access_expires_at, revoked_at')
    .eq('access_token_hash', hashToken(params.accessToken))
    .maybeSingle();

  if (error) throw error;
  if (!session || session.revoked_at || new Date(session.access_expires_at).getTime() <= Date.now()) {
    throw new CustomerAppAuthError('INVALID_SESSION');
  }

  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .select('app_password_must_change, app_session_version')
    .eq('id', session.customer_id)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer || customer.app_session_version !== session.session_version) {
    throw new CustomerAppAuthError('INVALID_SESSION');
  }
  if (customer.app_password_must_change && !params.allowPasswordChange) {
    throw new CustomerAppAuthError('PASSWORD_CHANGE_REQUIRED');
  }

  await supabase
    .from('sys_cust_app_sessions_mst')
    .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('customer_id', session.customer_id);

  return {
    customerId: session.customer_id,
    sessionId: session.id,
    requiresPasswordChange: customer.app_password_must_change,
  };
}

/**
 * Replaces a temporary or existing password and invalidates every prior session.
 *
 * @param params - Presenting access token and replacement password.
 * @param params.accessToken - Restricted access token proving current customer control.
 * @param params.newPassword - Customer-selected replacement password, never persisted in plaintext.
 * @returns Fresh opaque session tokens under the incremented global session epoch.
 * @throws CustomerAppAuthError when session validation or password policy fails.
 *
 * @example
 * const tokens = await changeCustomerAppPassword({ accessToken: bearerToken, newPassword: 'Safer passphrase 2026' });
 */
export async function changeCustomerAppPassword(params: {
  accessToken: string;
  newPassword: string;
}): Promise<CustomerAppTokenPair> {
  if (params.newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new CustomerAppAuthError('INVALID_PASSWORD');
  }

  const session = await resolveCustomerAppSession({
    accessToken: params.accessToken,
    allowPasswordChange: true,
  });
  const supabase = createAdminSupabaseClient();
  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .select('app_session_version')
    .eq('id', session.customerId)
    .single();
  if (customerError) throw customerError;

  const newSessionVersion = customer.app_session_version + 1;
  const { error: updateError } = await supabase
    .from('sys_customers_mst')
    .update({
      app_password_hash: await hashCustomerAppPassword(params.newPassword),
      app_password_changed_at: new Date().toISOString(),
      app_password_must_change: false,
      app_temp_password_expires_at: null,
      app_failed_sign_in_count: 0,
      app_locked_until: null,
      app_session_version: newSessionVersion,
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
      updated_info: 'password_changed',
    })
    .eq('id', session.customerId)
    .eq('app_session_version', customer.app_session_version);
  if (updateError) throw updateError;

  await supabase
    .from('sys_cust_app_sessions_mst')
    .update({
      revoked_at: new Date().toISOString(),
      revoke_reason_code: 'PASSWORD_CHANGED',
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
    })
    .eq('customer_id', session.customerId)
    .is('revoked_at', null);

  return createSession(session.customerId, newSessionVersion);
}

/**
 * Revokes only the presenting Customer App session, preserving sessions on other customer devices.
 *
 * @param accessToken - Opaque access token that identifies the session to revoke.
 * @returns Promise that resolves once logout is persisted.
 * @throws CustomerAppAuthError when the presented session is no longer valid.
 *
 * @example
 * await signOutCustomerApp(bearerToken);
 */
export async function signOutCustomerApp(accessToken: string): Promise<void> {
  const session = await resolveCustomerAppSession({ accessToken, allowPasswordChange: true });
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from('sys_cust_app_sessions_mst')
    .update({
      revoked_at: new Date().toISOString(),
      revoke_reason_code: 'LOGOUT',
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
    })
    .eq('id', session.sessionId)
    .eq('customer_id', session.customerId)
    .is('revoked_at', null);
  if (error) throw error;
}

/**
 * Rotates a valid opaque refresh token. The hash predicate makes one presented
 * refresh token usable once even when two app requests race.
 *
 * @param refreshToken - Opaque refresh token stored in secure device storage.
 * @returns Newly rotated opaque access and refresh tokens.
 * @throws CustomerAppAuthError when the token is expired, revoked, stale, or already rotated.
 *
 * @example
 * const tokens = await refreshCustomerAppSession(savedRefreshToken);
 */
export async function refreshCustomerAppSession(refreshToken: string): Promise<CustomerAppTokenPair> {
  const supabase = createAdminSupabaseClient();
  const presentedHash = hashToken(refreshToken);
  const { data: current, error: currentError } = await supabase
    .from('sys_cust_app_sessions_mst')
    .select('id, customer_id, session_version, refresh_expires_at, revoked_at')
    .eq('refresh_token_hash', presentedHash)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current || current.revoked_at || new Date(current.refresh_expires_at).getTime() <= Date.now()) {
    throw new CustomerAppAuthError('INVALID_SESSION');
  }

  const { data: customer, error: customerError } = await supabase
    .from('sys_customers_mst')
    .select('app_session_version')
    .eq('id', current.customer_id)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer || customer.app_session_version !== current.session_version) {
    throw new CustomerAppAuthError('INVALID_SESSION');
  }

  const accessToken = issueOpaqueToken();
  const nextRefreshToken = issueOpaqueToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const { data: rotated, error: rotateError } = await supabase
    .from('sys_cust_app_sessions_mst')
    .update({
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(nextRefreshToken),
      access_expires_at: accessExpiresAt.toISOString(),
      refresh_expires_at: refreshExpiresAt.toISOString(),
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: 'customer-app-auth',
      updated_info: 'refresh_rotated',
    })
    .eq('id', current.id)
    .eq('customer_id', current.customer_id)
    .eq('refresh_token_hash', presentedHash)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (rotateError) throw rotateError;
  if (!rotated) throw new CustomerAppAuthError('INVALID_SESSION');

  return {
    accessToken,
    accessTokenExpiresAt: accessExpiresAt.toISOString(),
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
}

/**
 * Extracts a bearer token without attempting to validate it in the route layer.
 *
 * @param authorization - Raw Authorization header from the HTTPS request.
 * @returns Opaque bearer token or null when the header is absent or malformed.
 */
export function extractCustomerAppBearerToken(authorization: string | null): string | null {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
