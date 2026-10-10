/**
 * ResolveEffectiveNotificationRoute — tenant-side effective-route lookup.
 *
 * Per the production implementation plan (section 4.2 responsibility table and
 * section 9 "Effective policy, routing and locale"): given an authorized
 * tenant/event/channel/language tuple, return the pinned account/sender/
 * revision/binding identity that an ACTIVE org_ntf_route_assign_cf row already
 * recorded at activation — or an explicit "no active route" result. This module
 * never selects, infers or defaults a language itself; the caller must supply
 * one it has already authorized. It never creates a delivery, never reserves
 * quota and never calls a provider — it is a read-only projection.
 *
 * Every org_* read filters tenant_org_id directly in the query itself
 * (CLAUDE.md CRITICAL RULE #4). A bounded, short-lived in-process cache keeps
 * repeat lookups cheap without caching indefinitely or across tenants
 * (plan section 9: "revisioned effective projections/caches, with
 * invalidation and bounded freshness").
 */
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import type {
  EffectiveNotificationRouteResult,
  NotificationRouteBindingSummary,
  NotificationRouteOwner,
} from '@lib/types/notification-route';

/** Bounded freshness: a stale cached projection cannot outlive this window before re-reading the route. */
const CACHE_TTL_MS = 30_000;
/** Bounds memory so this per-process cache can never grow without limit across many tenants. */
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  value: EffectiveNotificationRouteResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(tenantOrgId: string, eventCode: string, channelCode: string, languageCode: string): string {
  return `${tenantOrgId}::${eventCode}::${channelCode}::${languageCode}`;
}

function noMatch(reason: 'NO_ACTIVE_ROUTE' | 'LOOKUP_ERROR'): EffectiveNotificationRouteResult {
  return { matched: false, reason, resolvedAt: new Date().toISOString() };
}

/**
 * Drops cached effective-route projections so a stale read can never outlive
 * a route lifecycle change. Call after any create/update/activate/suspend/
 * retire of org_ntf_route_assign_cf for the affected tenant.
 * @param tenantOrgId Tenant whose cached projections must be dropped.
 * @param eventCode Optional narrower scope; requires channelCode and languageCode to target one tuple.
 * @param channelCode Optional narrower scope; requires eventCode and languageCode.
 * @param languageCode Optional narrower scope; requires eventCode and channelCode.
 * @example invalidateEffectiveNotificationRouteCache('tenant-a', 'order.created', 'WHATSAPP', 'en')
 */
export function invalidateEffectiveNotificationRouteCache(
  tenantOrgId: string,
  eventCode?: string,
  channelCode?: string,
  languageCode?: string,
): void {
  if (eventCode && channelCode && languageCode) {
    cache.delete(cacheKey(tenantOrgId, eventCode, channelCode, languageCode));
    return;
  }
  const prefix = `${tenantOrgId}::`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** Test-only: clears every cached entry regardless of tenant. */
export function __clearEffectiveNotificationRouteCacheForTests(): void {
  cache.clear();
}

type RawBindingRow = {
  component_position: number;
  parameter_position: number;
  external_slot: string;
  variable_id: string | null;
};

function toBindingSummary(row: RawBindingRow): NotificationRouteBindingSummary {
  return {
    componentPosition: row.component_position,
    parameterPosition: row.parameter_position,
    externalSlot: row.external_slot,
    source: row.variable_id ? 'VARIABLE' : 'STATIC',
  };
}

/**
 * Loads ordered binding structure for one immutable revision. PLATFORM bindings
 * live in the platform-wide catalog table (no tenant_org_id column); PRIVATE
 * bindings are tenant-owned and filtered by tenant_org_id directly. The route
 * row that selected this revisionId was already matched to the same tenant
 * before this is called, so a PLATFORM catalog read here is not a tenant leak.
 * @param tenantOrgId Tenant that owns the matched route (used for PRIVATE bindings only).
 * @param routeOwner Whether the revision is platform-owned or tenant-private.
 * @param revisionId Immutable revision identity selected by the matched route.
 * @returns Ordered, structural-only binding summaries (never a static value or resolved content).
 */
async function loadBindings(
  tenantOrgId: string,
  routeOwner: NotificationRouteOwner,
  revisionId: string,
): Promise<NotificationRouteBindingSummary[]> {
  const supabase = createAdminSupabaseClient();

  if (routeOwner === 'PRIVATE') {
    const { data, error } = await supabase
      .from('org_ntf_ptbind_dtl')
      .select('component_position, parameter_position, external_slot, variable_id')
      .eq('tenant_org_id', tenantOrgId)
      .eq('revision_id', revisionId)
      .eq('is_active', true)
      .eq('rec_status', 1)
      .order('component_position', { ascending: true })
      .order('parameter_position', { ascending: true });
    if (error || !data) return [];
    return (data as RawBindingRow[]).map(toBindingSummary);
  }

  const { data, error } = await supabase
    .from('sys_ntf_prov_tmpl_bind_dtl')
    .select('component_position, parameter_position, external_slot, variable_id')
    .eq('revision_id', revisionId)
    .eq('is_active', true)
    .eq('rec_status', 1)
    .order('component_position', { ascending: true })
    .order('parameter_position', { ascending: true });
  if (error || !data) return [];
  return (data as RawBindingRow[]).map(toBindingSummary);
}

type RawRouteRow = {
  id: string;
  route_owner: string | null;
  assignment_version: number;
  language_code: string;
  fallback_language: string | null;
  platform_account_id: string | null;
  platform_sender_id: string | null;
  provider_revision_id: string | null;
  private_account_id: string | null;
  private_sender_id: string | null;
  private_revision_id: string | null;
};

/**
 * Resolves the single ACTIVE route (if any) assigned for one tenant/event/
 * channel/language tuple and materializes the pinned account/sender/revision/
 * binding identity the route already recorded at activation.
 *
 * This is a read-only projection: it never creates a delivery, enqueues
 * provider work, reserves quota, or calls a provider. Absence of a route and
 * a lookup error are returned as distinct, explicit results — never the same
 * value and never a silent fallback to a different language or resource.
 *
 * @param tenantOrgId Tenant that must own every matched route row.
 * @param eventCode Business notification event, e.g. 'order.created'.
 * @param channelCode Notification channel, e.g. 'WHATSAPP'.
 * @param languageCode Already-authorized language; this function never infers or defaults one.
 * @returns A matched pinned route identity, or an explicit no-route/lookup-error result.
 * @example
 * const effective = await resolveEffectiveNotificationRoute('tenant-a', 'order.created', 'WHATSAPP', 'en');
 * if (effective.matched) { // effective.accountId, effective.revisionId, ... }
 */
export async function resolveEffectiveNotificationRoute(
  tenantOrgId: string,
  eventCode: string,
  channelCode: string,
  languageCode: string,
): Promise<EffectiveNotificationRouteResult> {
  if (!tenantOrgId.trim() || !eventCode.trim() || !channelCode.trim() || !languageCode.trim()) {
    return noMatch('NO_ACTIVE_ROUTE');
  }

  const key = cacheKey(tenantOrgId, eventCode, channelCode, languageCode);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  let result: EffectiveNotificationRouteResult;
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('org_ntf_route_assign_cf')
      .select(
        'id, route_owner, assignment_version, language_code, fallback_language, platform_account_id, platform_sender_id, provider_revision_id, private_account_id, private_sender_id, private_revision_id',
      )
      .eq('tenant_org_id', tenantOrgId)
      .eq('event_code', eventCode)
      .eq('channel_code', channelCode)
      .eq('language_code', languageCode)
      .eq('route_state', 'ACTIVE')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      logger.warn('route-resolver: active-route lookup failed', {
        tenantOrgId, eventCode, channelCode, languageCode, feature: 'notifications',
      });
      result = noMatch('LOOKUP_ERROR');
    } else if (!data) {
      result = noMatch('NO_ACTIVE_ROUTE');
    } else {
      const row = data as RawRouteRow;
      const routeOwner: NotificationRouteOwner = row.route_owner === 'PRIVATE' ? 'PRIVATE' : 'PLATFORM';
      const accountId = routeOwner === 'PRIVATE' ? row.private_account_id : row.platform_account_id;
      const senderId = routeOwner === 'PRIVATE' ? row.private_sender_id : row.platform_sender_id;
      const revisionId = routeOwner === 'PRIVATE' ? row.private_revision_id : row.provider_revision_id;

      if (!accountId || !revisionId) {
        // Defensive only: ck_ntf_route_resource already guarantees this pairing exists.
        // A resolver must never fabricate an identity if that invariant were ever violated.
        logger.warn('route-resolver: ACTIVE route is missing its required account/revision pairing', {
          tenantOrgId, routeId: row.id, routeOwner, feature: 'notifications',
        });
        result = noMatch('LOOKUP_ERROR');
      } else {
        const bindings = await loadBindings(tenantOrgId, routeOwner, revisionId);
        result = {
          matched: true,
          routeId: row.id,
          routeOwner,
          assignmentVersion: row.assignment_version,
          languageCode: row.language_code,
          fallbackLanguage: row.fallback_language ?? null,
          accountId,
          senderId: senderId ?? null,
          revisionId,
          bindingCount: bindings.length,
          bindings,
          resolvedAt: new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    logger.warn('route-resolver: unexpected active-route lookup error', {
      tenantOrgId, eventCode, channelCode, languageCode,
      error: err instanceof Error ? err.message : String(err),
      feature: 'notifications',
    });
    result = noMatch('LOOKUP_ERROR');
  }

  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { value: result, expiresAt: now + CACHE_TTL_MS });
  return result;
}
