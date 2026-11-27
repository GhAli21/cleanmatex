/**
 * S4 (MASTER_PLAN_v2 §7.7): nested providers, civil today from the screen zone, stored-value
 * formatting, the viewer-zone toggle (D20), the missing-zone notice (G8), and the zone picker (G2).
 * Run under several process zones by `npm run test:clock-tz`.
 */
import '@testing-library/jest-dom';
import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ClockBlock } from '@cmx/clock';

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => (key: string, values?: Record<string, string>) =>
    `${ns}.${key}${values ? ` ${JSON.stringify(values)}` : ''}`,
}));

const mockReplace = jest.fn();
let mockSearch = '';
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/dashboard/orders',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

import {
  ClockProvider,
  CmxInstant,
  CmxTimeZoneSelect,
  CmxViewZoneToggle,
  CmxZoneNotice,
  ViewZoneProvider,
  formatDateValueText,
  useClockCivilToday,
  useViewZone,
} from '@ui/clock';

const SIX_Z = '2026-11-27T06:00:00Z';
const ORG: ClockBlock = {
  zone: 'Asia/Muscat',
  businessDate: '2026-11-27',
  serverNow: SIX_Z,
  hourCycle: 'h23',
  weekStart: 6,
  tzdbVersion: null,
  dateFormat: 'DD/MM/YYYY',
} as ClockBlock;

beforeEach(() => {
  mockReplace.mockClear();
  mockSearch = '';
  window.localStorage.clear();
});

describe('nested ClockProvider', () => {
  it('a branch zone inherits the organization hour cycle and date format', () => {
    render(
      <ClockProvider block={ORG}>
        <ClockProvider zone="America/Los_Angeles">
          <CmxInstant value={SIX_Z} style="time" />
        </ClockProvider>
      </ClockProvider>,
    );
    expect(screen.getByText('22:00')).toBeInTheDocument();
  });
});

describe('useClockCivilToday (G12)', () => {
  function Probe() {
    return <span>{useClockCivilToday() || 'none'}</span>;
  }
  it('is the screen-zone day, empty without a zone', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T21:00:00Z'));
    try {
      const { rerender } = render(<Probe />);
      expect(screen.getByText('none')).toBeInTheDocument();
      rerender(
        <ClockProvider zone="Asia/Muscat">
          <Probe />
        </ClockProvider>,
      );
      // 21:00Z on 26 Nov is 01:00 on 27 Nov in Muscat.
      expect(screen.getByText('2026-11-27')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('formatDateValueText', () => {
  const clock = { locale: 'en', numberingSystem: 'latn' as const, dateFormat: 'DD/MM/YYYY' as const };
  it('shows a civil date as stored and an instant in the zone', () => {
    expect(formatDateValueText('2026-11-27', null, clock)).toBe('27/11/2026');
    expect(formatDateValueText(SIX_Z, 'Asia/Muscat', { ...clock, hourCycle: 'h23' }, 'time')).toBe('10:00');
    expect(formatDateValueText(SIX_Z, null, clock)).toBeNull();
  });
});

describe('viewer-zone toggle (D20)', () => {
  function Cell() {
    const vz = useViewZone();
    return <CmxInstant value={SIX_Z} zone={vz.displayZone('Asia/Muscat')} style="time" />;
  }
  it('defaults to the branch zone and switches only the display', async () => {
    render(
      <ClockProvider block={ORG}>
        <ViewZoneProvider screenKey="orders-list">
          <CmxViewZoneToggle />
          <Cell />
        </ViewZoneProvider>
      </ClockProvider>,
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
    await act(async () => {});
    fireEvent.click(screen.getByRole('radio', { name: /clock\.viewZone\.device/ }));
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/orders?tz=device', { scroll: false });
    expect(window.localStorage.getItem('cmx.viewZone.orders-list')).toBe('device');
  });

  it('device mode paints in the device zone', async () => {
    mockSearch = 'tz=device';
    const spy = jest
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockReturnValue({ timeZone: 'Asia/Kolkata' } as Intl.ResolvedDateTimeFormatOptions);
    render(
      <ClockProvider block={ORG}>
        <ViewZoneProvider screenKey="orders-list">
          <Cell />
        </ViewZoneProvider>
      </ClockProvider>,
    );
    await act(async () => {});
    expect(screen.getByText('11:30')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('outside a provider it is always the branch zone', () => {
    render(
      <ClockProvider block={ORG}>
        <Cell />
      </ClockProvider>,
    );
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });
});

describe('CmxZoneNotice (G8)', () => {
  it('shows only when the organization has no zone', () => {
    const { rerender } = render(<CmxZoneNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('clock.zone.notConfigured');
    rerender(
      <ClockProvider block={ORG}>
        <CmxZoneNotice />
      </ClockProvider>,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('CmxTimeZoneSelect (G2)', () => {
  it('lists catalog zones with a live offset, filters, and keeps the current value', () => {
    const onChange = jest.fn();
    render(
      <CmxTimeZoneSelect
        value="UTC"
        onChange={onChange}
        rows={[{ code: 'America/New_York' }, { code: 'Asia/Muscat' }, { code: 'UTC' }]}
      />,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['America/New_York', 'Asia/Muscat', 'UTC']);
    expect(Array.from(select.options).find((o) => o.value === 'Asia/Muscat')?.textContent).toBe('Asia/Muscat (GMT+4)');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'york' } });
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['UTC', 'America/New_York']);
    fireEvent.change(select, { target: { value: 'America/New_York' } });
    expect(onChange).toHaveBeenCalledWith('America/New_York');
  });
});
