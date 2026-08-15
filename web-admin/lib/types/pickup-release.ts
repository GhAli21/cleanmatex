/**
 * Customer-facing and staff-facing state derived from pickup release records.
 *
 * The release record carries handover audit data while `ready_for_pickup` is
 * the canonical workflow status for an order made available at the counter.
 */
export const PICKUP_RELEASE_STATES = {
  NOT_RELEASED: 'not_released',
  AVAILABLE_FOR_PICKUP: 'available_for_pickup',
  FULFILLED: 'fulfilled',
} as const;

export type PickupReleaseState =
  (typeof PICKUP_RELEASE_STATES)[keyof typeof PICKUP_RELEASE_STATES];

/** A safe read model for release visibility; it does not expose staff identity. */
export interface PickupReleaseSummary {
  state: PickupReleaseState;
  releaseId: string | null;
  releasedAt: string | null;
  fulfilledAt: string | null;
}

export const NOT_RELEASED_PICKUP_SUMMARY: PickupReleaseSummary = {
  state: PICKUP_RELEASE_STATES.NOT_RELEASED,
  releaseId: null,
  releasedAt: null,
  fulfilledAt: null,
};
