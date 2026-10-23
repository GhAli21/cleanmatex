/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';
import { EditReviewChanges } from '@features/orders/order-change/edit-review-changes';
import type { EditReviewOperation } from '@features/orders/order-change/edit-review-view';
import en from '../../../../messages/en/orders/edit.json';
import ar from '../../../../messages/ar/orders/edit.json';

let mockLocale = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace === 'common') return ({ yes: mockLocale === 'ar' ? 'نعم' : 'Yes', no: mockLocale === 'ar' ? 'لا' : 'No', priority: 'Priority' } as Record<string, string>)[key] ?? key;
    return key.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], mockLocale === 'ar' ? ar : en);
  },
}));

const quantity: EditReviewOperation = {
  seq: 1, code: 'CHANGE_ITEM_QUANTITY', target: 'PERSISTED_ITEM', targetLabel: 'Shirt', targetLabel2: 'قميص', effect: 'change',
  before: { orderId: 'secret-order', orderItemId: 'secret-item', quantity: 1 },
  after: { orderId: 'secret-order', orderItemId: 'secret-item', quantity: 2 }, changedKeys: ['quantity'],
};

describe('compact review operation rows', () => {
  beforeEach(() => { mockLocale = 'en'; });

  it('shows named before/after lines and keeps the gate under its operation without raw identities or an expander', () => {
    const html = renderToStaticMarkup(<EditReviewChanges operations={[quantity]} renderWarning={() => <span>Confirm this change</span>} />);
    expect(html).toContain('Change item quantity');
    expect(html).toContain('Shirt');
    expect(html).toContain('Before');
    expect(html).toContain('After');
    expect(html.indexOf('Confirm this change')).toBeGreaterThan(html.indexOf('After'));
    expect(html).not.toMatch(/secret-|CHANGE_ITEM_QUANTITY|orderItemId|Show stored values|grid-cols/);
  });

  it('shows the full removal business snapshot and its stored damage kind in Arabic', () => {
    mockLocale = 'ar';
    const html = renderToStaticMarkup(<EditReviewChanges operations={[{
      seq: 2, code: 'REMOVE_PREFERENCE', target: 'PERSISTED_PREFERENCE', targetLabel: 'Tear', targetLabel2: 'تمزق', preferenceKind: 'condition_damag', effect: 'remove',
      before: { preferenceId: 'secret-preference', preferenceContent: 'Sleeve tear', extraPrice: '1.2500' }, after: { recStatus: 0 },
    }]} currencyCode="OMR" />);
    expect(html).toContain('ستتم الإزالة');
    expect(html).toContain('تمزق');
    expect(html).toContain('تلف');
    expect(html).toContain('Sleeve tear');
    expect(html).not.toMatch(/condition_damag|secret-preference|recStatus/);
  });

  it('formats ready-by in the organization timezone and includes currency on money values', () => {
    const html = renderToStaticMarkup(<EditReviewChanges operations={[{
      seq: 3, code: 'CHANGE_READY_BY', target: 'ORDER', effect: 'change',
      before: { readyBy: null, totalAmount: '1.0000' }, after: { readyBy: '2026-10-23T00:00:00Z', totalAmount: '2.5000' }, changedKeys: ['readyBy', 'totalAmount'],
    }]} currencyCode="OMR" timezone="Asia/Muscat" />);
    expect(html).toContain('None');
    expect(html).toContain('4:00');
    expect(html).toContain('OMR');
    expect(html).not.toContain('2026-10-23T00:00:00Z');
  });
});
