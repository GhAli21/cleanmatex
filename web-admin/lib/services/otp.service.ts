/**
 * Customer verification codes (OTP). Docs: docs/features/Background_Jobs/STEP5_PLAN.md item 5.
 *
 * sendOTP: a random 6-digit code, stored only as an HMAC, sent at once through the notification
 * outbox (SMS, WhatsApp or email; HQ API delivers it). Limits per phone and per IP, SMS/WhatsApp only
 * to the countries served. verifyOTP: counts each attempt before comparing, so parallel guesses
 * cannot pass the limit. The verification token is signed with the same secret.
 */
import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { normalizePhoneInput } from '@/lib/phone/phone-utils';
import { renderChannelTemplate } from '@/lib/notifications/template-renderer';
import { notificationSettingsService } from '@/lib/notifications/settings-service';
import { IMMEDIATE_SEND_PRIORITY, queueImmediateSendTx } from '@/lib/notifications/immediate-send.service';
import {
  OTP_ALLOWED_COUNTRIES,
  OTP_EVENT_CODE,
  OTP_LIMITS,
  OTP_SEND_ERROR,
  type OtpChannel,
  type OtpSendErrorCode,
} from '@/lib/constants/otp';
import type { OTPPurpose, OTPVerificationResponse, SendOTPResponse, VerifyOTPRequest } from '@/lib/types/customer';
import { maskPhone } from './customers.service';

/** A refused send; the route answers `status` with `code`. */
export class OtpSendError extends Error {
  constructor(readonly code: OtpSendErrorCode, readonly status: number) {
    super(code);
    this.name = 'OtpSendError';
  }
}

export interface SendOtpInput {
  tenantId: string;
  userId: string;
  phone: string;
  purpose: OTPPurpose;
  channel: OtpChannel;
  /** Required for EMAIL. The code still verifies `phone`. */
  email?: string | null;
  /** Known customer: the message uses their language. */
  customerId?: string | null;
  requestIp: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hmac(data: string): Buffer {
  const secret = process.env.OTP_HMAC_SECRET;
  // Fail closed: without the secret, codes and tokens could be forged.
  if (!secret || secret.length < 32) throw new Error('OTP_HMAC_SECRET is not set (at least 32 characters)');
  return createHmac('sha256', secret).update(data).digest();
}

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Stored form of a code: HMAC of phone and code (hex). */
export function hashOtpCode(phone: string, code: string): string {
  return hmac(`otp:${phone}:${code}`).toString('hex');
}

/** E.164 of a phone typed in any local or international form (Oman when no country code), or null. */
function toE164(phone: string): { e164: string; country: string | undefined } | null {
  const parsed = normalizePhoneInput(phone ?? '', 'OM');
  return parsed.e164 && parsed.isValid ? { e164: parsed.e164, country: parsed.country } : null;
}

// ==================================================================
// VERIFICATION TOKEN
// ==================================================================

/**
 * Signed proof that a phone was verified: `v1.<payload>.<signature>` (base64url).
 * @param phone Verified phone embedded in the token.
 */
export function generateVerificationToken(phone: string): string {
  const payload = Buffer.from(JSON.stringify({
    phone,
    exp: Date.now() + OTP_LIMITS.VERIFICATION_TOKEN_MINUTES * 60_000,
  })).toString('base64url');
  return `v1.${payload}.${hmac(`token:${payload}`).toString('base64url')}`;
}

/**
 * The phone of a valid, unexpired token; null for anything unsigned, tampered or expired.
 * @param token Bearer token from generateVerificationToken.
 */
export function verifyVerificationToken(token: string): { phone: string } | null {
  const parts = (token ?? '').split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) return null;
  const [, payload, signature] = parts;
  if (!sameBytes(Buffer.from(signature, 'base64url'), hmac(`token:${payload}`))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { phone?: unknown; exp?: unknown };
    if (typeof data.phone !== 'string' || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { phone: data.phone };
  } catch {
    return null;
  }
}

// ==================================================================
// SEND
// ==================================================================

/**
 * Creates a code and queues its message. Throws OtpSendError for a refused request.
 * @param input Who asks, for which phone, on which channel.
 */
export async function sendOTP(input: SendOtpInput): Promise<SendOTPResponse> {
  const parsed = toE164(input.phone);
  if (!parsed) throw new OtpSendError(OTP_SEND_ERROR.INVALID_PHONE, 400);
  const phone = parsed.e164;

  let address = phone;
  if (input.channel === 'EMAIL') {
    const email = input.email?.trim().toLowerCase();
    if (!email || !EMAIL_PATTERN.test(email)) throw new OtpSendError(OTP_SEND_ERROR.EMAIL_REQUIRED, 400);
    address = email;
  } else if (!(OTP_ALLOWED_COUNTRIES as readonly string[]).includes(parsed.country ?? '')) {
    throw new OtpSendError(OTP_SEND_ERROR.COUNTRY_NOT_ALLOWED, 422);
  }
  if (!(await notificationSettingsService.isChannelEnabled(input.tenantId, input.channel))) {
    throw new OtpSendError(OTP_SEND_ERROR.CHANNEL_OFF, 422);
  }

  const [tenant, customer] = await Promise.all([
    prisma.org_tenants_mst.findFirst({ where: { id: input.tenantId }, select: { name: true, name2: true, language: true } }),
    input.customerId
      ? prisma.org_customers_mst.findFirst({
          where: { id: input.customerId, tenant_org_id: input.tenantId },
          select: { preferred_language: true },
        })
      : null,
  ]);
  const language = customer?.preferred_language?.trim() || tenant?.language?.trim() || 'en';
  const arabic = language.toLowerCase().startsWith('ar');

  const code = String(randomInt(0, 10 ** OTP_LIMITS.LENGTH)).padStart(OTP_LIMITS.LENGTH, '0');
  const variables = {
    tenant_name: (arabic && tenant?.name2) || tenant?.name || 'CleanMateX',
    otp_code: code,
    expires_minutes: String(OTP_LIMITS.EXPIRY_MINUTES),
  };
  const rendered = await renderChannelTemplate(OTP_EVENT_CODE, input.channel, variables);
  const body = (arabic && rendered.body2) || rendered.body;
  // The renderer falls back to generic text when the template is missing; that text has no code.
  if (!body.includes(code)) throw new Error(`OTP template ${OTP_EVENT_CODE}/${input.channel} does not contain {{otp_code}}`);

  const now = Date.now();
  const ttlMs = OTP_LIMITS.EXPIRY_MINUTES * 60_000;
  const expiresAt = new Date(now + ttlMs);
  // Windows count on expires_at (UTC wall-clock written here); created_at holds database-local time.
  const hourAgo = new Date(now + ttlMs - 3_600_000);
  const cooldownStart = new Date(now + ttlMs - OTP_LIMITS.PHONE_COOLDOWN_SECONDS * 1000);

  const outboxId = await withTenantContext(input.tenantId, () => prisma.$transaction(async (tx) => {
    // One sender per phone at a time, so two parallel requests cannot both pass the limits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`otp:${phone}`}::text, 0))`;
    const [recent, phoneHour, ipHour] = await Promise.all([
      tx.sys_otp_codes.count({ where: { phone, expires_at: { gt: cooldownStart } } }),
      tx.sys_otp_codes.count({ where: { phone, expires_at: { gt: hourAgo } } }),
      input.requestIp ? tx.sys_otp_codes.count({ where: { request_ip: input.requestIp, expires_at: { gt: hourAgo } } }) : 0,
    ]);
    if (recent > 0 || phoneHour >= OTP_LIMITS.PHONE_PER_HOUR || ipHour >= OTP_LIMITS.IP_PER_HOUR) {
      throw new OtpSendError(OTP_SEND_ERROR.RATE_LIMITED, 429);
    }

    const row = await tx.sys_otp_codes.create({
      data: {
        phone,
        code: hashOtpCode(phone, code),
        purpose: input.purpose,
        expires_at: expiresAt,
        attempts: 0,
        request_ip: input.requestIp,
        created_by: input.userId,
        created_info: 'sendOTP',
      },
      select: { id: true },
    });
    return queueImmediateSendTx(tx, {
      tenantOrgId: input.tenantId,
      channel: input.channel,
      recipientAddress: address,
      eventCode: OTP_EVENT_CODE,
      sourceEntityType: 'otp',
      sourceEntityId: row.id,
      idempotencyKey: `otp:${row.id}`,
      subject: (arabic && rendered.title2) || rendered.title,
      body,
      // HQ drops the message once expires_at has passed; WhatsApp fills its template from otp_code.
      metadata: { expires_at: expiresAt.toISOString(), ...(input.channel === 'WHATSAPP' ? { variables } : {}) },
      // A late code is useless; the customer can ask again.
      maxRetries: 2,
      createdBy: input.userId,
    }, IMMEDIATE_SEND_PRIORITY.OTP);
  }));

  return {
    success: true,
    message: 'Verification code sent',
    expiresAt: expiresAt.toISOString(),
    phone: maskPhone(phone),
    outboxId,
  };
}

// ==================================================================
// VERIFY
// ==================================================================

/**
 * Checks a code against the newest unverified code of the phone.
 * @param request Phone and the code the customer typed.
 */
export async function verifyOTP(request: VerifyOTPRequest): Promise<OTPVerificationResponse> {
  const parsed = toE164(request.phone);
  if (!parsed) throw new Error('Invalid phone number format');
  const phone = parsed.e164;
  const invalid: OTPVerificationResponse = { verified: false, message: 'Invalid or expired OTP code' };

  // Only the newest code counts, so asking again replaces the earlier one.
  const row = await prisma.sys_otp_codes.findFirst({
    where: { phone, verified_at: null },
    orderBy: { expires_at: 'desc' },
    select: { id: true, code: true, attempts: true, expires_at: true },
  });
  if (!row || row.expires_at.getTime() < Date.now()) return invalid;

  const attempts = row.attempts ?? 0;
  if (attempts >= OTP_LIMITS.MAX_ATTEMPTS) {
    return { verified: false, message: 'Maximum verification attempts exceeded. Please request a new code.' };
  }
  // Count the attempt before comparing; a parallel guess that read the same count loses.
  const counted = await prisma.sys_otp_codes.updateMany({
    where: { id: row.id, attempts: row.attempts, verified_at: null },
    data: { attempts: attempts + 1, updated_at: new Date(), updated_info: 'verifyOTP' },
  });
  if (counted.count === 0) return invalid;

  if (!sameBytes(Buffer.from(row.code, 'hex'), Buffer.from(hashOtpCode(phone, request.code ?? ''), 'hex'))) {
    return { verified: false, message: `Invalid code. ${OTP_LIMITS.MAX_ATTEMPTS - (attempts + 1)} attempt(s) remaining.` };
  }

  const done = await prisma.sys_otp_codes.updateMany({
    where: { id: row.id, verified_at: null },
    data: { verified_at: new Date(), updated_at: new Date(), updated_info: 'verifyOTP' },
  });
  if (done.count === 0) return invalid;

  return { verified: true, token: generateVerificationToken(phone), message: 'Phone number verified successfully' };
}

/**
 * True when the phone verified a code of this purpose in the last 15 minutes.
 * @param phone
 * @param purpose
 */
export async function hasRecentVerifiedOTP(phone: string, purpose: OTPPurpose = 'registration'): Promise<boolean> {
  const parsed = toE164(phone);
  if (!parsed) return false;
  const row = await prisma.sys_otp_codes.findFirst({
    where: {
      phone: parsed.e164,
      purpose,
      verified_at: { gte: new Date(Date.now() - OTP_LIMITS.VERIFICATION_TOKEN_MINUTES * 60_000) },
    },
    select: { id: true },
  });
  return Boolean(row);
}
