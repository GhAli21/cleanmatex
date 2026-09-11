/**
 * Email Sender - Shared module for sending emails via Resend
 *
 * When RESEND_API_KEY is set, uses real Resend. Otherwise logs in dev
 * (no-op in production without config).
 */

import { logger } from '@/lib/utils/logger';
import { getResendFromEmail } from '@lib/notifications/config';
import { collectMissingEnv, logMissingNotificationEnv } from '@lib/notifications/log-missing-env';

/**
 *
 */
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Send email to a recipient.
 * Uses Resend when configured; otherwise logs (dev) or returns false (production).
 *
 * @param params - Email params (to, subject, html, optional text/from)
 * @returns true if sent (or dev mock), false on failure
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const {
    to,
    subject,
    html,
    text,
    from = await getResendFromEmail(),
  } = params;

  if (isResendConfigured()) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text: text || undefined,
      });
      if (error) {
        logger.error('Resend API error', new Error(error.message), {
          to: to.slice(0, 3) + '***',
          subject,
          feature: 'email',
        });
        return false;
      }
      logger.info('Email sent via Resend', {
        to: to.slice(0, 3) + '***',
        subject,
        feature: 'email',
      });
      return true;
    } catch (error) {
      logger.error('Failed to send email via Resend', error as Error, {
        to: to.slice(0, 3) + '***',
        subject,
        feature: 'email',
      });
      return false;
    }
  }

  const missing = collectMissingEnv(['RESEND_API_KEY']);
  if (!from) missing.push('RESEND_FROM_EMAIL|sys_ntf_runtime_cf.resend_from_email');

  if (process.env.NODE_ENV === 'development') {
    logger.warn('Email mock (Resend not configured)', {
      missing,
      feature: 'email',
    });
    logger.info('Email mock (Resend not configured)', {
      to: to.slice(0, 3) + '***',
      subject,
      htmlPreview: html.slice(0, 100),
    });
    return true;
  }

  logMissingNotificationEnv({
    adapter: 'email-sender',
    missing,
    extra: { subject },
  });
  logger.warn('Email skipped: Resend not configured', {
    to: to.slice(0, 3) + '***',
    subject,
    missing,
    feature: 'email',
  });
  return false;
}
