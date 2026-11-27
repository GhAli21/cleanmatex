/**
 * S6 (T46): the DST choice for a typed time that happens twice, and EN/AR clock error text
 * for API error codes.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
}));

import { CmxDstChoice, useClockErrorMessage } from '@ui/clock';

describe('CmxDstChoice', () => {
  it('offers the earlier and the later time with their offsets in an overlap', () => {
    const onChoose = jest.fn();
    render(<CmxDstChoice date="2026-11-01" time="01:30" zone="America/New_York" onChoose={onChoose} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('clock.disambiguation.earlier');
    expect(buttons[0]).toHaveTextContent('GMT-4');
    expect(buttons[1]).toHaveTextContent('GMT-5');
    fireEvent.click(buttons[1]);
    expect(onChoose).toHaveBeenCalledWith('later');
  });

  it('renders nothing for a normal time or a bad zone', () => {
    const { container } = render(
      <>
        <CmxDstChoice date="2026-11-02" time="01:30" zone="America/New_York" onChoose={jest.fn()} />
        <CmxDstChoice date="2026-11-01" time="01:30" zone="Not/AZone" onChoose={jest.fn()} />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

function Probe({ value }: { value: unknown }) {
  const message = useClockErrorMessage();
  return <p>{message(value as never) ?? 'none'}</p>;
}

describe('useClockErrorMessage', () => {
  it('maps API codes to clock.errors keys and ignores other or internal codes', () => {
    const { rerender } = render(<Probe value={{ success: false, code: 'ZONE_MISMATCH' }} />);
    expect(screen.getByText('clock.errors.zoneMismatch')).toBeInTheDocument();
    rerender(<Probe value="LOCAL_TIME_NONEXISTENT" />);
    expect(screen.getByText('clock.errors.localTimeNonexistent')).toBeInTheDocument();
    rerender(<Probe value={{ error: 'CLOCK_UNKNOWN_OPERATION' }} />);
    expect(screen.getByText('none')).toBeInTheDocument();
    rerender(<Probe value="Something else" />);
    expect(screen.getByText('none')).toBeInTheDocument();
  });
});
