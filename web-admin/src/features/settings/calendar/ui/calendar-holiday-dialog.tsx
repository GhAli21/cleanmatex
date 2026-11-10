'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSelect, CmxSwitch, Label } from '@ui/primitives';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { holidaySchema } from '@/lib/validations/business-calendar-schemas';
import { BusinessCalendarApiError, createHolidayApi, updateHolidayApi } from '../api/business-calendar-api';

/** What the dialog starts from: a saved holiday (`id`), or a new row, possibly pre-filled from a public holiday. */
export interface HolidayDraft {
  id?: string;
  branchId: string | null;
  holidayDate: string;
  name: string;
  name2: string;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

/** Props of the holiday dialog. Mount it with a `key`, so it starts from `draft`. */
export interface CalendarHolidayDialogProps {
  draft: HolidayDraft;
  branchOptions: { value: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Add or edit a holiday: closed all day, or open with its own hours (a short day).
 * @param props - starting values, branches and callbacks
 * @returns the dialog
 */
export function CalendarHolidayDialog({ draft, branchOptions, onClose, onSaved }: CalendarHolidayDialogProps) {
  const t = useTranslations('settings.calendar');
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { token: csrfToken } = useCSRFToken();
  const [form, setForm] = useState(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<HolidayDraft>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    const parsed = holidaySchema.safeParse({
      branchId: form.branchId,
      holidayDate: form.holidayDate,
      name: form.name,
      name2: form.name2.trim() || null,
      isClosed: form.isClosed,
      openTime: form.isClosed ? null : form.openTime || null,
      closeTime: form.isClosed ? null : form.closeTime || null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'form');
        next[field] = t.has(`validation.${field}`) ? t(`validation.${field}` as never) : t('validation.closeAfterOpen');
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      if (form.id) await updateHolidayApi(form.id, parsed.data, csrfToken);
      else await createHolidayApi(parsed.data, csrfToken);
      cmxMessage.success(t('holidays.saved'));
      onSaved();
    } catch (error) {
      const code = error instanceof BusinessCalendarApiError ? error.code : 'INTERNAL_ERROR';
      setFormError(t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.INTERNAL_ERROR'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <CmxDialogContent scrollBody className="w-[calc(100vw-2rem)] max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{form.id ? t('holidays.edit') : t('holidays.add')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          {formError ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[formError]} onDismiss={() => setFormError(null)} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <CmxInput label={t('holidays.date')} type="date" value={form.holidayDate} onChange={(e) => set({ holidayDate: e.target.value })} error={errors.holidayDate} />
            <CmxSelect
              label={t('holidays.appliesTo')}
              options={[{ value: '', label: t('holidays.allBranches') }, ...branchOptions]}
              value={form.branchId ?? ''}
              onChange={(e) => set({ branchId: e.target.value || null })}
            />
            <CmxInput label={t('holidays.name')} value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
            <CmxInput label={t('holidays.name2')} dir="rtl" value={form.name2} onChange={(e) => set({ name2: e.target.value })} error={errors.name2} />
          </div>
          <div className="flex items-center gap-3">
            <CmxSwitch id="holiday-closed" checked={form.isClosed} onCheckedChange={(isClosed) => set({ isClosed })} aria-labelledby="holiday-closed-label" />
            <Label id="holiday-closed-label" htmlFor="holiday-closed">{t('holidays.closedAllDay')}</Label>
          </div>
          {form.isClosed ? null : (
            <div className="grid gap-4 sm:grid-cols-2">
              <CmxInput label={tSettings('opens')} type="time" dir="ltr" value={form.openTime} onChange={(e) => set({ openTime: e.target.value })} error={errors.openTime} />
              <CmxInput label={tSettings('closes')} type="time" dir="ltr" value={form.closeTime} onChange={(e) => set({ closeTime: e.target.value })} error={errors.closeTime} />
            </div>
          )}
        </div>
        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onClose} disabled={saving}>{tCommon('cancel')}</CmxButton>
          <CmxButton type="button" onClick={save} loading={saving}>{tCommon('save')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
