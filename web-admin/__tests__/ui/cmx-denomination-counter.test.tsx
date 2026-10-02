import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { CmxDenominationCounter, type CmxDenominationOption } from '@/src/ui/patterns/cmx-denomination-counter';

const CENTS: CmxDenominationOption[] = [
  { id: 'c1', label: '0.01', valueMinor: 1 },
  { id: 'c25', label: '0.25', valueMinor: 25 },
  { id: 'd1', label: '1.00', valueMinor: 100 },
  { id: 'd5', label: '5.00', valueMinor: 500 },
];

const BAISA: CmxDenominationOption[] = [
  { id: 'b5', label: '0.005', valueMinor: 5 },
  { id: 'b100', label: '0.100', valueMinor: 100 },
  { id: 'r1', label: '1.000', valueMinor: 1000 },
];

function Harness({
  denominations,
  minorUnit,
  initial = {},
  onTotal,
  disabled,
}: {
  denominations: CmxDenominationOption[];
  minorUnit: number;
  initial?: Record<string, number>;
  onTotal?: (n: number) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = React.useState<Record<string, number>>(initial);
  return (
    <CmxDenominationCounter
      denominations={denominations}
      value={value}
      onChange={setValue}
      onTotalChange={onTotal}
      minorUnit={minorUnit}
      formatTotal={(n) => n.toFixed(minorUnit)}
      quantityLabel="Quantity"
      totalLabel="Counted total"
      disabled={disabled}
    />
  );
}

const total = () => screen.getByText('Counted total').nextElementSibling as HTMLElement;
const type = (label: string, raw: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: raw } });

describe('CmxDenominationCounter', () => {
  it('renders nothing when the currency has no denomination catalog (caller falls back to a total-only field)', () => {
    const { container } = render(<Harness denominations={[]} minorUnit={2} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sums a 2-decimal currency exactly in minor units (no float drift)', () => {
    render(<Harness denominations={CENTS} minorUnit={2} />);
    type('0.01', '3');
    type('0.25', '2');
    type('1.00', '4');
    type('5.00', '1');
    // 3×1 + 2×25 + 4×100 + 1×500 = 953 minor units
    expect(total()).toHaveTextContent('9.53');
  });

  it('sums a 3-decimal currency exactly (baisa)', () => {
    render(<Harness denominations={BAISA} minorUnit={3} />);
    type('0.005', '29');
    type('0.100', '7');
    type('1.000', '2');
    // 29×5 + 7×100 + 2×1000 = 2845 minor units
    expect(total()).toHaveTextContent('2.845');
  });

  it('reports the running total through onTotalChange, starting at zero', () => {
    const seen: number[] = [];
    render(<Harness denominations={CENTS} minorUnit={2} onTotal={(n) => seen.push(n)} />);
    expect(seen[0]).toBe(0);
    type('1.00', '2');
    expect(seen[seen.length - 1]).toBe(2);
  });

  it('treats a cleared field as zero and floors a fractional entry to whole notes/coins', () => {
    render(<Harness denominations={CENTS} minorUnit={2} initial={{ d1: 3 }} />);
    expect(total()).toHaveTextContent('3.00');
    type('1.00', '');
    expect(total()).toHaveTextContent('0.00');
    type('1.00', '2.9');
    expect(total()).toHaveTextContent('2.00');
  });

  it('refuses a negative quantity and keeps the previous value', () => {
    render(<Harness denominations={CENTS} minorUnit={2} initial={{ d5: 2 }} />);
    type('5.00', '-4');
    expect(total()).toHaveTextContent('10.00');
    expect((screen.getByLabelText('5.00') as HTMLInputElement).value).toBe('2');
  });

  it('locks every field when disabled', () => {
    render(<Harness denominations={CENTS} minorUnit={2} disabled />);
    for (const d of CENTS) {
      expect(screen.getByLabelText(d.label)).toBeDisabled();
    }
  });

  it('is fully keyboard-operable: every denomination is a focusable numeric input in reading order', () => {
    render(<Harness denominations={CENTS} minorUnit={2} />);
    const inputs = CENTS.map((d) => screen.getByLabelText(d.label) as HTMLInputElement);
    for (const input of inputs) {
      expect(input.type).toBe('number');
      expect(input.tabIndex).toBeGreaterThanOrEqual(0);
    }
    inputs[0].focus();
    expect(document.activeElement).toBe(inputs[0]);
  });
});
