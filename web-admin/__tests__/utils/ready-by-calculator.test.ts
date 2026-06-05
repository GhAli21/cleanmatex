import { calculateReadyBy, DEFAULT_BUSINESS_HOURS } from '@/lib/utils/ready-by-calculator';

describe('Ready-By Calculator', () => {
  const baseTime = new Date('2025-10-30T10:00:00'); // Thursday 10 AM

  describe('Basic calculations', () => {
    it('should calculate ready-by time with normal priority', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(result.readyBy.getTime()).toBeGreaterThan(baseTime.getTime());
      expect(result.adjustedTurnaroundHours).toBeCloseTo(48, 1);
    });

    it('should apply urgent priority multiplier (0.7x)', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'urgent',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(result.adjustedTurnaroundHours).toBeCloseTo(33.6, 1);
      expect(result.priorityMultiplier).toBe(0.7);
    });

    it('should apply express priority multiplier (0.5x)', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'express',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(result.adjustedTurnaroundHours).toBeCloseTo(24, 1);
      expect(result.priorityMultiplier).toBe(0.5);
    });
  });

  describe('Business hours mode', () => {
    it('should respect business hours (9 AM - 6 PM)', () => {
      const afterHoursTime = new Date('2025-10-30T18:30:00'); // 6:30 PM Thursday

      const result = calculateReadyBy({
        receivedAt: afterHoursTime,
        turnaroundHours: 2,
        priority: 'normal',
        businessHours: { open: 9, close: 18, workingDays: [1, 2, 3, 4, 5] },
      });

      // Should start counting from next business day at 9 AM
      expect(result.readyBy.getHours()).toBeGreaterThanOrEqual(9);
      expect(result.readyBy.getHours()).toBeLessThanOrEqual(18);
    });

    it('should handle weekend skip when business hours enabled', () => {
      // Friday at 5 PM
      const fridayEvening = new Date('2025-10-31T17:00:00');

      const result = calculateReadyBy({
        receivedAt: fridayEvening,
        turnaroundHours: 24,
        priority: 'normal',
        businessHours: { open: 9, close: 18, workingDays: [1, 2, 3, 4, 5] }, // Mon-Fri only
      });

      // Should skip Saturday (day 6) and Sunday (day 0)
      const resultDay = result.readyBy.getDay();
      expect(resultDay).not.toBe(0); // Not Sunday
      expect(resultDay).not.toBe(6); // Not Saturday
    });

    it('should calculate correctly for same-day turnaround within business hours', () => {
      const morningTime = new Date('2025-10-30T09:00:00'); // 9 AM Thursday

      const result = calculateReadyBy({
        receivedAt: morningTime,
        turnaroundHours: 4,
        priority: 'normal',
        businessHours: { open: 9, close: 18, workingDays: [1, 2, 3, 4, 5, 6] },
      });

      // 4 hours from 9 AM = 1 PM same day
      expect(result.readyBy.toDateString()).toBe(morningTime.toDateString());
      expect(result.readyBy.getHours()).toBe(13);
    });
  });

  describe('Service category turnaround', () => {
    it('should use shorter turnaround when category specifies fewer hours', () => {
      const resultShort = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 24,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      const resultLong = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 48,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(resultShort.readyBy.getTime()).toBeLessThan(resultLong.readyBy.getTime());
      expect(resultShort.adjustedTurnaroundHours).toBeCloseTo(24, 1);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero turnaround time', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 0,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      // Should return received time or slightly after (within business hours)
      expect(result.readyBy.getTime()).toBeGreaterThanOrEqual(baseTime.getTime());
    });

    it('should handle very long turnaround times', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 720, // 30 days
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      const diffDays = (result.readyBy.getTime() - baseTime.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0); // roughly 30 days
    });

    it('should handle fractional turnaround hours', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 1.5,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      const diffMinutes = (result.readyBy.getTime() - baseTime.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeCloseTo(90, 1); // 1.5 hours = 90 minutes
    });

    it('should handle dates in the past', () => {
      const pastTime = new Date('2025-10-01T10:00:00');

      const result = calculateReadyBy({
        receivedAt: pastTime,
        turnaroundHours: 24,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(result.readyBy.getTime()).toBeGreaterThan(pastTime.getTime());
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
          businessHours: DEFAULT_BUSINESS_HOURS,
        });

        const expectedHours = 48 * multiplier;
        expect(result.adjustedTurnaroundHours).toBeCloseTo(expectedHours, 1);
        expect(result.priorityMultiplier).toBe(multiplier);
      });
    });
  });

  describe('Result shape', () => {
    it('should return all required fields', () => {
      const result = calculateReadyBy({
        receivedAt: baseTime,
        turnaroundHours: 24,
        priority: 'normal',
        businessHours: DEFAULT_BUSINESS_HOURS,
      });

      expect(result.readyBy).toBeInstanceOf(Date);
      expect(typeof result.adjustedTurnaroundHours).toBe('number');
      expect(typeof result.priorityMultiplier).toBe('number');
      expect(typeof result.isWorkingDay).toBe('boolean');
      expect(typeof result.formatted).toBe('string');
    });
  });
});
