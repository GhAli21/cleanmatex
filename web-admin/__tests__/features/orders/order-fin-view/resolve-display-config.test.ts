import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { ORDER_FIN_SECTION_KEYS } from '@/lib/constants/order-fin-view';

describe('resolveOrderFinDisplayConfig', () => {
  it('defaults to summary for a saved order', () => {
    const r = resolveOrderFinDisplayConfig();
    expect(r.preset).toBe('summary');
    expect(r.sections.items).toBe('expandable');
    expect(r.sections.overpayment).toBe('total');
    expect(r.sections.vouchers).toBe('hidden');
    expect(r.header.metrics).toEqual(['balance', 'total', 'paid', 'credits']);
    expect(r.header.showReconciliationBadge).toBe(true);
    expect(r.lineCap).toBe(8);
    // receivable has no snapshot total, so even `total` mode loads it.
    expect(r.requiredSources).toEqual([
      'core', 'items', 'charges', 'discounts', 'taxes', 'payments', 'credits', 'refunds', 'receivable',
    ]);
  });

  it('loads only the snapshot for snapshot-backed totals', () => {
    expect(resolveOrderFinDisplayConfig({ preset: 'totals' }).requiredSources).toEqual(['core']);
    expect(resolveOrderFinDisplayConfig({ preset: 'badge' }).requiredSources).toEqual(['core']);
  });

  it('follows the matrix for detailed, full and audit', () => {
    const detailed = resolveOrderFinDisplayConfig({ preset: 'detailed' });
    expect([detailed.sections.items, detailed.sections.discounts, detailed.sections.receipts, detailed.sections.reconciliation])
      .toEqual(['expanded', 'expandable', 'hidden', 'hidden']);
    const audit = resolveOrderFinDisplayConfig({ preset: 'audit' });
    expect(audit.sections.debug).toBe('expandable');
    expect(audit.lineCap).toBeNull();
    expect(audit.showEmptySections).toBe(true);
    expect(audit.requiredSources).toContain('receipts');
  });

  it('applies caller section overrides and loads what they need', () => {
    const r = resolveOrderFinDisplayConfig({ preset: 'totals', sections: { loyalty: 'detail', items: 'hidden' } });
    expect(r.sections.loyalty).toBe('detail');
    expect(r.sections.items).toBe('hidden');
    expect(r.requiredSources).toEqual(['core', 'loyalty']);
  });

  it('never lets a caller widen the public preset', () => {
    const r = resolveOrderFinDisplayConfig({
      preset: 'public',
      sections: { debug: 'detail', vouchers: 'detail' },
      header: { metrics: ['balance', 'receivable', 'overpaid'], emphasize: 'netCollected', showReconciliationBadge: true },
      showWarnings: true,
      presetSwitcher: ['audit'],
    });
    expect(r.sections.debug).toBe('hidden');
    expect(r.sections.vouchers).toBe('hidden');
    expect(r.sections.payments).toBe('expandable');
    expect(r.header.metrics).toEqual(['balance', 'total', 'paid']);
    expect(r.header.emphasize).toBe('balance');
    expect(r.header.showReconciliationBadge).toBe(false);
    expect(r.showWarnings).toBe(false);
    expect(r.presetSwitcher).toEqual([]);
  });

  it('hides post-submission sections for a draft and loads nothing', () => {
    const r = resolveOrderFinDisplayConfig({ preset: 'audit', sections: { refunds: 'detail' } }, 'draft');
    expect(r.sections.refunds).toBe('hidden');
    expect(r.sections.timeline).toBe('hidden');
    expect(r.sections.items).toBe('detail');
    expect(r.requiredSources).toEqual([]);
  });

  it('keeps edit-only metrics for the edit source only', () => {
    const header = { metrics: ['projectedTotal', 'totalDelta', 'paid'] as const, emphasize: 'projectedBalance' as const };
    const saved = resolveOrderFinDisplayConfig({ header: { ...header, metrics: [...header.metrics] } }, 'saved');
    expect(saved.header.metrics).toEqual(['paid']);
    expect(saved.header.emphasize).toBe('balance');
    const edit = resolveOrderFinDisplayConfig({ header: { ...header, metrics: [...header.metrics] } }, 'edit');
    expect(edit.header.metrics).toEqual(['projectedTotal', 'totalDelta', 'paid']);
    expect(edit.header.emphasize).toBe('projectedBalance');
  });

  it('completes section order without losing or duplicating keys', () => {
    const r = resolveOrderFinDisplayConfig({ sectionOrder: ['payments', 'items', 'payments'] });
    expect(r.sectionOrder.slice(0, 2)).toEqual(['payments', 'items']);
    expect([...r.sectionOrder].sort()).toEqual([...ORDER_FIN_SECTION_KEYS].sort());
  });

  it('ignores an invalid line cap and keeps preset defaults over explicit undefined', () => {
    const r = resolveOrderFinDisplayConfig({ lineCap: 0, header: { emphasize: undefined } });
    expect(r.lineCap).toBe(8);
    expect(r.header.emphasize).toBe('balance');
    expect(resolveOrderFinDisplayConfig({ layout: 'print' }).lineCap).toBeNull();
  });
});
