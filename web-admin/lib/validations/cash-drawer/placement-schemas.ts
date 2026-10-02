import { z } from 'zod';

/**
 * Optional explicit cash placement accepted by every route that lets the cash
 * gate place a cash line on the caller's behalf (VERIFY of a pending leg,
 * voucher reversal). Spread into the route's own body schema. The gate's
 * integrity rules still decide whether the named drawer is acceptable.
 */
export const cashPlacementShape = {
  /** Place the cash in this drawer instead of the line's own drawer. */
  cashDrawerId: z.string().uuid().optional(),
  /** Pin the placement to this session (must be the drawer's open session). */
  cashDrawerSessionId: z.string().uuid().optional(),
  /** The user who physically handled the cash, when not the acting user. */
  receivedByUserId: z.string().uuid().optional(),
};
