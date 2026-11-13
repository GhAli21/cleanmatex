/**
 * Shared contract for the Order Edit page session.
 * The token lives in tab storage and in the existing order edit lock, never in the address.
 */

/** Request header that proves this browser tab holds the live edit lock. */
export const ORDER_EDIT_SESSION_HEADER = 'x-order-edit-session';

/**
 * How long a lock lives after the last heartbeat.
 * A closed, crashed, or killed browser often never sends an end. The lease
 * itself frees the order. Long enough that a few missed heartbeats do not
 * kick out someone who is still editing.
 */
export const ORDER_EDIT_SESSION_TTL_MS = 90 * 1000;

/**
 * How often an open Edit page renews the lease, including while the tab is in the background.
 * Several beats fit inside the lease, so one failed request does not release the order.
 */
export const ORDER_EDIT_SESSION_HEARTBEAT_MS = 20 * 1000;

/**
 * Short grace after a tab unload so a refresh can reclaim the same token
 * before the lock is treated as closed.
 */
export const ORDER_EDIT_SESSION_UNLOAD_GRACE_MS = 20 * 1000;
