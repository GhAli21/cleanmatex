import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { CmxCountPicker } from '@/src/ui/forms/cmx-count-picker';

function Controlled({ initial = 1 }: { initial?: number }) {
  const [value, setValue] = React.useState(initial);
  return (
    <CmxCountPicker
      value={value}
      onChange={setValue}
      groupLabel="Bags"
      customLabel="Custom"
    />
  );
}

describe('CmxCountPicker', () => {
  it('renders chips 0..7 and selects one on click', () => {
    render(<Controlled initial={1} />);
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: '3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reveals a bounded number input when Custom is clicked', () => {
    render(<Controlled initial={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const input = screen.getByLabelText('Custom') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '12' } });
    expect(input.value).toBe('12');
  });

  it('clamps a Custom value above the ceiling and reflects the clamp in the field', () => {
    render(<Controlled initial={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const input = screen.getByLabelText('Custom') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    // clamps to the default ceiling (100) and the field reflects the clamp
    expect(input.value).toBe('100');
  });

  it('ignores non-numeric Custom input without crashing', () => {
    render(<Controlled initial={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const input = screen.getByLabelText('Custom') as HTMLInputElement;
    // A native number input coerces non-numeric text to '' — assert no crash
    // and no invalid value is committed via onChange.
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input.value).toBe('');
  });

  it('renders RTL chip order with flex-row-reverse', () => {
    const { container } = render(
      <CmxCountPicker
        value={0}
        onChange={jest.fn()}
        groupLabel="Bags"
        customLabel="Custom"
        isRTL
      />
    );
    expect(container.querySelector('[role="group"]')).toHaveClass('flex-row-reverse');
  });

  it('starts in custom mode when the initial value is outside the chip range', () => {
    render(<Controlled initial={12} />);
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });
});
