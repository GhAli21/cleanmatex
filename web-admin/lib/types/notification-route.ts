/**
 * Types for the tenant-side effective notification route resolver
 * (`ResolveEffectiveNotificationRoute`, see lib/notifications/route-resolver.ts).
 *
 * These mirror the persisted shape of `org_ntf_route_assign_cf` and its
 * dependent revision/binding tables (supabase/migrations/0579, 0580, 0582,
 * 0583). Values are read-only projections; this module defines no new
 * database object and no new permission.
 */

/** Matches org_ntf_route_assign_cf.route_owner. */
export type NotificationRouteOwner = 'PLATFORM' | 'PRIVATE';

/** Matches org_ntf_route_assign_cf.route_state. */
export type NotificationRouteState = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

/** Why a resolution attempt found no usable route; distinct from a lookup error. */
export type NoEffectiveNotificationRouteReason = 'NO_ACTIVE_ROUTE' | 'LOOKUP_ERROR';

/**
 * One ordered provider component-slot binding, structurally summarized.
 * Never includes a static value or variable-resolved content — only the
 * position/slot identity needed to prove a binding exists and its source kind.
 */
export interface NotificationRouteBindingSummary {
  componentPosition: number;
  parameterPosition: number;
  externalSlot: string;
  source: 'VARIABLE' | 'STATIC';
}

/** An ACTIVE route was found; this is the pinned identity it already recorded at activation. */
export interface EffectiveNotificationRouteMatch {
  matched: true;
  routeId: string;
  routeOwner: NotificationRouteOwner;
  assignmentVersion: number;
  languageCode: string;
  fallbackLanguage: string | null;
  /** Platform (sys_ntf_prov_acct_mst) or tenant-private (org_ntf_prov_acct_mst) account id. */
  accountId: string;
  /** Platform or tenant-private sender id; null when the route has no sender restriction. */
  senderId: string | null;
  /** Platform (sys_ntf_prov_tmpl_rev_dtl) or tenant-private (org_ntf_ptrev_dtl) immutable revision id. */
  revisionId: string;
  bindingCount: number;
  bindings: NotificationRouteBindingSummary[];
  resolvedAt: string;
}

/** No ACTIVE route exists for this exact tuple, or the lookup itself failed. Never a guess or a default. */
export interface EffectiveNotificationRouteNoMatch {
  matched: false;
  reason: NoEffectiveNotificationRouteReason;
  resolvedAt: string;
}

export type EffectiveNotificationRouteResult =
  | EffectiveNotificationRouteMatch
  | EffectiveNotificationRouteNoMatch;
