/**
 * SMS Sender - Shared module for sending SMS via Twilio
 *
 * When the Twilio account SID, auth token and legacy phone number resolve (Config Registry keys
 * ntf.app.twilio.account_sid / auth_token / phone_number; env vars TWILIO_ACCOUNT_SID /
 * TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER win under the seeded policy), uses real Twilio.
 * Otherwise logs in dev (no-op in production without config).
 */

import { logger } from '@/lib/utils/logger';
import { collectMissingEnv, logMissingNotificationEnv } from '@lib/notifications/log-missing-env';
import { getLegacyTwilioPhoneNumber, getTwilioCredentials } from '@lib/notifications/provider-secrets';

/** Resolved Twilio identity of the legacy sender, or null when any part is missing. */
async function resolveTwilioSender(): Promise<{ accountSid: string; authToken: string; from: string } | null> {
  const [{ accountSid, authToken }, from] = await Promise.all([getTwilioCredentials(), getLegacyTwilioPhoneNumber()]);
  return accountSid && authToken && from ? { accountSid, authToken, from } : null;
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
  const sender = await resolveTwilioSender();
  if (sender) {
    try {
      const twilio = await import('twilio');
      const client = twilio.default(sender.accountSid, sender.authToken);
      await client.messages.create({
        body: message,
        from: sender.from,
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

  const missing = collectMissingEnv([
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
  ]);

  if (process.env.NODE_ENV === 'development') {
    logger.warn('SMS mock (Twilio not configured)', {
      missing,
      feature: 'sms',
    });
    logger.info('SMS mock (Twilio not configured)', {
      to: to.slice(-4).padStart(to.length, '*'),
      messagePreview: message.slice(0, 80),
    });
    return true;
  }

  logMissingNotificationEnv({
    adapter: 'sms-sender',
    missing,
  });
  logger.warn('SMS skipped: Twilio not configured', {
    to: to.slice(-4).padStart(to.length, '*'),
    missing,
    feature: 'sms',
  });
  return false;
}
