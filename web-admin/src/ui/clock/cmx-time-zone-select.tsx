'use client';

/**
 * G2: one time-zone picker for Settings → General and public registration.
 * Options come from the active `sys_timezone_cd` catalog (canonical IANA names, D28/D32);
 * the offset in each label is computed live for today (G14), never read from the static column.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { zoneOffsetLabel } from '@cmx/clock';
// Direct files: the primitives barrel pulls server actions into client-only consumers.
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxSelect } from '@ui/primitives/cmx-select';

export interface TimeZoneOptionRow {
  code: string;
  name?: string | null;
  name2?: string | null;
  region?: string | null;
}

export interface CmxTimeZoneSelectProps {
  value: string;
  onChange: (zone: string) => void;
  /** `auth` → `/api/v1/lookups/timezones`; `public` → `/api/v1/public/timezones` (registration). */
  source?: 'auth' | 'public';
  required?: boolean;
  id?: string;
  /** Test seam / server-provided list; skips the fetch. */
  rows?: TimeZoneOptionRow[];
}

const ENDPOINT = { auth: '/api/v1/lookups/timezones', public: '/api/v1/public/timezones' } as const;

function labelOf(code: string, locale: string, at: Date): string {
  try {
    return `${code} (${zoneOffsetLabel(code, at, locale)})`;
  } catch {
    return code;
  }
}

/** Searchable catalog picker. The current value is always listed, even before the list loads. */
export function CmxTimeZoneSelect({ value, onChange, source = 'auth', required, id, rows: given }: CmxTimeZoneSelectProps) {
  const t = useTranslations('clock.zonePicker');
  const locale = useLocale();
  const [rows, setRows] = useState<TimeZoneOptionRow[] | null>(given ?? null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (given) return;
    let alive = true;
    fetch(ENDPOINT[source], { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j: { success?: boolean; data?: TimeZoneOptionRow[] }) => {
        if (!alive) return;
        if (j?.success && Array.isArray(j.data)) setRows(j.data);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [given, source]);

  const options = useMemo(() => {
    const at = new Date();
    const q = query.trim().toLowerCase();
    const list = (rows ?? [])
      .filter((r) => !q || r.code.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q) || (r.name2 ?? '').includes(query.trim()))
      .map((r) => ({ value: r.code, label: labelOf(r.code, locale, at) }));
    if (value && !list.some((o) => o.value === value)) list.unshift({ value, label: labelOf(value, locale, at) });
    return list;
  }, [rows, query, value, locale]);

  return (
    <div className="space-y-1">
      <CmxInput
        type="search"
        dir="ltr"
        value={query}
        placeholder={t('search')}
        aria-label={t('search')}
        onChange={(e) => setQuery(e.target.value)}
      />
      <CmxSelect id={id} dir="ltr" value={value} required={required} onChange={(e) => onChange(e.target.value)} options={options} />
      {rows === null && !failed ? <p className="text-xs text-muted-foreground">{t('loading')}</p> : null}
      {failed ? <p className="text-xs text-danger-text" role="alert">{t('loadFailed')}</p> : null}
    </div>
  );
}
