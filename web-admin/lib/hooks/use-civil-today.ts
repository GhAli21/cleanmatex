'use client';

import { useState } from 'react';
import { civilDateInZone } from '@/lib/utils/operational-time';

/**
 * Civil today for a date input. The day is filled once the operations zone arrives.
 * A value the user already typed is left as they typed it.
 */
export function useCivilTodayDefault(zone: string | null): [string, (next: string) => void] {
  const [value, setValue] = useState('');
  const [seededZone, setSeededZone] = useState<string | null>(null);

  if (zone !== seededZone) {
    setSeededZone(zone);
    if (zone && value === '') {
      const day = civilDateInZone(new Date(), zone);
      if (day) setValue(day);
    }
  }

  return [value, setValue];
}
