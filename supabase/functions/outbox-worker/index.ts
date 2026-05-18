import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants (mirrors lib/constants/order-financial.ts) ──────────────────────

const OUTBOX_STATUSES = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED:  'PROCESSED',
  FAILED:     'FAILED',
} as const;

const OUTBOX_EVENT_TYPES = {
  ORDER_COMPLETED:      'ORDER_COMPLETED',
  PAYMENT_RECEIVED:     'PAYMENT_RECEIVED',
  REFUND_PROCESSED:     'REFUND_PROCESSED',
  LOYALTY_EARN:         'LOYALTY_EARN',
  STORED_VALUE_CHANGED: 'STORED_VALUE_CHANGED',
  GIFT_CARD_REDEEMED:   'GIFT_CARD_REDEEMED',
} as const;

type OutboxEvent = {
  id: string;
  tenant_org_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  created_at: string;
};

// ── Retry back-off: 1 → 5 → 15 → 60 → 240 minutes ────────────────────────────

const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240];

function nextRetryAt(attempts: number): string | null {
  const delayMinutes = RETRY_DELAYS_MINUTES[attempts] ?? null;
  if (delayMinutes === null) return null;
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

// ── Event handlers ─────────────────────────────────────────────────────────────

type HandlerResult = { success: boolean; message?: string };
type HandlerContext = {
  supabase: ReturnType<typeof createClient>;
  event: OutboxEvent;
};

async function handleOrderCompleted(ctx: HandlerContext): Promise<HandlerResult> {
  // Placeholder: trigger receipt generation / webhook notification
  console.log(`[ORDER_COMPLETED] order=${ctx.event.aggregate_id} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function handlePaymentReceived(ctx: HandlerContext): Promise<HandlerResult> {
  // Placeholder: send payment confirmation notification
  console.log(`[PAYMENT_RECEIVED] aggregate=${ctx.event.aggregate_id} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function handleRefundProcessed(ctx: HandlerContext): Promise<HandlerResult> {
  // Placeholder: send refund confirmation notification
  console.log(`[REFUND_PROCESSED] refund=${ctx.event.aggregate_id} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function handleLoyaltyEarn(ctx: HandlerContext): Promise<HandlerResult> {
  const payload = ctx.event.payload as { points?: number; customer_id?: string };
  console.log(`[LOYALTY_EARN] customer=${payload.customer_id} points=${payload.points} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function handleStoredValueChanged(ctx: HandlerContext): Promise<HandlerResult> {
  const payload = ctx.event.payload as { delta?: number; customer_id?: string };
  console.log(`[STORED_VALUE_CHANGED] customer=${payload.customer_id} delta=${payload.delta} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function handleGiftCardRedeemed(ctx: HandlerContext): Promise<HandlerResult> {
  const payload = ctx.event.payload as { gift_card_id?: string; amount?: number };
  console.log(`[GIFT_CARD_REDEEMED] card=${payload.gift_card_id} amount=${payload.amount} tenant=${ctx.event.tenant_org_id}`);
  return { success: true };
}

async function routeEvent(ctx: HandlerContext): Promise<HandlerResult> {
  switch (ctx.event.event_type) {
    case OUTBOX_EVENT_TYPES.ORDER_COMPLETED:
      return handleOrderCompleted(ctx);
    case OUTBOX_EVENT_TYPES.PAYMENT_RECEIVED:
      return handlePaymentReceived(ctx);
    case OUTBOX_EVENT_TYPES.REFUND_PROCESSED:
      return handleRefundProcessed(ctx);
    case OUTBOX_EVENT_TYPES.LOYALTY_EARN:
      return handleLoyaltyEarn(ctx);
    case OUTBOX_EVENT_TYPES.STORED_VALUE_CHANGED:
      return handleStoredValueChanged(ctx);
    case OUTBOX_EVENT_TYPES.GIFT_CARD_REDEEMED:
      return handleGiftCardRedeemed(ctx);
    default:
      console.warn(`[outbox-worker] Unknown event_type: ${ctx.event.event_type} — marking processed`);
      return { success: true, message: 'unhandled_event_type' };
  }
}

// ── Core worker loop ───────────────────────────────────────────────────────────

async function processOutbox(supabase: ReturnType<typeof createClient>): Promise<{
  processed: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  // Claim a batch: atomically set status → PROCESSING
  const { data: batch, error: claimError } = await supabase.rpc('claim_outbox_batch', {
    p_limit: 50,
    p_now: now,
  });

  if (claimError) {
    // Fall back to simple select if RPC not available
    console.error('[outbox-worker] claim_outbox_batch RPC failed, using fallback select:', claimError.message);

    const { data: events, error: selectError } = await supabase
      .from('org_domain_events_outbox')
      .select('*')
      .in('status', [OUTBOX_STATUSES.PENDING, OUTBOX_STATUSES.FAILED])
      .lte('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(50);

    if (selectError || !events) {
      throw new Error(`Failed to fetch outbox events: ${selectError?.message}`);
    }

    // Mark as PROCESSING
    if (events.length > 0) {
      const ids = events.map((e: OutboxEvent) => e.id);
      await supabase
        .from('org_domain_events_outbox')
        .update({ status: OUTBOX_STATUSES.PROCESSING })
        .in('id', ids);
    }

    return processEvents(supabase, events as OutboxEvent[]);
  }

  return processEvents(supabase, (batch ?? []) as OutboxEvent[]);
}

async function processEvents(
  supabase: ReturnType<typeof createClient>,
  events: OutboxEvent[]
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const result = await routeEvent({ supabase, event });

      if (result.success) {
        await supabase
          .from('org_domain_events_outbox')
          .update({
            status:       OUTBOX_STATUSES.PROCESSED,
            processed_at: new Date().toISOString(),
          })
          .eq('id', event.id);

        processed++;
      } else {
        await scheduleRetryOrFail(supabase, event, result.message ?? 'handler returned failure');
        failed++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[outbox-worker] Error processing event ${event.id}:`, message);
      await scheduleRetryOrFail(supabase, event, message);
      failed++;
    }
  }

  return { processed, failed };
}

async function scheduleRetryOrFail(
  supabase: ReturnType<typeof createClient>,
  event: OutboxEvent,
  errorMessage: string
): Promise<void> {
  const attempts = (event.attempts ?? 0) + 1;
  const retryAt  = attempts < event.max_attempts ? nextRetryAt(attempts) : null;

  await supabase
    .from('org_domain_events_outbox')
    .update({
      status:         OUTBOX_STATUSES.FAILED,
      attempts,
      next_retry_at:  retryAt,
      error_message:  errorMessage.slice(0, 2000),
    })
    .eq('id', event.id);
}

// ── HTTP handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Allow pg_cron and scheduled invocations; optionally restrict via shared secret
  const authHeader = req.headers.get('Authorization');
  const expectedSecret = Deno.env.get('OUTBOX_WORKER_SECRET');
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  try {
    const { processed, failed } = await processOutbox(supabase);

    console.log(`[outbox-worker] processed=${processed} failed=${failed}`);

    return new Response(
      JSON.stringify({ success: true, processed, failed }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[outbox-worker] Fatal error:', message);

    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
