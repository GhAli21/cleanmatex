/**
 * PR-04 Task 1: the order summary panel's counter controls are Cmx buttons and a Cmx switch,
 * named by i18n keys, with logical (RTL-safe) layout.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
let mockRtl = false;
jest.mock('@/lib/hooks/useRTL', () => ({ useRTL: () => mockRtl }));
jest.mock('@ui/feedback', () => ({ CmxSummaryMessage: () => null }));
jest.mock('@/lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({}) }));
jest.mock('@features/orders/ui/item-cart-list', () => ({ ItemCartList: () => null }));
jest.mock('@features/orders/ui/service-speed-select', () => ({ ServiceSpeedSelect: () => null }));
jest.mock('@features/orders/ui/cart-quote-totals', () => ({ CartQuoteTotals: () => null }));
jest.mock('@features/orders/order-change/edit-control-notice', () => ({ EditControlNotice: () => null }));
jest.mock('@features/orders/order-change/use-edit-control-capability', () => ({
  useEditControlGroup: () => ({ interactive: true }),
}));

import { OrderSummaryPanel } from '@features/orders/ui/order-summary-panel';

type Props = React.ComponentProps<typeof OrderSummaryPanel>;

function setup(over: Partial<Props> = {}) {
  const props: Props = {
    isQuickDrop: false,
    onQuickDropToggle: jest.fn(),
    quickDropQuantity: 0,
    onQuickDropQuantityChange: jest.fn(),
    notes: '',
    onNotesChange: jest.fn(),
    readyByAt: '',
    onSubmit: jest.fn(),
    onOpenPaymentModal: jest.fn(),
    loading: false,
    canSubmit: true,
    ...over,
  };
  render(<OrderSummaryPanel {...props} />);
  return props;
}

const S = 'newOrder.orderSummary';

beforeEach(() => {
  mockRtl = false;
});

describe('OrderSummaryPanel ergonomics', () => {
  it('names the Quick Drop steppers with i18n keys, not English literals', () => {
    setup();
    expect(screen.getByRole('button', { name: `${S}.quickDropDecrease` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${S}.quickDropIncrease` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quick drop/i })).not.toBeInTheDocument();
  });

  it('"+" from 0 sets 1 and turns Quick Drop on', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: `${S}.quickDropIncrease` }));
    expect(p.onQuickDropQuantityChange).toHaveBeenCalledWith(1);
    expect(p.onQuickDropToggle).toHaveBeenCalledWith(true);
  });

  it('"−" from 1 sets 0 and turns Quick Drop off', () => {
    const p = setup({ quickDropQuantity: 1, isQuickDrop: true });
    fireEvent.click(screen.getByRole('button', { name: `${S}.quickDropDecrease` }));
    expect(p.onQuickDropQuantityChange).toHaveBeenCalledWith(0);
    expect(p.onQuickDropToggle).toHaveBeenCalledWith(false);
  });

  it('the notes toggle is a switch that flips aria-checked and shows the textarea', () => {
    setup();
    const sw = screen.getByRole('switch', { name: `${S}.showNotes` });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('the retail indicator is labelled by i18n keys', () => {
    setup({ isRetailOnlyOrder: true });
    expect(screen.getByRole('img', { name: `${S}.retailOrder` })).toBeInTheDocument();
  });

  it('the submit button is disabled when canSubmit is false', () => {
    const p = setup({ canSubmit: false });
    const btn = screen.getByRole('button', { name: 'newOrder.submitOrder' });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(p.onOpenPaymentModal).not.toHaveBeenCalled();
  });

  it('the submit button opens payment when canSubmit is true', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'newOrder.submitOrder' }));
    expect(p.onOpenPaymentModal).toHaveBeenCalledTimes(1);
  });

  it('ready-by buttons are named', () => {
    setup({ onCalculateReadyBy: jest.fn(async () => undefined), onOpenReadyByModal: jest.fn() });
    expect(screen.getByRole('button', { name: 'newOrder.calculateReadyBy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${S}.openReadyBy` })).toBeInTheDocument();
  });

  it('in Arabic the stepper row uses logical layout (no flex-row-reverse double flip)', () => {
    mockRtl = true;
    const { container } = render(
      <div dir="rtl">
        <OrderSummaryPanel
          isQuickDrop={false}
          onQuickDropToggle={jest.fn()}
          quickDropQuantity={0}
          onQuickDropQuantityChange={jest.fn()}
          notes=""
          onNotesChange={jest.fn()}
          readyByAt=""
          onSubmit={jest.fn()}
          loading={false}
          canSubmit
        />
      </div>,
    );
    expect(container.querySelector('.flex-row-reverse')).toBeNull();
    expect(container.querySelector('.divide-x-reverse')).toBeNull();
  });
});
