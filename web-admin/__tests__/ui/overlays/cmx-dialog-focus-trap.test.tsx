import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';

describe('CmxDialog focus trap', () => {
  it('keeps Tab inside the dialog and closes on Escape', async () => {
    const onOpenChange = jest.fn();
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.appendChild(outside);
    outside.focus();

    render(
      <CmxDialog open onOpenChange={onOpenChange}>
        <CmxDialogContent data-testid="dlg">
          <CmxDialogHeader>
            <CmxDialogTitle>Title</CmxDialogTitle>
          </CmxDialogHeader>
          <button type="button">Body action</button>
          <CmxDialogFooter>
            <button type="button">Done</button>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>,
    );

    const dlg = await screen.findByTestId('dlg');
    await waitFor(() => {
      expect(dlg.closest('[data-cmx-dialog-root="true"]')?.contains(document.activeElement)).toBe(
        true,
      );
    });

    // Tab should not land on Outside
    for (let i = 0; i < 6; i += 1) {
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(outside).not.toHaveFocus();
      expect(
        dlg.closest('[data-cmx-dialog-root="true"]')?.contains(document.activeElement),
      ).toBe(true);
    }

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Backdrop click must not dismiss (default closeOnOverlayClick=false)
    onOpenChange.mockClear();
    fireEvent.click(document.querySelector('[data-cmx-dialog-backdrop="true"]')!);
    expect(onOpenChange).not.toHaveBeenCalled();

    outside.remove();
  });
});
