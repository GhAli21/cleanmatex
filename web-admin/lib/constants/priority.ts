/**
 * Shared priority codes — mirror sys_lkp_priority_cd.code
 */

export const PRIORITY = {
  URGENT: 'urgent',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
} as const;

export type PriorityCode = (typeof PRIORITY)[keyof typeof PRIORITY];

export const PRIORITY_CODES = Object.values(PRIORITY);

export const DEFAULT_PRIORITY: PriorityCode = PRIORITY.NORMAL;
