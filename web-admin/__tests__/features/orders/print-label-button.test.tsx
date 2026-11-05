/**
 * HFC P4: the order label button is always enabled (no stored qr_code/barcode needed), loads
 * /label-data and prints the order label or the piece tags; failures show a toast and print nothing.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, v?: Record<string, unknown>) => (v ? `${ns}.${key}:${JSON.stringify(v)}` : `${ns}.${key}`),
}));
jest.mock('@/lib/hooks/useLocale', () => ({ useLocale: () => 'ar' }));
const showError = jest.fn();
jest.mock('@ui/feedback', () => ({ showError: (m: string) => showError(m) }));
const printReactInIframe = jest.fn(async () => undefined);
jest.mock('@/lib/utils/print/print-react-in-iframe', () => ({
  printReactInIframe: (...a: unknown[]) => printReactInIframe(...(a as [])),
}));

import { PrintLabelButton } from '@features/orders/ui/print-label-button';
import { DEFAULT_LABEL_SETTINGS } from '@/lib/services/labels/label-types';

const data = (pieces: unknown[] = []) => ({
  success: true,
  data: {
    order: { orderId: 'o1', orderNo: 'ORD-1', staffQr: 'CMX1:ORD:ORD-1', barcodeValue: 'ORD-1', branchName: null, branchName2: null, readyBy: null, itemCount: 0, pieceCount: 0, customerShort: null },
    pieces,
    settings: { ...DEFAULT_LABEL_SETTINGS, orderLabelSize: 'A6' },
  },
});
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  showError.mockReset();
  printReactInIframe.mockClear();
  global.fetch = fetchMock as never;
});

const respond = (body: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => body });

describe('PrintLabelButton', () => {
  it('is enabled without stored codes and prints the order label with the A6 page in Arabic', async () => {
    respond(data());
    render(<PrintLabelButton order={{ id: 'o1', order_no: 'ORD-1', qr_code: null, barcode: null }} />);
    const btn = screen.getByRole('button', { name: /orders.printLabel.printLabel/ });
    expect(btn).toBeEnabled();
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/orders/o1/label-data?pieces=none', expect.objectContaining({ cache: 'no-store' }));
    expect(printReactInIframe).toHaveBeenCalledTimes(1);
    const [el, opts] = printReactInIframe.mock.calls[0] as unknown as [React.ReactElement<{ template: string; locale: string }>, { css: string; dir: string; lang: string }];
    expect(el.props.template).toBe('order-label');
    expect(el.props.locale).toBe('ar');
    expect(opts).toMatchObject({ dir: 'rtl', lang: 'ar' });
    expect(opts.css).toContain('size: A6');
    expect(showError).not.toHaveBeenCalled();
  });

  it('prints all piece tags, or says there are none', async () => {
    respond(data([{ pieceId: 'p1' }]));
    render(<PrintLabelButton order={{ id: 'o1', order_no: 'ORD-1' }} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /labels.actions.printPieceTags/ }));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/orders/o1/label-data?pieces=all', expect.anything());
    expect((printReactInIframe.mock.calls[0] as unknown as [React.ReactElement<{ template: string }>])[0].props.template).toBe('piece-tag');

    respond(data([]));
    printReactInIframe.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /labels.actions.printPieceTags/ }));
    });
    expect(printReactInIframe).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledWith('labels.errors.noPieces');
  });

  it('shows a load error and prints nothing when label-data fails; can hide the piece tag button', async () => {
    respond({ success: false }, false);
    render(<PrintLabelButton order={{ id: 'o1', order_no: 'ORD-1' }} showPieceTags={false} />);
    expect(screen.queryByRole('button', { name: /printPieceTags/ })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /orders.printLabel.printLabel/ }));
    });
    expect(showError).toHaveBeenCalledWith('labels.errors.loadFailed');
    expect(printReactInIframe).not.toHaveBeenCalled();
  });
});
