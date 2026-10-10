/**
 * Shadow-only ORDER_CREATED → WHATSAPP route comparison.
 *
 * Per the production implementation plan sections 17.2 ("Shadow-state:
 * validate/render and compare without provider sends or billable
 * reservations") and 22 (compatibility rollout step 4), this module calls
 * ResolveEffectiveNotificationRoute in addition to — never instead of — the
 * existing direct-Twilio WhatsApp send for order.created, and records a
 * structured comparison for operator review. It is explicitly NOT a cutover:
 *
 * - It never sends a message or calls a provider.
 * - It never reserves or charges notification quota/usage.
 * - It never creates, claims, or finalizes an outbox row a second time.
 * - It never changes `row` or any value the legacy adapter sends.
 * - A failure anywhere in this module is swallowed; it can never make the
 *   legacy send fail, retry differently, or change its content.
 *
 * Storage decision (documented here and in STATUS.md 2026-10-09): comparisons
 * are recorded as a single structured log line via the existing `logger`
 * utility, not a new table and not an existing column repurposed for a
 * second meaning. `org_ntf_outbox_dtl.metadata` already has a defined,
 * different purpose ("channel-specific payload overrides") consumed by the
 * real adapters; writing shadow diagnostics into it would risk an adapter
 * misreading pilot data as dispatch configuration and would persist
 * unapproved shadow data on a row with no retention/redaction review for
 * that purpose. No migration is approved in this increment. A structured log
 * line is "observable for review" (grep/log-aggregation) without creating a
 * durable ledger that has not been reviewed as a retained evidence table.
 */
import { logger } from '@lib/utils/logger';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { resolveEffectiveNotificationRoute } from '@lib/notifications/route-resolver';
import { isTwilioProductionTemplateProvider, resolveTwilioProductionTemplate } from '@lib/notifications/adapters/whatsapp-template-config';
import type { WhatsAppContentVariableRow } from '@lib/notifications/adapters/whatsapp-content-variables';

/** This pilot increment is scoped to exactly this event/channel pair; see plan section 23 "First producer scope". */
const SHADOW_PILOT_EVENT_CODE = 'order.created';
const SHADOW_PILOT_CHANNEL_CODE = 'WHATSAPP';

/** Minimal immutable provider shape already fetched by the legacy adapter; nothing new is read for this. */
export interface LegacyWhatsAppProvider {
  providerCode: string;
  config: Record<string, unknown>;
}

/**
 * Lists the distinct languages that currently have an ACTIVE route for this
 * tenant/event/channel. The legacy direct-Twilio order.created path has no
 * recipient-language dimension today (confirmed: no language/locale field
 * exists anywhere in the current event-emitter/orchestrator/outbox-row
 * contract) — per plan invariant 4.1.16 ("No default tenant currency,
 * country, locale or timezone"), this function does not invent one. It
 * reports only what tenant operators have actually configured.
 * @param tenantOrgId Tenant scope for the comparison.
 * @param eventCode Pilot event code.
 * @param channelCode Pilot channel code.
 * @returns Distinct configured language codes with an ACTIVE route, or [] on any lookup problem.
 */
async function listActiveRouteLanguages(
  tenantOrgId: string,
  eventCode: string,
  channelCode: string,
): Promise<string[]> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('org_ntf_route_assign_cf')
      .select('language_code')
      .eq('tenant_org_id', tenantOrgId)
      .eq('event_code', eventCode)
      .eq('channel_code', channelCode)
      .eq('route_state', 'ACTIVE')
      .eq('is_active', true);
    if (error || !data) return [];
    const languages = (data as { language_code: string }[])
      .map((row) => row.language_code)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return Array.from(new Set(languages));
  } catch {
    return [];
  }
}

/** What the legacy direct-Twilio path actually used for this row — read-only, no second send. */
function buildLegacySummary(
  row: WhatsAppContentVariableRow,
  provider: LegacyWhatsAppProvider | null,
): { providerCode: string | null; usesProductionTemplate: boolean; contentSid: string | null } {
  if (!provider) return { providerCode: null, usesProductionTemplate: false, contentSid: null };
  const usesProductionTemplate = isTwilioProductionTemplateProvider(provider.providerCode, provider.config);
  if (!usesProductionTemplate) return { providerCode: provider.providerCode, usesProductionTemplate: false, contentSid: null };
  const resolution = resolveTwilioProductionTemplate(row, provider.config);
  return {
    providerCode: provider.providerCode,
    usesProductionTemplate: true,
    contentSid: resolution && 'contentSid' in resolution ? resolution.contentSid : null,
  };
}

/**
 * Runs the shadow-only ORDER_CREATED → WHATSAPP comparison for one outbox row.
 * Always resolves (never rejects): any internal failure is logged and
 * swallowed so it can never affect the legacy send this observes.
 *
 * Call this in addition to — never in place of — the existing legacy
 * dispatch. It performs no provider call, no quota reservation, and no
 * outbox claim/lease/finalization write.
 *
 * @param row Immutable outbox delivery inputs already used by the legacy adapter.
 * @param provider The already-fetched active WhatsApp provider for this tenant, or null.
 * @example await runShadowOrderCreatedWhatsAppComparison(row, provider)
 */
export async function runShadowOrderCreatedWhatsAppComparison(
  row: WhatsAppContentVariableRow & { id: string; tenant_org_id: string; event_code: string | null },
  provider: LegacyWhatsAppProvider | null,
): Promise<void> {
  if (row.event_code !== SHADOW_PILOT_EVENT_CODE) return;

  try {
    const legacy = buildLegacySummary(row, provider);
    const languages = await listActiveRouteLanguages(row.tenant_org_id, SHADOW_PILOT_EVENT_CODE, SHADOW_PILOT_CHANNEL_CODE);

    if (languages.length === 0) {
      logger.info('ntf-shadow-route: no ACTIVE route configured for this tenant/event/channel (shadow only)', {
        feature: 'notifications', shadow: true,
        tenantOrgId: row.tenant_org_id, outboxId: row.id,
        eventCode: SHADOW_PILOT_EVENT_CODE, channelCode: SHADOW_PILOT_CHANNEL_CODE,
        legacy,
      });
      return;
    }

    for (const languageCode of languages) {
      const effectiveRoute = await resolveEffectiveNotificationRoute(
        row.tenant_org_id, SHADOW_PILOT_EVENT_CODE, SHADOW_PILOT_CHANNEL_CODE, languageCode,
      );
      logger.info('ntf-shadow-route: comparison (shadow only — no send, no quota, no outbox claim reuse)', {
        feature: 'notifications', shadow: true,
        tenantOrgId: row.tenant_org_id, outboxId: row.id,
        eventCode: SHADOW_PILOT_EVENT_CODE, channelCode: SHADOW_PILOT_CHANNEL_CODE, languageCode,
        legacy,
        effectiveRoute,
      });
    }
  } catch (err) {
    logger.warn('ntf-shadow-route: comparison failed; legacy path unaffected', {
      feature: 'notifications', shadow: true,
      tenantOrgId: row.tenant_org_id, outboxId: row.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
