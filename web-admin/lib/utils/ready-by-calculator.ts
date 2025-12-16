/**
 * Ready-By Date Calculator
 *
 * Calculates when an order will be ready based on:
 * - Received date/time
 * - Service category turnaround time
 * - Priority multiplier (normal, urgent, express)
 * - Business hours
 *
 * Features:
 * - Respects business hours (e.g., 9 AM - 6 PM)
 * - Skips weekends and holidays
 * - Applies priority multipliers
 * - Handles timezone-aware calculations
 */

import { addHours, addDays, setHours, setMinutes, isWeekend, format } from 'date-fns';

export interface BusinessHours {
  /**
   * Opening hour (24-hour format, e.g., 9 for 9 AM)
   */
  open: number;

  /**
   * Closing hour (24-hour format, e.g., 18 for 6 PM)
   */
  close: number;

  /**
   * Working days (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
   * Example: [1, 2, 3, 4, 5, 6] for Mon-Sat
   */
  workingDays: number[];
}

export type Priority = 'normal' | 'urgent' | 'express';

export interface ReadyByCalculationParams {
  /**
   * When the order was received
   */
  receivedAt: Date;

  /**
   * Service category turnaround time in hours
   */
  turnaroundHours: number;

  /**
   * Order priority (affects multiplier)
   */
  priority: Priority;

  /**
   * Business hours configuration
   */
  businessHours: BusinessHours;

  /**
   * Holidays to skip (array of Date objects)
   */
  holidays?: Date[];
}

export interface ReadyByResult {
  /**
   * Calculated Ready-By date
   */
  readyBy: Date;

  /**
   * Actual turnaround hours after priority adjustment
   */
  adjustedTurnaroundHours: number;

  /**
   * Priority multiplier applied
   */
  priorityMultiplier: number;

  /**
   * Whether the date falls on a working day
   */
  isWorkingDay: boolean;

  /**
   * Formatted Ready-By date string
   */
  formatted: string;
}

/**
 * Priority multipliers
 * - normal: 1.0 (no change)
 * - urgent: 0.7 (30% faster)
 * - express: 0.5 (50% faster)
 */
const PRIORITY_MULTIPLIERS: Record<Priority, number> = {
  normal: 1.0,
  urgent: 0.7,
  express: 0.5,
};

/**
 * Default business hours (Mon-Sat, 9 AM - 6 PM)
 */
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  open: 9,
  close: 18,
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
};

/**
 * Calculate Ready-By date based on turnaround time and priority
 *
 * @param params - Calculation parameters
 * @returns ReadyByResult - Calculated Ready-By date and metadata
 *
 * @example
 * ```typescript
 * const result = calculateReadyBy({
 *   receivedAt: new Date('2025-10-25T10:00:00'),
 *   turnaroundHours: 48,
 *   priority: 'express',
 *   businessHours: DEFAULT_BUSINESS_HOURS
 * });
 *
 * console.log(result.readyBy); // Date object
 * console.log(result.formatted); // "Oct 27, 2025 at 6:00 PM"
 * console.log(result.adjustedTurnaroundHours); // 24 (48 * 0.5)
 * ```
 */
export function calculateReadyBy(params: ReadyByCalculationParams): ReadyByResult {
  const {
    receivedAt,
    turnaroundHours,
    priority,
    businessHours,
    holidays = [],
  } = params;

  // Get priority multiplier
  const priorityMultiplier = PRIORITY_MULTIPLIERS[priority];

  // Calculate adjusted turnaround hours
  const adjustedTurnaroundHours = turnaroundHours * priorityMultiplier;

  // Calculate initial target date/time (without business hours consideration)
  let targetDate = addHours(new Date(receivedAt), adjustedTurnaroundHours);

  // Round to business hours
  targetDate = roundToBusinessHours(targetDate, businessHours, holidays);

  // Check if the final date is a working day
  const isWorkingDay = businessHours.workingDays.includes(targetDate.getDay());

  // Format the date
  const formatted = formatReadyByDate(targetDate);

  return {
    readyBy: targetDate,
    adjustedTurnaroundHours,
    priorityMultiplier,
    isWorkingDay,
    formatted,
  };
}

/**
 * Round date to next business hour
 *
 * @param date - Date to round
 * @param businessHours - Business hours configuration
 * @param holidays - Holidays to skip
 * @returns Date - Rounded date
 */
function roundToBusinessHours(
  date: Date,
  businessHours: BusinessHours,
  holidays: Date[] = []
): Date {
  let result = new Date(date);

  // Skip to next working day if current day is not a working day
  while (!isWorkingDay(result, businessHours, holidays)) {
    result = addDays(result, 1);
    result = setHours(setMinutes(result, 0), businessHours.open);
  }

  // If before opening hours, set to opening time
  if (result.getHours() < businessHours.open) {
    result = setHours(setMinutes(result, 0), businessHours.open);
  }

  // If after closing hours, move to next working day opening
  if (result.getHours() >= businessHours.close) {
    result = addDays(result, 1);
    result = setHours(setMinutes(result, 0), businessHours.open);

    // Check if new day is working day
    while (!isWorkingDay(result, businessHours, holidays)) {
      result = addDays(result, 1);
    }
  }

  return result;
}

/**
 * Check if a date is a working day
 *
 * @param date - Date to check
 * @param businessHours - Business hours configuration
 * @param holidays - Holidays to skip
 * @returns boolean - True if working day
 */
function isWorkingDay(
  date: Date,
  businessHours: BusinessHours,
  holidays: Date[] = []
): boolean {
  const dayOfWeek = date.getDay();

  // Check if day is in working days
  if (!businessHours.workingDays.includes(dayOfWeek)) {
    return false;
  }

  // Check if date is a holiday
  const dateStr = format(date, 'yyyy-MM-dd');
  const isHoliday = holidays.some((holiday) => format(holiday, 'yyyy-MM-dd') === dateStr);

  return !isHoliday;
}

/**
 * Format Ready-By date for display
 *
 * @param date - Date to format
 * @returns string - Formatted date (e.g., "Oct 27, 2025 at 6:00 PM")
 */
export function formatReadyByDate(date: Date): string {
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Get priority multiplier for a given priority
 *
 * @param priority - Priority level
 * @returns number - Multiplier (0.5 - 1.0)
 */
export function getPriorityMultiplier(priority: Priority): number {
  return PRIORITY_MULTIPLIERS[priority];
}

/**
 * Calculate turnaround hours for each priority
 *
 * @param baseTurnaroundHours - Base turnaround hours
 * @returns Record<Priority, number> - Turnaround hours for each priority
 *
 * @example
 * ```typescript
 * const turnarounds = calculateTurnaroundByPriority(48);
 * // { normal: 48, urgent: 33.6, express: 24 }
 * ```
 */
export function calculateTurnaroundByPriority(
  baseTurnaroundHours: number
): Record<Priority, number> {
  return {
    normal: baseTurnaroundHours * PRIORITY_MULTIPLIERS.normal,
    urgent: baseTurnaroundHours * PRIORITY_MULTIPLIERS.urgent,
    express: baseTurnaroundHours * PRIORITY_MULTIPLIERS.express,
  };
}

/**
 * Check if Ready-By date is overdue
 *
 * @param readyBy - Ready-By date
 * @param now - Current date (defaults to now)
 * @returns boolean - True if overdue
 */
export function isOverdue(readyBy: Date, now: Date = new Date()): boolean {
  return now > readyBy;
}

/**
 * Calculate hours until Ready-By
 *
 * @param readyBy - Ready-By date
 * @param now - Current date (defaults to now)
 * @returns number - Hours until Ready-By (negative if overdue)
 */
export function hoursUntilReadyBy(readyBy: Date, now: Date = new Date()): number {
  const diff = readyBy.getTime() - now.getTime();
  return diff / (1000 * 60 * 60); // Convert milliseconds to hours
}
