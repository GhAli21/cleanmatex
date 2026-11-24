/**
 * Follows an immediate send (verification code, receipt) after its 202:
 * GET /api/v1/notifications/outbox/[id]/status until it is sent, failed, or 15 s have passed.
 */

export type OutboxDeliveryOutcome = 'SENT' | 'FAILED' | 'PENDING';

const SENT_STATUSES = new Set(['SENT', 'DELIVERED', 'READ']);
// FAILED_TEMPORARY is not final: HQ API retries it.
const FAILED_STATUSES = new Set(['FAILED_PERMANENT', 'SKIPPED', 'CANCELLED']);
const WATCH_MS = 15_000;
const POLL_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls the outbox row until it is final or the 15 s window ends.
 * @param outboxId Outbox id from the send response.
 * @returns SENT, FAILED, or PENDING (still sending after 15 s).
 */
export async function waitForOutboxDelivery(outboxId: string): Promise<OutboxDeliveryOutcome> {
  const deadline = Date.now() + WATCH_MS;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/v1/notifications/outbox/${encodeURIComponent(outboxId)}/status`, { cache: 'no-store' })
      .catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as { data?: { status?: string } };
      const status = body.data?.status ?? '';
      if (SENT_STATUSES.has(status)) return 'SENT';
      if (FAILED_STATUSES.has(status)) return 'FAILED';
    }
    await sleep(POLL_MS);
  }
  return 'PENDING';
}
