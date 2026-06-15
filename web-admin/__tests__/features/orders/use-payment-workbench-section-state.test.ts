import { act, renderHook } from '@testing-library/react';
import { PAYMENT_MODAL_SECTION_IDS } from '@features/orders/ui/payment-modal-v04-sections-definition';
import { usePaymentWorkbenchSectionState } from '@features/orders/ui/use-payment-workbench-section-state';

describe('usePaymentWorkbenchSectionState', () => {
  it('toggles collapsible sections and resets when the modal reopens', () => {
    const { result, rerender } = renderHook(
      ({ open }) => usePaymentWorkbenchSectionState(open),
      { initialProps: { open: true } }
    );

    expect(result.current.isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)).toBe(false);

    act(() => {
      result.current.toggleSection(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR);
    });

    expect(result.current.isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)).toBe(true);

    rerender({ open: false });
    rerender({ open: true });

    expect(result.current.isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR)).toBe(false);
  });

  it('expandSection opens a collapsed section without flipping an expanded one', () => {
    const { result } = renderHook(() => usePaymentWorkbenchSectionState(true));

    act(() => {
      result.current.expandSection(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS);
    });

    expect(result.current.isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS)).toBe(true);
    expect(result.current.isSectionExpanded(PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT)).toBe(true);
  });
});
