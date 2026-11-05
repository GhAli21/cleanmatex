/**
 * CmxDialog names and describes its role="dialog" node from CmxDialogTitle / CmxDialogDescription (HFC A-44).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays/cmx-dialog';

expect.extend(toHaveNoViolations);

describe('CmxDialog accessible name', () => {
  it('is named by its title and described by its description', async () => {
    const { baseElement } = render(
      <CmxDialog open onOpenChange={jest.fn()}>
        <CmxDialogContent>
          <CmxDialogHeader>
            <CmxDialogTitle>Assign tag</CmxDialogTitle>
            <CmxDialogDescription>Scan the tag to attach it.</CmxDialogDescription>
          </CmxDialogHeader>
          <p>Body</p>
        </CmxDialogContent>
      </CmxDialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Assign tag' });
    expect(dialog).toHaveAccessibleDescription('Scan the tag to attach it.');
    expect(await axe(baseElement)).toHaveNoViolations();
  });

  it('keeps a caller-given title id', () => {
    render(
      <CmxDialog open onOpenChange={jest.fn()}>
        <CmxDialogContent>
          <CmxDialogTitle id="my-title">Mine</CmxDialogTitle>
        </CmxDialogContent>
      </CmxDialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'my-title');
    expect(screen.getByRole('heading', { name: 'Mine' })).toHaveAttribute('id', 'my-title');
  });

  it('uses aria-label when there is no title, and caller overrides win', () => {
    const { rerender } = render(
      <CmxDialog open onOpenChange={jest.fn()} aria-label="Quick scan">
        <CmxDialogContent>
          <p>No title</p>
        </CmxDialogContent>
      </CmxDialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Quick scan' })).not.toHaveAttribute('aria-describedby');

    rerender(
      <CmxDialog open onOpenChange={jest.fn()} aria-labelledby="outside" aria-describedby="outside-desc">
        <CmxDialogContent>
          <CmxDialogTitle>Inner</CmxDialogTitle>
        </CmxDialogContent>
      </CmxDialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'outside');
    expect(dialog).toHaveAttribute('aria-describedby', 'outside-desc');
  });

  it('drops the reference when the title unmounts', () => {
    const { rerender } = render(
      <CmxDialog open onOpenChange={jest.fn()}>
        <CmxDialogContent>
          <CmxDialogTitle>Step 1</CmxDialogTitle>
        </CmxDialogContent>
      </CmxDialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
    rerender(
      <CmxDialog open onOpenChange={jest.fn()}>
        <CmxDialogContent>
          <p>Step 2</p>
        </CmxDialogContent>
      </CmxDialog>,
    );
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
  });
});
