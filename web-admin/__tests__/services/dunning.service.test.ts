/**
 * Unit tests for dunning.service
 * Pure function evaluateDunningLevels
 */

// G12 (S4): "today" comes from the organization zone; tests pin it.
const mockCivilToday = jest.fn(async (..._a: unknown[]): Promise<string> => '2026-11-27');
jest.mock('@/lib/utils/operational-zone.server', () => {
  class OperationalZoneMissingError extends Error {
    readonly code = 'TIMEZONE_NOT_CONFIGURED';
    constructor() { super('TIMEZONE_NOT_CONFIGURED'); }
  }
  return { operationalCivilToday: (...a: unknown[]) => mockCivilToday(...a), OperationalZoneMissingError };
});

import {
  evaluateDunningLevels,
  type DunningLevel,
  type OverdueStatement,
} from '@/lib/services/dunning.service';

describe('dunning.service', () => {
  const levels: DunningLevel[] = [
    { days: 7, action: 'email' },
    { days: 14, action: 'sms' },
    { days: 30, action: 'hold_orders' },
  ];

  describe('evaluateDunningLevels', () => {
    it('returns null when daysOverdue is below all levels', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 3,
      };
      expect(await evaluateDunningLevels(stmt, levels)).toBeNull();
    });

    it('returns level 1 (7d) when 7 days overdue', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 7,
      };
      const result = await evaluateDunningLevels(stmt, levels);
      expect(result).toEqual({ days: 7, action: 'email' });
    });

    it('returns level 2 (14d) when 14 days overdue', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 14,
      };
      const result = await evaluateDunningLevels(stmt, levels);
      expect(result).toEqual({ days: 14, action: 'sms' });
    });

    it('returns level 3 (30d) when 30+ days overdue', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 30,
      };
      const result = await evaluateDunningLevels(stmt, levels);
      expect(result).toEqual({ days: 30, action: 'hold_orders' });
    });

    it('returns highest applicable level when 45 days overdue', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 45,
      };
      const result = await evaluateDunningLevels(stmt, levels);
      expect(result).toEqual({ days: 30, action: 'hold_orders' });
    });

    it('returns null when levels array is empty', async () => {
      const stmt: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 30,
      };
      expect(await evaluateDunningLevels(stmt, [])).toBeNull();
    });

    it('handles single level', async () => {
      const singleLevel: DunningLevel[] = [{ days: 10, action: 'email' }];
      const stmt8: OverdueStatement = {
        id: '1',
        statementNo: 'STMT-001',
        customerId: 'c1',
        dueDate: '2026-01-01',
        balanceAmount: 100,
        daysOverdue: 8,
      };
      const stmt15: OverdueStatement = { ...stmt8, daysOverdue: 15 };
      expect(await evaluateDunningLevels(stmt8, singleLevel)).toBeNull();
      expect(await evaluateDunningLevels(stmt15, singleLevel)).toEqual({ days: 10, action: 'email' });
    });
  });
});
