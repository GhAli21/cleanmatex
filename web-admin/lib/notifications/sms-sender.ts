/**
 * SMS Sender - Shared module for sending SMS via Twilio
 *
 * When TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER are set,
 * uses real Twilio. Otherwise logs in dev (no-op in production without config).
 */

import { logger } from '@/lib/utils/logger';

function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

/**
 * Send SMS to a phone number.
 * Uses Twilio when configured; otherwise logs (dev) or returns false (production).
 *
 * @param to - Phone number (E.164 format)
 * @param message - Message body
 * @returns true if sent (or dev mock), false on failure
 */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (isTwilioConfigured()) {
    try {
      const twilio = await import('twilio');
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID!,
        process.env.TWILIO_AUTH_TOKEN!
      );
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to,
      });
      logger.info('SMS sent via Twilio', {
        to: to.slice(-4).padStart(to.length, '*'),
        feature: 'sms',
        provider: 'twilio',
      });
      return true;
    } catch (error) {
      logger.error('Failed to send SMS via Twilio', error as Error, {
        to: to.slice(-4).padStart(to.length, '*'),
        feature: 'sms',
        provider: 'twilio',
      });
      return false;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info('SMS mock (Twilio not configured)', {
      to: to.slice(-4).padStart(to.length, '*'),
      messagePreview: message.slice(0, 80),
    });
    return true;
  }

  logger.warn('SMS skipped: Twilio not configured', {
    to: to.slice(-4).padStart(to.length, '*'),
    feature: 'sms',
  });
  return false;
}
