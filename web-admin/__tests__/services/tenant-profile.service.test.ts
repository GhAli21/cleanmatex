/**
 * Tenant profile service — pure-function tests.
 *
 * Focus: business-hours bidirectional normalization. The DB and UI use
 * different keys/shapes; round-trip parity is essential to avoid silent
 * data loss on save.
 */

import { describe, it, expect } from '@jest/globals';
import {
  toDbHours,
  fromDbHours,
} from '@/lib/services/tenant-profile.service';
import type { UiBusinessHours } from '@/lib/types/tenant-profile';

describe('tenant-profile: business-hours normalizer', () => {
  const fullWeekUi: UiBusinessHours = {
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true },
  };

  it('toDbHours collapses closed days to null and remaps keys', () => {
    const db = toDbHours(fullWeekUi);
    expect(db.mon).toEqual({ open: '08:00', close: '18:00' });
    expect(db.sat).toEqual({ open: '09:00', close: '14:00' });
    expect(db.sun).toBeNull();
  });

  it('fromDbHours surfaces null days as closed with safe defaults', () => {
    const ui = fromDbHours({
      mon: { open: '08:00', close: '18:00' },
      tue: { open: '08:00', close: '18:00' },
      wed: null,
      thu: { open: '08:00', close: '18:00' },
      fri: { open: '08:00', close: '18:00' },
      sat: { open: '09:00', close: '14:00' },
      sun: null,
    });
    expect(ui.wednesday.closed).toBe(true);
    expect(ui.sunday.closed).toBe(true);
    expect(ui.monday).toEqual({ open: '08:00', close: '18:00', closed: false });
  });

  it('round-trips ui → db → ui without losing open days', () => {
    const round = fromDbHours(toDbHours(fullWeekUi));
    // Closed-day open/close strings are normalized to '00:00' on the round
    // trip (DB stored null), so compare structure rather than raw equality.
    for (const day of [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ] as const) {
      expect(round[day]).toEqual(fullWeekUi[day]);
    }
    expect(round.sunday.closed).toBe(true);
  });

  it('fromDbHours handles missing or null input as full default week', () => {
    const ui = fromDbHours(null);
    expect(ui.monday.closed).toBe(false);
    expect(ui.sunday.closed).toBe(true);
  });
});
