/**
 * Shared contract for the Order Edit page session.
 * The token lives in tab storage and in the existing order edit lock, never in the address.
 */

/** Request header that proves this browser tab holds the live edit lock. */
export const ORDER_EDIT_SESSION_HEADER = 'x-order-edit-session';

/** Matches the existing order edit lock TTL so one clock governs both. */
export const ORDER_EDIT_SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Short grace after a tab unload so a refresh can reclaim the same token
 * before the lock is treated as closed.
 */
export const ORDER_EDIT_SESSION_UNLOAD_GRACE_MS = 20 * 1000;
