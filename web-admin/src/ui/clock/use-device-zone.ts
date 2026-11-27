'use client';

import { useSyncExternalStore } from 'react';
import { isValidZoneId } from '@cmx/clock';

function readDeviceZone(): string | null {
  try {
    // clock-ok: D20 single allowlisted device-zone read, display only
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return z && isValidZoneId(z) ? z : null;
  } catch {
    return null;
  }
}

const subscribe = () => () => {};
const serverSnapshot = () => null;

/**
 * The viewer's device zone, for the display-only "My device zone" choice (D20).
 * This is the one place web-admin reads the device zone; it is never used for a
 * business day, a filter, or a write. Null on the server (and during hydration), so
 * the first client render matches the server render.
 */
export function useDeviceZone(): string | null {
  return useSyncExternalStore(subscribe, readDeviceZone, serverSnapshot);
}
