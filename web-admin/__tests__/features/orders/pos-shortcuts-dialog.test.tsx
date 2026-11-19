/**
 * PR-04 Task 2: the shortcuts cheat sheet lists every hotkey with its translated label;
 * key names stay left-to-right; Escape closes it.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { PosShortcutsDialog } from '@features/orders/ui/pos-shortcuts-dialog';
import { POS_HOTKEYS } from '@features/orders/hooks/use-pos-hotkeys';

describe('PosShortcutsDialog', () => {
  it('lists every hotkey row with its label and LTR key names', () => {
    render(<PosShortcutsDialog open onOpenChange={jest.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'newOrder.shortcuts.title' });
    for (const row of POS_HOTKEYS) {
      expect(within(dialog).getByText(`newOrder.shortcuts.${row.labelKey}`)).toBeInTheDocument();
    }
    const kbds = dialog.querySelectorAll('kbd');
    expect(kbds.length).toBe(POS_HOTKEYS.length);
    kbds.forEach((el) => expect(el).toHaveAttribute('dir', 'ltr'));
  });

  it('Escape closes it', () => {
    const onOpenChange = jest.fn();
    render(<PosShortcutsDialog open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
