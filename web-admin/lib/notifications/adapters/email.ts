/**
 * Notification Hub — EMAIL adapter.
 * Reads pre-rendered content from an org_ntf_outbox_dtl row and dispatches
 * via the existing Resend integration (lib/notifications/email-sender.ts).
 *
 * Kill-switch gate: when NTF_DISPATCH_VIA_HQ=true the send is routed through
 * the HQ Dispatch Proxy (POST platform-api /api/hq/v1/notifications/dispatch)
 * instead of the local Resend integration.  Set to false or unset to keep the
 * existing local path active (default / fallback).
 */

import { sendEmail } from '@lib/notifications/email-sender';
import { logger } from '@lib/utils/logger';
import { getNtfHqDispatchUrl, isNtfDispatchViaHq } from '@lib/notifications/config';
import { resolveCustomerDispatchConsent } from '@lib/notifications/customer-dispatch-consent';

/**
 *
 */
export interface OutboxEmailRow {
  id: string;
  tenant_org_id: string;
  recipient_address: string | null;
  recipient_user_id: string | null;
  rendered_subject: string | null;
  rendered_body: string;
  event_code: string | null;
  retry_count: number;
  /** Enables a fresh tenant-customer EMAIL consent recheck before every send. */
  source_entity_type?: string | null;
  source_entity_id?: string | null;
}

/**
 *
 */
export interface EmailDeliveryResult {
  success: boolean;
  errorMessage?: string;
  permanent?: boolean;
  /** Policy blocks must not retry and must not count as a provider failure. */
  skipped?: boolean;
}

// ---------------------------------------------------------------------------
// HQ Dispatch Proxy path (NTF_DISPATCH_VIA_HQ=true)
// ---------------------------------------------------------------------------

async function deliverViaHqProxy(row: OutboxEmailRow, subject: string): Promise<EmailDeliveryResult> {
  const hqUrl  = await getNtfHqDispatchUrl();
  const hqKey  = process.env.NTF_HQ_SERVICE_ROLE_KEY ?? '';

  if (!hqKey) {
    logger.error('email adapter: NTF_HQ_SERVICE_ROLE_KEY not set — cannot route via HQ proxy', undefined, {
      outboxId: row.id, feature: 'notifications',
    });
    return { success: false, errorMessage: 'NTF_HQ_SERVICE_ROLE_KEY not configured', permanent: true };
  }

  const body = JSON.stringify({
    idempotencyKey: row.id,
    tenantOrgId:    row.tenant_org_id,
    channel:        'EMAIL',
    recipient:      row.recipient_address,
    payload:        { subject, html: row.rendered_body },
    requestId:      row.id,
  });

  try {
    const res = await fetch(hqUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${hqKey}`,
      },
      body,
      // 20 s timeout via AbortController
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429;
      logger.warn('email adapter: HQ proxy returned non-OK status', {
        outboxId: row.id, status: res.status, body: text, feature: 'notifications',
      });
      return { success: false, errorMessage: `HQ proxy HTTP ${res.status}: ${text}`, permanent };
    }

    const data = await res.json().catch(() => ({})) as { status?: string; providerMessageId?: string };

    if (data.status === 'PERMANENT_FAILURE') {
      return { success: false, errorMessage: 'HQ proxy: PERMANENT_FAILURE', permanent: true };
    }
    if (data.status === 'FAILED') {
      return { success: false, errorMessage: 'HQ proxy: FAILED (temporary)', permanent: false };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('email adapter: HQ proxy fetch threw', err instanceof Error ? err : new Error(msg), {
      outboxId: row.id, feature: 'notifications',
    });
    return { success: false, errorMessage: msg, permanent: false };
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 *
 * @param row
 */
export async function deliverEmailOutbox(row: OutboxEmailRow): Promise<EmailDeliveryResult> {
  if (!row.recipient_address) {
    logger.warn('email adapter: no recipient_address on outbox row — skipping', {
      outboxId: row.id,
      tenantOrgId: row.tenant_org_id,
      feature: 'notifications',
    });
    return { success: false, errorMessage: 'No recipient email address', permanent: true };
  }

  // Recheck tenant-customer EMAIL consent fresh at dispatch so a queued notification
  // respects an opt-out recorded after it was enqueued (plan invariant 4.1.12). Rows
  // with no resolvable customer (e.g. staff notifications) are unaffected.
  const consent = await resolveCustomerDispatchConsent(
    row.tenant_org_id, 'email', row.source_entity_type, row.source_entity_id,
  );
  if (consent.applicable && !consent.allowed) {
    logger.info('email adapter: dispatch consent check blocked send', {
      outboxId: row.id, tenantOrgId: row.tenant_org_id, reason: consent.reason, feature: 'notifications',
    });
    return consent.retryable
      ? { success: false, errorMessage: consent.reason, permanent: false }
      : { success: false, skipped: true, errorMessage: consent.reason };
  }

  const subject = row.rendered_subject ?? row.event_code ?? 'CleanMateX Notification';

  // NTF_DISPATCH_VIA_HQ kill-switch: route through HQ proxy when enabled
  if (await isNtfDispatchViaHq()) {
    return deliverViaHqProxy(row, subject);
  }

  // Default path: local Resend integration
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
