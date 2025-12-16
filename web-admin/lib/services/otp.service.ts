/**
 * PRD-003: OTP Verification Service
 * Handle OTP generation, sending via SMS, and verification
 */

import { createClient } from '@/lib/supabase/server';
import type {
  SendOTPRequest,
  VerifyOTPRequest,
  SendOTPResponse,
  OTPVerificationResponse,
  OTPPurpose,
} from '@/lib/types/customer';
import { normalizePhone, maskPhone } from './customers.service';

// ==================================================================
// CONFIGURATION
// ==================================================================

const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_SECONDS: 60,
  VERIFICATION_TOKEN_EXPIRY_MINUTES: 15,
};

// ==================================================================
// OTP GENERATION
// ==================================================================

/**
 * Generate a random 6-digit OTP code
 */
function generateOTPCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a temporary verification token (for registration)
 * This token can be used to create a customer after OTP verification
 */
function generateVerificationToken(phone: string): string {
  const payload = {
    phone,
    purpose: 'verification',
    exp: Date.now() + OTP_CONFIG.VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000,
  };

  // In production, use proper JWT signing
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Verify and decode verification token
 */
export function verifyVerificationToken(token: string): { phone: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());

    if (payload.exp < Date.now()) {
      return null; // Token expired
    }

    return { phone: payload.phone };
  } catch (error) {
    return null;
  }
}

// ==================================================================
// SMS SENDING (Mock Implementation)
// ==================================================================

/**
 * Send SMS via Twilio (or other SMS provider)
 *
 * For development, this is a mock implementation.
 * In production, integrate with Twilio:
 *
 * ```typescript
 * import twilio from 'twilio';
 *
 * const client = twilio(
 *   process.env.TWILIO_ACCOUNT_SID,
 *   process.env.TWILIO_AUTH_TOKEN
 * );
 *
 * await client.messages.create({
 *   body: `Your CleanMateX verification code is: ${code}`,
 *   from: process.env.TWILIO_PHONE_NUMBER,
 *   to: phone,
 * });
 * ```
 */
async function sendSMS(phone: string, message: string): Promise<boolean> {
  // TODO: Replace with actual Twilio integration
  console.log(`[SMS] Sending to ${phone}: ${message}`);

  // Mock implementation for development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEV] OTP Code: ${message}`);
    return true;
  }

  // In production, use Twilio
  try {
    // const twilio = require('twilio');
    // const client = twilio(
    //   process.env.TWILIO_ACCOUNT_SID,
    //   process.env.TWILIO_AUTH_TOKEN
    // );
    //
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone,
    // });

    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

// ==================================================================
// OTP OPERATIONS
// ==================================================================

/**
 * Send OTP code to phone number
 */
export async function sendOTP(request: SendOTPRequest): Promise<SendOTPResponse> {
  const supabase = await createClient();

  // Normalize phone number
  const phoneResult = normalizePhone(request.phone);
  if (!phoneResult.isValid) {
    throw new Error('Invalid phone number format');
  }

  const normalizedPhone = phoneResult.normalized;

  // Check for recent OTP (rate limiting)
  const cooldownTime = new Date(Date.now() - OTP_CONFIG.RESEND_COOLDOWN_SECONDS * 1000);

  const { data: recentOTP } = await supabase
    .from('sys_otp_codes')
    .select('id, created_at')
    .eq('phone', normalizedPhone)
    .eq('purpose', request.purpose)
    .gte('created_at', cooldownTime.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentOTP) {
    const secondsSinceLastOTP = Math.floor(
      (Date.now() - new Date(recentOTP.created_at).getTime()) / 1000
    );
    const remainingSeconds = OTP_CONFIG.RESEND_COOLDOWN_SECONDS - secondsSinceLastOTP;

    throw new Error(
      `Please wait ${remainingSeconds} seconds before requesting another OTP`
    );
  }

  // Generate OTP code
  const code = generateOTPCode();
  const expiresAt = new Date(Date.now() + OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);

  // Save OTP to database
  const { error: insertError } = await supabase.from('sys_otp_codes').insert({
    phone: normalizedPhone,
    code,
    purpose: request.purpose,
    expires_at: expiresAt.toISOString(),
    attempts: 0,
  });

  if (insertError) {
    console.error('Error saving OTP:', insertError);
    throw new Error('Failed to generate OTP code');
  }

  // Send SMS
  const message = `Your CleanMateX verification code is: ${code}. Valid for ${OTP_CONFIG.EXPIRY_MINUTES} minutes.`;
  const sent = await sendSMS(normalizedPhone, message);

  if (!sent) {
    throw new Error('Failed to send OTP via SMS');
  }

  return {
    success: true,
    message: 'OTP sent successfully',
    expiresAt: expiresAt.toISOString(),
    phone: maskPhone(normalizedPhone),
  };
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  request: VerifyOTPRequest
): Promise<OTPVerificationResponse> {
  const supabase = await createClient();

  // Normalize phone number
  const phoneResult = normalizePhone(request.phone);
  if (!phoneResult.isValid) {
    throw new Error('Invalid phone number format');
  }

  const normalizedPhone = phoneResult.normalized;

  // Find the most recent OTP for this phone
  const { data: otpRecord, error: fetchError } = await supabase
    .from('sys_otp_codes')
    .select('*')
    .eq('phone', normalizedPhone)
    .is('verified_at', null) // Not yet verified
    .gte('expires_at', new Date().toISOString()) // Not expired
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !otpRecord) {
    return {
      verified: false,
      message: 'Invalid or expired OTP code',
    };
  }

  // Check max attempts
  if (otpRecord.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
    return {
      verified: false,
      message: 'Maximum verification attempts exceeded. Please request a new code.',
    };
  }

  // Increment attempts
  await supabase
    .from('sys_otp_codes')
    .update({ attempts: otpRecord.attempts + 1 })
    .eq('id', otpRecord.id);

  // Verify code
  if (otpRecord.code !== request.code) {
    const attemptsLeft = OTP_CONFIG.MAX_ATTEMPTS - (otpRecord.attempts + 1);
    return {
      verified: false,
      message: `Invalid code. ${attemptsLeft} attempt(s) remaining.`,
    };
  }

  // Mark as verified
  await supabase
    .from('sys_otp_codes')
    .update({ verified_at: new Date().toISOString() })
    .eq('id', otpRecord.id);

  // Generate verification token (for registration flow)
  const token = generateVerificationToken(normalizedPhone);

  return {
    verified: true,
    token,
    message: 'Phone number verified successfully',
  };
}

/**
 * Cleanup expired OTP codes (should be run periodically)
 */
export async function cleanupExpiredOTPs(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('cleanup_expired_otp_codes');

  if (error) {
    console.error('Error cleaning up OTP codes:', error);
    return 0;
  }

  return data as number;
}

/**
 * Check if phone has verified OTP recently (for customer creation)
 */
export async function hasRecentVerifiedOTP(
  phone: string,
  purpose: OTPPurpose = 'registration'
): Promise<boolean> {
  const supabase = await createClient();

  const phoneResult = normalizePhone(phone);
  if (!phoneResult.isValid) {
    return false;
  }

  // Check for verified OTP within last 15 minutes
  const recentTime = new Date(Date.now() - 15 * 60 * 1000);

  const { data } = await supabase
    .from('sys_otp_codes')
    .select('id')
    .eq('phone', phoneResult.normalized)
    .eq('purpose', purpose)
    .not('verified_at', 'is', null)
    .gte('verified_at', recentTime.toISOString())
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * Invalidate all OTPs for a phone number (after successful registration)
 */
export async function invalidatePhoneOTPs(phone: string): Promise<void> {
  const supabase = await createClient();

  const phoneResult = normalizePhone(phone);
  if (!phoneResult.isValid) {
    return;
  }

  // Delete all OTPs for this phone
  await supabase.from('sys_otp_codes').delete().eq('phone', phoneResult.normalized);
}
