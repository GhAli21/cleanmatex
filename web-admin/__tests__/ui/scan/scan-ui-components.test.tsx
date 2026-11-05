/**
 * HFC P3b T3.7/T3.8: CmxScanInput, CmxCodeChip, CmxCodeSearchInput (behaviour, RTL-safe codes, axe A-25).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

const showSuccess = jest.fn();
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@ui/feedback', () => ({ useMessage: () => ({ showSuccess, showError: jest.fn() }) }));

import { CmxScanInput } from '@/src/ui/forms/cmx-scan-input';
import { CmxCodeSearchInput, toCodeSearch } from '@/src/ui/forms/cmx-code-search-input';
import { CmxCodeChip } from '@/src/ui/data-display/cmx-code-chip';

expect.extend(toHaveNoViolations);

describe('CmxScanInput', () => {
  it('normalises, clears and keeps focus after Enter', async () => {
    const onScan = jest.fn();
    render(<CmxScanInput label="Scan" onScan={onScan} submitLabel="Go" />);
    const input = screen.getByLabelText('Scan') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: ' ORD-٢٠٢٦١٠٣١-٠٠٠١\r' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledWith('ORD-20261031-0001');
    await waitFor(() => expect(input.value).toBe(''));
    expect(document.activeElement).toBe(input);
  });
  it('reports a double scan once, and shows the empty message', () => {
    const onScan = jest.fn();
    render(<CmxScanInput label="Scan" onScan={onScan} emptyMessage="Enter a code" />);
    const input = screen.getByLabelText('Scan');
    for (let i = 0; i < 2; i += 1) {
      fireEvent.change(input, { target: { value: 'TAG-1' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }
    expect(onScan).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('Enter a code');
  });
  it('ignores scans while a slow onScan is running', async () => {
    let resolve: () => void = () => undefined;
    const onScan = jest.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<CmxScanInput label="Scan" onScan={onScan} dedupeMs={0} />);
    const input = screen.getByLabelText('Scan');
    fireEvent.change(input, { target: { value: 'A1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'A2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onScan).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
  it('reads the status politely, LTR field, no axe violations', async () => {
    const { container } = render(
      <div dir="rtl">
        <CmxScanInput label="امسح" onScan={jest.fn()} submitLabel="مسح" status={{ tone: 'success', message: 'تم' }} />
      </div>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('امسح')).toHaveAttribute('dir', 'ltr');
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('CmxCodeChip', () => {
  beforeEach(() => {
    showSuccess.mockReset();
    Object.assign(navigator, { clipboard: { writeText: jest.fn(async () => undefined) } });
  });
  it('shows the code left to right and copies it', async () => {
    const { container } = render(
      <div dir="rtl">
        <CmxCodeChip code="ORD-20261031-0001" label="رقم الطلب" />
      </div>,
    );
    const bdi = container.querySelector('bdi');
    expect(bdi).toHaveAttribute('dir', 'ltr');
    expect(bdi).toHaveTextContent('ORD-20261031-0001');
    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ORD-20261031-0001');
    expect(showSuccess).toHaveBeenCalledWith('copied');
    expect(await axe(container)).toHaveNoViolations();
  });
  it('renders nothing for an empty code, and a plain span when not copyable', () => {
    const { container, rerender } = render(<CmxCodeChip code="  " />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CmxCodeChip code="TAG-1" kind="tag" copyable={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('[data-code-kind="tag"]')).toHaveTextContent('TAG-1');
  });
});

describe('CmxCodeSearchInput', () => {
  it('toCodeSearch sends codes as exact and the rest as text', () => {
    expect(toCodeSearch(' ord-20261031-0001 ')).toEqual({ mode: 'code', kind: 'ORDER', code: 'ORD-20261031-0001' });
    expect(toCodeSearch('ORD-20261031-0001-2-3')).toEqual({ mode: 'code', kind: 'PIECE', code: 'ORD-20261031-0001-2-3' });
    expect(toCodeSearch('Ahmed')).toEqual({ mode: 'text', text: 'Ahmed' });
    expect(toCodeSearch('٩٦٨٩٠')).toEqual({ mode: 'text', text: '96890' });
  });
  it('submits on Enter, no axe violations', async () => {
    const onSubmit = jest.fn();
    function Harness() {
      const [v, setV] = React.useState('');
      return <CmxCodeSearchInput aria-label="Search orders" value={v} onChange={setV} onSubmit={onSubmit} />;
    }
    const { container } = render(<Harness />);
    const input = screen.getByLabelText('Search orders');
    fireEvent.change(input, { target: { value: 'ORD-20261031-0007' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith({ mode: 'code', kind: 'ORDER', code: 'ORD-20261031-0007' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
