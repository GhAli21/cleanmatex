import { calculateReadyBy } from '@/lib/utils/ready-by-calculator';

describe('Ready-By Calculator', () => {
  const baseTime = new Date('2025-10-30T10:00:00');

  describe('Basic calculations', () => {
    it('should calculate ready-by time with normal priority', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
      });

      // 48 hours from 10:00 AM = 2 days later at 10:00 AM
      expect(result.getTime()).toBeGreaterThan(baseTime.getTime());
      const diffHours = (result.getTime() - baseTime.getTime()) / (1000 * 60 * 60);
      expect(diffHours).toBeCloseTo(48, 1);
    });

    it('should apply urgent priority multiplier (0.7x)', () => {
      const normalResult = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
      });

      const urgentResult = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'urgent',
      });

      const normalDiff = normalResult.getTime() - baseTime.getTime();
      const urgentDiff = urgentResult.getTime() - baseTime.getTime();

      // Urgent should be ~0.7x the normal time
      expect(urgentDiff).toBeLessThan(normalDiff);
      expect(urgentDiff / normalDiff).toBeCloseTo(0.7, 1);
    });

    it('should apply express priority multiplier (0.5x)', () => {
      const normalResult = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
      });

      const expressResult = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'express',
      });

      const normalDiff = normalResult.getTime() - baseTime.getTime();
      const expressDiff = expressResult.getTime() - baseTime.getTime();

      // Express should be ~0.5x the normal time
      expect(expressDiff).toBeLessThan(normalDiff);
      expect(expressDiff / normalDiff).toBeCloseTo(0.5, 1);
    });
  });

  describe('Business hours mode', () => {
    it('should respect business hours (9 AM - 6 PM)', () => {
      const afterHoursTime = new Date('2025-10-30T18:30:00'); // 6:30 PM

      const result = calculateReadyBy({
        receivedAt: afterHoursTime,
        turnaroundHours: 2,
        priority: 'normal',
        businessHoursOnly: true,
        businessHours: {
          start: 9,
          end: 18,
        },
      });

      // Should start counting from next business day at 9 AM
      expect(result.getHours()).toBeGreaterThanOrEqual(9);
      expect(result.getHours()).toBeLessThanOrEqual(18);
    });

    it('should handle weekend skip when business hours enabled', () => {
      // Friday at 5 PM
      const fridayEvening = new Date('2025-10-31T17:00:00');

      const result = calculateReadyBy({
        receivedAt: fridayEvening,
        turnaroundHours: 24,
        priority: 'normal',
        businessHoursOnly: true,
        businessHours: {
          start: 9,
          end: 18,
        },
        skipWeekends: true,
      });

      // Should skip Saturday (day 6) and Sunday (day 0)
      const resultDay = result.getDay();
      expect(resultDay).not.toBe(0); // Not Sunday
      expect(resultDay).not.toBe(6); // Not Saturday
    });

    it('should calculate correctly for same-day turnaround within business hours', () => {
      const morningTime = new Date('2025-10-30T09:00:00'); // 9 AM

      const result = calculateReadyBy({
        receivedAt: morningTime,
        turnaroundHours: 4,
        priority: 'normal',
        businessHoursOnly: true,
        businessHours: {
          start: 9,
          end: 18,
        },
      });

      // 4 hours from 9 AM = 1 PM same day
      expect(result.toDateString()).toBe(morningTime.toDateString());
      expect(result.getHours()).toBe(13);
    });
  });

  describe('Override ready-by date', () => {
    it('should use override date when provided', () => {
      const overrideDate = new Date('2025-11-15T14:00:00');

      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
        readyByOverride: overrideDate,
      });

      expect(result).toEqual(overrideDate);
    });

    it('should ignore other parameters when override is provided', () => {
      const overrideDate = new Date('2025-11-15T14:00:00');

      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 1000, // Large value should be ignored
        priority: 'express', // Should be ignored
        readyByOverride: overrideDate,
      });

      expect(result).toEqual(overrideDate);
    });
  });

  describe('Service category turnaround', () => {
    it('should use service category turnaround when provided', () => {
      const resultWithCategory = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48, // Default
        serviceCategoryTurnaround: 24, // Override
        priority: 'normal',
      });

      const resultWithoutCategory = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
      });

      const diffWithCategory = resultWithCategory.getTime() - baseTime.getTime();
      const diffWithoutCategory = resultWithoutCategory.getTime() - baseTime.getTime();

      expect(diffWithCategory).toBeLessThan(diffWithoutCategory);
      expect(diffWithCategory / (1000 * 60 * 60)).toBeCloseTo(24, 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero turnaround time', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 0,
        priority: 'normal',
      });

      // Should return received time or slightly after
      expect(result.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    });

    it('should handle very long turnaround times', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 720, // 30 days
        priority: 'normal',
      });

      const diffDays = (result.getTime() - baseTime.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 1);
    });

    it('should handle fractional turnaround hours', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 1.5,
        priority: 'normal',
      });

      const diffMinutes = (result.getTime() - baseTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeCloseTo(90, 1); // 1.5 hours = 90 minutes
    });

    it('should handle dates in the past', () => {
      const pastTime = new Date('2025-10-01T10:00:00');

      const result = calculateReadyBy({
        receivedAt: pastTime,
        turnaroundHours: 24,
        priority: 'normal',
      });

      expect(result.getTime()).toBeGreaterThan(pastTime.getTime());
    });

    it('should round to nearest minute', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 0.5,
        priority: 'normal',
      });

      // Seconds should be 0
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('Priority multipliers', () => {
    const testCases = [
      { priority: 'normal', multiplier: 1.0 },
      { priority: 'urgent', multiplier: 0.7 },
      { priority: 'express', multiplier: 0.5 },
    ];

    testCases.forEach(({ priority, multiplier }) => {
      it(`should apply correct multiplier for ${priority} priority`, () => {
        const result = calculateReadyBy({
          receivedAt: baseTime,
          turnaroundHours: 48,
          priority: priority as any,
        });

        const expectedHours = 48 * multiplier;
        const actualHours = (result.getTime() - baseTime.getTime()) / (1000 * 60 * 60);

        expect(actualHours).toBeCloseTo(expectedHours, 1);
      });
    });
  });

  describe('Complex scenarios', () => {
    it('should handle express priority with service category override and business hours', () => {
      const result = calculateReadyBy({
        receivedAt: new Date('2025-10-30T14:00:00'), // 2 PM
        turnaroundHours: 48,
        serviceCategoryTurnaround: 24,
        priority: 'express',
        businessHoursOnly: true,
        businessHours: {
          start: 9,
          end: 18,
        },
      });

      // 24 hours * 0.5 (express) = 12 business hours
      // Starting at 2 PM: 4 hours left today (2-6 PM) + 8 hours next day (9 AM - 5 PM)
      expect(result.getHours()).toBeGreaterThanOrEqual(9);
      expect(result.getHours()).toBeLessThanOrEqual(18);
    });

    it('should maintain timezone consistency', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 24,
        priority: 'normal',
      });

      // Should maintain same timezone offset
      expect(result.getTimezoneOffset()).toBe(baseTime.getTimezoneOffset());
    });
  });
});
