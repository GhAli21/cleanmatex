'use client';

import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSwitch, Label } from '@ui/primitives';
import { WEEKDAYS, type Weekday } from '@/lib/commercial/calendar';
import { copyHoursToOpenDays, type WeekDraft } from '../model/calendar-form-model';

/** Day key → its `settings.<name>` label. */
const DAY_LABEL_KEY = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday',
} as const;

/** Props of the weekly hours editor. */
export interface CalendarWeekEditorProps {
  value: WeekDraft;
  onChange: (next: WeekDraft) => void;
  /** Shown but not editable (no permission, or the branch follows the organization). */
  readOnly?: boolean;
  /** Message per day that failed validation. */
  errors?: Partial<Record<Weekday, string>>;
  /** Keeps the switch ids unique when two editors share a page. */
  idPrefix: string;
}

/**
 * The week's opening hours, one row per day. Times stay left-to-right in Arabic.
 * @param props - the week, change handler, errors
 * @returns the rows
 */
export function CalendarWeekEditor({ value, onChange, readOnly = false, errors, idPrefix }: CalendarWeekEditorProps) {
  const t = useTranslations('settings.calendar');
  const tSettings = useTranslations('settings');
  const setDay = (day: Weekday, patch: Partial<WeekDraft[Weekday]>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });

  return (
    <div className="space-y-3">
      {WEEKDAYS.map((day) => {
        const row = value[day];
        const switchId = `${idPrefix}-${day}-open`;
        return (
          <div key={day} className="grid items-start gap-3 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-3 sm:grid-cols-[9rem_1fr_1fr_auto]">
            <div className="flex items-center gap-3 sm:pt-7">
              <CmxSwitch id={switchId} checked={row.isOpen} disabled={readOnly} onCheckedChange={(isOpen) => setDay(day, { isOpen })} aria-labelledby={`${switchId}-label`} />
              <Label id={`${switchId}-label`} htmlFor={switchId}>{tSettings(DAY_LABEL_KEY[day])}</Label>
            </div>
            {row.isOpen ? (
              <>
                <CmxInput label={tSettings('opens')} aria-label={`${tSettings(DAY_LABEL_KEY[day])} ${tSettings('opens')}`} type="time" dir="ltr" value={row.open} disabled={readOnly} onChange={(e) => setDay(day, { open: e.target.value })} />
                <CmxInput label={tSettings('closes')} aria-label={`${tSettings(DAY_LABEL_KEY[day])} ${tSettings('closes')}`} type="time" dir="ltr" value={row.close} disabled={readOnly} onChange={(e) => setDay(day, { close: e.target.value })} error={errors?.[day]} />
                {readOnly ? <span /> : (
                  <div className="sm:pt-6">
                    <CmxButton type="button" size="sm" variant="ghost" onClick={() => onChange(copyHoursToOpenDays(value, day))}>{t('copyToOpenDays')}</CmxButton>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] sm:col-span-3 sm:pt-7">{tSettings('closed')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
