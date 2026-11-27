/**
 * S3 display components (MASTER_PLAN_v2 §7.7, T43): instants are painted in the zone the server
 * gave, whatever the process/device zone is (run by `npm run test:clock-tz` under several TZ).
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen } from '@testing-library/react';

let mockLocale = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
}));

import type { PublicClockBlock } from '@cmx/clock';
import {
  ClockProvider,
  CmxCivilDate,
  CmxInstant,
  CmxLocalTime,
  CmxZoneBadge,
  useInstantFormatter,
} from '@ui/clock';

const SIX_Z = '2026-11-27T06:00:00Z';

beforeEach(() => {
  mockLocale = 'en';
});

describe('CmxInstant', () => {
  it('shows 06:00Z as 10:00 for a Muscat scope, with a machine-readable Z instant', () => {
    const { container } = render(
      <ClockProvider zone="Asia/Muscat" hourCycle="h23">
        <CmxInstant value={SIX_Z} style="time" />
      </ClockProvider>,
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
    const time = container.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-11-27T06:00:00.000Z');
    expect(time?.getAttribute('title')).toContain('Asia/Muscat');
  });

  it('an explicit zone wins over the provider zone', () => {
    render(
      <ClockProvider zone="Asia/Muscat" hourCycle="h23">
        <CmxInstant value={SIX_Z} zone="Asia/Kolkata" style="time" />
      </ClockProvider>,
    );
    expect(screen.getByText('11:30')).toBeInTheDocument();
  });

  it('fails closed without a zone: no time, never the device zone', () => {
    const { container } = render(<CmxInstant value={SIX_Z} style="time" />);
    expect(container.querySelector('time')).toBeNull();
    expect(container).toHaveTextContent('—');
  });

  it('shows the fallback for a value without an offset', () => {
    const { container } = render(
      <ClockProvider zone="Asia/Muscat">
        <CmxInstant value="2026-11-27T06:00:00" fallback="n/a" />
      </ClockProvider>,
    );
    expect(container).toHaveTextContent('n/a');
  });

  it('Arabic text keeps Latin digits by default (D12) and the Gregorian calendar', () => {
    mockLocale = 'ar';
    const { container } = render(
      <ClockProvider zone="Asia/Riyadh">
        <CmxInstant value={SIX_Z} style="date" />
      </ClockProvider>,
    );
    expect(container.textContent).toMatch(/2026/);
    expect(container.textContent).not.toMatch(/[٠-٩]/);
  });

  it('takes zone and hour cycle from a clock block', () => {
    render(
      <ClockProvider block={{ zone: 'America/Los_Angeles', serverNow: SIX_Z, hourCycle: 'h23', dateFormat: 'YYYY-MM-DD' } as PublicClockBlock}>
        <CmxInstant value={SIX_Z} style="time" />
      </ClockProvider>,
    );
    expect(screen.getByText('22:00')).toBeInTheDocument();
  });
});

describe('civil values and the zone badge', () => {
  it('CmxCivilDate uses the tenant date format and never shifts the day', () => {
    const { container } = render(
      <ClockProvider block={{ zone: 'Pacific/Kiritimati', serverNow: SIX_Z, hourCycle: 'h23', dateFormat: 'DD/MM/YYYY' } as PublicClockBlock}>
        <CmxCivilDate value="2026-11-27" />
      </ClockProvider>,
    );
    expect(container).toHaveTextContent('27/11/2026');
  });

  it('CmxLocalTime follows the hour cycle', () => {
    render(
      <ClockProvider zone={null} hourCycle="h23">
        <CmxLocalTime value="18:30" />
      </ClockProvider>,
    );
    expect(screen.getByText('18:30')).toBeInTheDocument();
  });

  it('CmxZoneBadge names the zone and its offset at that instant', () => {
    render(<CmxZoneBadge at={SIX_Z} zone="Asia/Muscat" />);
    expect(screen.getByText(/clock\.zone\.timesShownIn .*Asia\/Muscat.*GMT\+4/)).toBeInTheDocument();
  });

  it('useInstantFormatter returns null without a zone and text with one', () => {
    function Probe() {
      const fmt = useInstantFormatter();
      return <span>{fmt(SIX_Z, 'time') ?? 'none'}</span>;
    }
    const { rerender } = render(<Probe />);
    expect(screen.getByText('none')).toBeInTheDocument();
    rerender(
      <ClockProvider zone="Asia/Muscat" hourCycle="h23">
        <Probe />
      </ClockProvider>,
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });
});
