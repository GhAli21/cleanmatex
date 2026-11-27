'use client';

/**
 * Viewer-zone toggle (D20): "Show times in: Branch zone / My device zone".
 * Display only. Filters, day buckets and grouping stay in the operations zone,
 * and civil dates and local times are never converted. State lives in the URL
 * (`tz=branch|device`) and is remembered per screen.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useDeviceZone } from './use-device-zone';

export type ViewZoneMode = 'branch' | 'device';

export interface ViewZoneValue {
  mode: ViewZoneMode;
  deviceZone: string | null;
  setMode: (mode: ViewZoneMode) => void;
  /** The zone to paint an instant in: the device zone in device mode, else the given operations zone. */
  displayZone: (operationsZone: string | null | undefined) => string | null;
}

const STORAGE_PREFIX = 'cmx.viewZone.';
const ViewZoneContext = createContext<ViewZoneValue | null>(null);

const parseMode = (v: string | null | undefined): ViewZoneMode | null =>
  v === 'device' || v === 'branch' ? v : null;

export interface ViewZoneProviderProps {
  /** Key for the remembered choice, e.g. `orders-list`. */
  screenKey: string;
  children: ReactNode;
}

/** Holds the viewer-zone choice for one screen. */
export function ViewZoneProvider({ screenKey, children }: ViewZoneProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const deviceZone = useDeviceZone();
  const urlMode = parseMode(params?.get('tz'));
  const mode: ViewZoneMode = urlMode ?? 'branch';

  const setMode = useCallback(
    (next: ViewZoneMode) => {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + screenKey, next);
      } catch {
        /* storage blocked: the URL still carries the choice */
      }
      const sp = new URLSearchParams(params?.toString() ?? '');
      if (next === 'branch') sp.delete('tz');
      else sp.set('tz', next);
      const q = sp.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router, screenKey],
  );

  // Restore a remembered device choice once, when the URL does not say.
  useEffect(() => {
    if (urlMode) return;
    try {
      if (parseMode(window.localStorage.getItem(STORAGE_PREFIX + screenKey)) === 'device') setMode('device');
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenKey]);

  const value = useMemo<ViewZoneValue>(
    () => ({
      mode,
      deviceZone,
      setMode,
      displayZone: (operationsZone) =>
        mode === 'device' && deviceZone ? deviceZone : (operationsZone ?? null),
    }),
    [mode, deviceZone, setMode],
  );
  return <ViewZoneContext.Provider value={value}>{children}</ViewZoneContext.Provider>;
}

const BRANCH_ONLY: ViewZoneValue = {
  mode: 'branch',
  deviceZone: null,
  setMode: () => {},
  displayZone: (z) => z ?? null,
};

/** The viewer-zone choice; outside a provider it is always the branch zone. */
export function useViewZone(): ViewZoneValue {
  return useContext(ViewZoneContext) ?? BRANCH_ONLY;
}

export interface CmxViewZoneToggleProps {
  className?: string;
}

/** Two-choice control. Hidden until the device zone is known; disabled choice states are announced. */
export function CmxViewZoneToggle({ className }: CmxViewZoneToggleProps) {
  const t = useTranslations('clock.viewZone');
  const { mode, setMode, deviceZone } = useViewZone();
  if (!deviceZone) return null;
  const option = (value: ViewZoneMode, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={
        'px-2 py-1 text-xs rounded-md border ' +
        (mode === value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-foreground border-border hover:bg-muted')
      }
    >
      {label}
    </button>
  );
  return (
    <div className={className ?? 'inline-flex items-center gap-2'}>
      <span className="text-xs text-muted-foreground" id="cmx-view-zone-label">
        {t('label')}
      </span>
      <div role="radiogroup" aria-labelledby="cmx-view-zone-label" className="inline-flex gap-1">
        {option('branch', t('branch'))}
        {option('device', t('device', { zone: deviceZone }))}
      </div>
    </div>
  );
}
