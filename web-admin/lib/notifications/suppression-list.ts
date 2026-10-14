/**
 * Notification Hub — provider-reported suppression list (migration
 * 0603_ntf_suppression_list.sql).
 *
 * Distinct from `customer-dispatch-consent.ts`: that module enforces the
 * CUSTOMER's own opt-out preference (`org_customers_mst.preferences`).
 * This module enforces a PROVIDER-reported fact — an email bounce/complaint
 * or an SMS carrier opt-out (STOP) — against a specific normalized address or
 * phone number, independent of any customer profile or preference, and
 * independent of whether the recipient is even a resolvable tenant customer
 * (a suppressed address must stay suppressed even for a non-customer send,
 * e.g. the EMAIL auth-user fallback path).
 */
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

/** Channels the suppression list covers — matches the migration's CHECK constraint. */
export type SuppressionChannel = 'EMAIL' | 'SMS';

/** Reason codes — matches the migration's CHECK constraint. */
export type SuppressionReasonCode = 'BOUNCE_HARD' | 'BOUNCE_SOFT_REPEATED' | 'COMPLAINT' | 'CARRIER_OPT_OUT';

/**
 * Flat (non-discriminated-union) result shape, matching this codebase's
 * established pattern for web-admin's `strict:false` tsconfig (see project
 * memory "ActionResult must be a flat type, not a discriminated union").
 */
export type SuppressionCheckResult = {
  suppressed: boolean;
  reasonCode?: SuppressionReasonCode;
};

/** Lowercases/trims an email address so lookups and writes always compare the same normalized form. */
export function normalizeEmailAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Trims an E.164 phone number so lookups and writes always compare the same normalized form. */
export function normalizePhoneNumber(number: string): string {
  return number.trim();
}

function normalizeForChannel(channel: SuppressionChannel, addressOrNumber: string): string {
  return channel === 'EMAIL' ? normalizeEmailAddress(addressOrNumber) : normalizePhoneNumber(addressOrNumber);
}

/**
 * Checks whether a recipient address/number is currently suppressed for a
 * channel. Called at dispatch time, in addition to (never instead of) the
 * existing customer opt-out preference check.
 * @param tenantOrgId Tenant owning the suppression entry.
 * @param channel Dispatch channel being checked.
 * @param addressOrNumber Raw recipient address/number as read from the outbox row.
 * @returns `suppressed: false` when no active entry exists or the lookup itself fails (fail-open — a transient
 *   suppression-list read error must never silently block an otherwise-eligible transactional send; the existing
 *   per-channel adapter error handling and retry policy remain the safety net for actual provider failures).
 * @example
 * const result = await checkSuppression(tenantOrgId, 'EMAIL', row.recipient_address);
 */
export async function checkSuppression(
  tenantOrgId: string,
  channel: SuppressionChannel,
  addressOrNumber: string | null | undefined,
): Promise<SuppressionCheckResult> {
  if (!addressOrNumber) {
    return { suppressed: false };
  }

  try {
    const supabase = createAdminSupabaseClient();
    const normalized = normalizeForChannel(channel, addressOrNumber);

    const { data, error } = await supabase
      .from('org_ntf_suppression_lst')
      .select('reason_code')
      .eq('tenant_org_id', tenantOrgId)
      .eq('channel_code', channel)
      .eq('address_or_number', normalized)
      .eq('rec_status', 1)
      .maybeSingle();

    if (error) {
      logger.error('suppression-list: lookup failed, failing open', new Error(error.message), {
        tenantOrgId, channel, feature: 'notifications',
      });
      return { suppressed: false };
    }
    if (!data) {
      return { suppressed: false };
    }
    return { suppressed: true, reasonCode: data.reason_code as SuppressionReasonCode };
  } catch (err) {
    logger.error('suppression-list: lookup threw, failing open', err instanceof Error ? err : new Error(String(err)), {
      tenantOrgId, channel, feature: 'notifications',
    });
    return { suppressed: false };
  }
}

/**
 * Idempotently records (or refreshes) a provider-reported suppression entry.
 * Called from trusted webhook ingestion / reconciliation code only — never
 * from a tenant-client-reachable route.
 * @param tenantOrgId Tenant owning the suppressed address/number.
 * @param channel Channel the suppression applies to.
 * @param addressOrNumber Raw recipient address/number as reported by the provider.
 * @param reasonCode Why this address/number is being suppressed.
 * @param source Which provider/webhook reported this (e.g. 'RESEND_WEBHOOK').
 * @param detail Optional non-sensitive diagnostic detail.
 * @returns true when the entry was recorded/refreshed, false on failure (logged, not thrown).
 */
export async function recordSuppression(
  tenantOrgId: string,
  channel: SuppressionChannel,
  addressOrNumber: string,
  reasonCode: SuppressionReasonCode,
  source: string,
  detail?: string,
): Promise<boolean> {
  const normalized = normalizeForChannel(channel, addressOrNumber);
  if (!normalized) {
    return false;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('org_ntf_suppression_lst')
      .upsert(
        {
          tenant_org_id: tenantOrgId,
          channel_code: channel,
          address_or_number: normalized,
          reason_code: reasonCode,
          source,
          detail: detail ?? null,
          suppressed_at: nowIso,
          updated_at: nowIso,
          updated_by: source,
          rec_status: 1,
          is_active: true,
        },
        { onConflict: 'tenant_org_id,channel_code,address_or_number' },
      );

    if (error) {
      logger.error('suppression-list: failed to record suppression', new Error(error.message), {
        tenantOrgId, channel, reasonCode, source, feature: 'notifications',
      });
      return false;
    }

    logger.info('suppression-list: recorded suppression', {
      tenantOrgId, channel, reasonCode, source, feature: 'notifications',
    });
    return true;
  } catch (err) {
    logger.error('suppression-list: record threw', err instanceof Error ? err : new Error(String(err)), {
      tenantOrgId, channel, reasonCode, source, feature: 'notifications',
    });
    return false;
  }
}

/** Soft-bounce policy: this many transient bounces inside the window suppress the address. */
export const SOFT_BOUNCE_THRESHOLD = 3;
/** Rolling window (hours) over which soft bounces are counted (7 days). */
export const SOFT_BOUNCE_WINDOW_HOURS = 168;

/** Result of counting one soft bounce. */
export type SoftBounceResult = {
  recorded: boolean;
  bounceCount?: number;
  suppressed?: boolean;
  duplicate?: boolean;
};

/** Parses the JSON returned by fn_ntf_soft_bounce_record; null when the shape is unexpected. */
function parseSoftBounceResult(json: unknown): { bounce_count: number; suppressed: boolean; duplicate: boolean } | null {
  if (typeof json !== 'object' || json === null) return null;
  const { bounce_count, suppressed, duplicate } = json as Record<string, unknown>;
  if (typeof bounce_count !== 'number') return null;
  return { bounce_count, suppressed: suppressed === true, duplicate: duplicate === true };
}

/**
 * Counts one transient (soft) bounce atomically and promotes the address to a
 * BOUNCE_SOFT_REPEATED suppression once {@link SOFT_BOUNCE_THRESHOLD} bounces land
 * inside {@link SOFT_BOUNCE_WINDOW_HOURS}. Idempotent per `eventId` (provider redelivery
 * of the same event is not double-counted). Trusted webhook code only.
 * @param tenantOrgId Tenant owning the address (resolved from the outbox row).
 * @param channel Channel the bounce applies to.
 * @param addressOrNumber Raw address/number reported by the provider.
 * @param eventId Provider event id used for redelivery de-duplication.
 * @param source Reporting webhook (e.g. 'RESEND_WEBHOOK').
 * @returns `recorded: false` on failure (logged, never thrown).
 */
export async function recordSoftBounce(
  tenantOrgId: string,
  channel: SuppressionChannel,
  addressOrNumber: string,
  eventId: string,
  source: string,
): Promise<SoftBounceResult> {
  const normalized = normalizeForChannel(channel, addressOrNumber);
  if (!normalized) {
    return { recorded: false };
  }
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase.rpc('fn_ntf_soft_bounce_record', {
      p_tenant_org_id: tenantOrgId,
      p_channel_code: channel,
      p_address: normalized,
      p_event_id: eventId,
      p_threshold: SOFT_BOUNCE_THRESHOLD,
      p_window_hours: SOFT_BOUNCE_WINDOW_HOURS,
      p_source: source,
    });
    const result = error ? null : parseSoftBounceResult(data);
    if (error || !result) {
      logger.error('suppression-list: soft-bounce record failed', new Error(error?.message ?? 'unexpected result'), {
        tenantOrgId, channel, source, feature: 'notifications',
      });
      return { recorded: false };
    }
    return { recorded: true, bounceCount: result.bounce_count, suppressed: result.suppressed, duplicate: result.duplicate };
  } catch (err) {
    logger.error('suppression-list: soft-bounce record threw', err instanceof Error ? err : new Error(String(err)), {
      tenantOrgId, channel, source, feature: 'notifications',
    });
    return { recorded: false };
  }
}
