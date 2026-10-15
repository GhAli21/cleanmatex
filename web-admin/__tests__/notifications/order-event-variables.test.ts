/**
 * Order-event notification variables (test-matrix row 21: date-only values and timezone boundaries).
 */
import { buildOrderCreatedNotificationVariables } from '@/lib/notifications/order-event-variables';

describe('buildOrderCreatedNotificationVariables', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps the order number and mirrors the ready-by label into the Twilio {{date}} alias', () => {
    const vars = buildOrderCreatedNotificationVariables({ orderNo: 'ORD-001', readyByAt: '2026-10-15', locale: 'en' });
    expect(vars.order_number).toBe('ORD-001');
    expect(vars.estimated_ready_at).toBe(vars.date);
  });

  it('formats a date-only value as that calendar day, independent of the server zone', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleDateString');
    const vars = buildOrderCreatedNotificationVariables({ orderNo: 'A', readyByAt: '2026-10-15', locale: 'en' });
    // Formatted in UTC so a negative-offset server cannot show October 14.
    expect(spy).toHaveBeenCalledWith('en', expect.objectContaining({ timeZone: 'UTC' }));
    expect(vars.estimated_ready_at).toBe('October 15, 2026');
  });

  it('keeps a full timestamp in the server zone (an instant, not a calendar day)', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleDateString');
    buildOrderCreatedNotificationVariables({ orderNo: 'A', readyByAt: '2026-10-15T23:30:00Z', locale: 'en' });
    const options = spy.mock.calls[0][1] as Intl.DateTimeFormatOptions;
    expect(options.timeZone).toBeUndefined();
  });

  it('renders Arabic with Arabic month names', () => {
    const vars = buildOrderCreatedNotificationVariables({ orderNo: 'A', readyByAt: '2026-10-15', locale: 'ar' });
    expect(vars.estimated_ready_at).not.toBe('October 15, 2026');
    expect(vars.estimated_ready_at).toMatch(/[؀-ۿ]/);
  });

  it.each([null, undefined, '', 'not-a-date', new Date('nope')])('falls back to "Pending" for %p', (value) => {
    expect(buildOrderCreatedNotificationVariables({ orderNo: 'A', readyByAt: value as never }).estimated_ready_at).toBe('Pending');
  });

  it('accepts a Date object and formats a year-boundary day correctly', () => {
    const vars = buildOrderCreatedNotificationVariables({ orderNo: 'A', readyByAt: new Date(Date.UTC(2026, 11, 31, 12)), locale: 'en' });
    expect(vars.estimated_ready_at).toMatch(/December 3[01], 2026/);
  });
});
