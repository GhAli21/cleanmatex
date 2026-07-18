import '@testing-library/jest-dom';
import * as React from 'react';
import { act, createEvent, render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('@/lib/context/tenant-currency-context', () => ({
  useTenantCurrency: () => ({ decimalPlaces: 3 }),
}));

import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';

function dispatchWindowPointer(
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  init: { clientX: number; clientY: number; pointerId: number },
) {
  const event = new Event(type, { bubbles: true }) as Event & {
    clientX: number;
    clientY: number;
    pointerId: number;
  };
  Object.defineProperty(event, 'clientX', { value: init.clientX });
  Object.defineProperty(event, 'clientY', { value: init.clientY });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  window.dispatchEvent(event);
}

describe('CmxDialog movable', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });

  it('translates content when the header is dragged', async () => {
    render(
      <CmxDialog open onOpenChange={() => undefined}>
        <CmxDialogContent data-testid="dlg">
          <CmxDialogHeader>
            <CmxDialogTitle>Title</CmxDialogTitle>
          </CmxDialogHeader>
          <p>Body</p>
        </CmxDialogContent>
      </CmxDialog>,
    );

    const dlg = await screen.findByTestId('dlg');
    expect(dlg).toHaveAttribute('data-cmx-dialog-draggable', 'true');

    jest.spyOn(dlg, 'getBoundingClientRect').mockReturnValue({
      x: 200,
      y: 150,
      left: 200,
      top: 150,
      right: 600,
      bottom: 450,
      width: 400,
      height: 300,
      toJSON: () => ({}),
    });

    const header = screen.getByText('Title').closest('[data-cmx-dialog-header]');
    expect(header).toBeTruthy();

    await act(async () => {
      const down = createEvent.pointerDown(header!, {
        button: 0,
        buttons: 1,
        pointerId: 1,
      });
      Object.defineProperty(down, 'clientX', { value: 220 });
      Object.defineProperty(down, 'clientY', { value: 160 });
      fireEvent(header!, down);
      dispatchWindowPointer('pointermove', {
        clientX: 300,
        clientY: 240,
        pointerId: 1,
      });
    });

    await waitFor(() => {
      expect(dlg.style.transform).toContain('translate(80px, 80px)');
    });

    await act(async () => {
      dispatchWindowPointer('pointerup', {
        clientX: 300,
        clientY: 240,
        pointerId: 1,
      });
    });

    await waitFor(() => {
      expect(dlg).not.toHaveAttribute('data-cmx-dialog-dragging');
    });
    expect(dlg.style.transform).toContain('translate(80px, 80px)');
  });

  it('does not drag when draggable={false}', async () => {
    render(
      <CmxDialog open onOpenChange={() => undefined}>
        <CmxDialogContent data-testid="dlg" draggable={false}>
          <CmxDialogHeader>
            <CmxDialogTitle>Locked</CmxDialogTitle>
          </CmxDialogHeader>
        </CmxDialogContent>
      </CmxDialog>,
    );

    const dlg = await screen.findByTestId('dlg');
    expect(dlg).toHaveAttribute('data-cmx-dialog-draggable', 'false');

    const header = screen.getByText('Locked').closest('[data-cmx-dialog-header]')!;
    await act(async () => {
      fireEvent.pointerDown(header, {
        button: 0,
        buttons: 1,
        clientX: 10,
        clientY: 10,
        pointerId: 1,
      });
      dispatchWindowPointer('pointermove', {
        clientX: 110,
        clientY: 110,
        pointerId: 1,
      });
    });

    expect(dlg.style.transform || '').not.toContain('translate');
  });
});
