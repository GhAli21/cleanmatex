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
 * Result shape for {@link sendEmailWithId}. Flat (non-discriminated-union)
 * shape per this codebase's established pattern for web-admin's
 * `strict:false` tsconfig (project memory "ActionResult must be a flat type,
 * not a discriminated union").
 */
export interface SendEmailResult {
  success: boolean;
  /** Resend's returned email id, when the provider accepted the send. Needed to correlate a later bounce/complaint webhook back to this send. */
  providerMessageId?: string;
}

/**
 * Send email to a recipient and return the provider's message id when known.
 * Uses Resend when configured; otherwise logs (dev) or returns failure
 * (production). This is the superset `sendEmail` delegates to — added so the
 * notification outbox EMAIL adapter can capture `providerMessageId` for later
 * bounce/complaint webhook correlation (migration 0603) without changing the
 * boolean contract every other existing caller of `sendEmail` already relies on.
 *
 * @param params - Email params (to, subject, html, optional text/from)
 * @returns `{success, providerMessageId}` — providerMessageId is set only on a real Resend-accepted send.
 */
export async function sendEmailWithId(params: SendEmailParams): Promise<SendEmailResult> {
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
      const { data, error } = await resend.emails.send({
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
        return { success: false };
      }
      logger.info('Email sent via Resend', {
        to: to.slice(0, 3) + '***',
        subject,
        providerMessageId: data?.id,
        feature: 'email',
      });
      return { success: true, providerMessageId: data?.id };
    } catch (error) {
      logger.error('Failed to send email via Resend', error as Error, {
        to: to.slice(0, 3) + '***',
        subject,
        feature: 'email',
      });
      return { success: false };
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
    return { success: true };
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
  return { success: false };
}

/**
 * Send email to a recipient.
 * Uses Resend when configured; otherwise logs (dev) or returns false (production).
 * Thin boolean-returning wrapper over {@link sendEmailWithId}, preserved
 * unchanged for every pre-existing caller (ar-dunning-ops.service.ts,
 * receipt-service.ts, dunning.service.ts).
 *
 * @param params - Email params (to, subject, html, optional text/from)
 * @returns true if sent (or dev mock), false on failure
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const result = await sendEmailWithId(params);
  return result.success;
}
