/**
 * Notification Hub — EMAIL adapter.
 * Reads pre-rendered content from an org_ntf_outbox_dtl row and dispatches
 * via the existing Resend integration (lib/notifications/email-sender.ts).
 */

import { sendEmail } from '@lib/notifications/email-sender';
import { logger } from '@lib/utils/logger';

export interface OutboxEmailRow {
  id: string;
  tenant_org_id: string;
  recipient_address: string | null;
  recipient_user_id: string | null;
  rendered_subject: string | null;
  rendered_body: string;
  event_code: string | null;
  retry_count: number;
}

export interface EmailDeliveryResult {
  success: boolean;
  errorMessage?: string;
  permanent?: boolean;
}

export async function deliverEmailOutbox(row: OutboxEmailRow): Promise<EmailDeliveryResult> {
  if (!row.recipient_address) {
    logger.warn('email adapter: no recipient_address on outbox row — skipping', {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return { success: false, errorMessage: 'No recipient email address', permanent: true };
  }

  const subject = row.rendered_subject ?? row.event_code ?? 'CleanMateX Notification';

  try {
    const sent = await sendEmail({
      to:      row.recipient_address,
      subject,
      html:    row.rendered_body,
    });

    if (!sent) {
      return { success: false, errorMessage: 'Email send returned false (check RESEND_API_KEY)', permanent: false };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('email adapter: sendEmail threw', err instanceof Error ? err : new Error(msg), {
      outboxId:    row.id,
      tenantOrgId: row.tenant_org_id,
      feature:     'notifications',
    });
    return { success: false, errorMessage: msg, permanent: false };
  }
}
