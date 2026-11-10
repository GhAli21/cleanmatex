'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, CmxSwitch, Label } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardFooter, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback';
import type { BusinessHours, Weekday } from '@/lib/commercial/calendar';
import { branchCalendarSchema, organizationCalendarSchema } from '@/lib/validations/business-calendar-schemas';
import { BusinessCalendarApiError } from '../api/business-calendar-api';
import { draftToWeek, weekToDraft } from '../model/calendar-form-model';
import { CalendarWeekEditor } from './calendar-week-editor';

/** The three calendar fields an organization or a branch holds. */
export interface CalendarValues {
  businessHours: BusinessHours | null;
  cutoffTime: string | null;
  readyTime: string | null;
}

/** Props of the hours form. Mount it with a `key` per record, so it starts from that record. */
export interface CalendarHoursFormProps {
  initial: CalendarValues;
  /** Given for a branch: each field can follow these organization values. */
  organization?: CalendarValues;
  canSave: boolean;
  onSave: (values: CalendarValues) => Promise<void>;
  idPrefix: string;
}

/** One row of "follow the organization". */
function InheritSwitch({ id, checked, disabled, onChange, label }: { id: string; checked: boolean; disabled: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <CmxSwitch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-labelledby={`${id}-label`} />
      <Label id={`${id}-label`} htmlFor={id}>{label}</Label>
    </div>
  );
}

/**
 * Opening hours, cut-off and ready time, for the organization or one branch
 * (with `organization`, each field gets a "use the organization's" switch).
 * @param props - starting values, permission and save handler
 * @returns the form
 */
export function CalendarHoursForm({ initial, organization, canSave, onSave, idPrefix }: CalendarHoursFormProps) {
  const t = useTranslations('settings.calendar');
  const tCommon = useTranslations('common');
  const isBranch = !!organization;

  const [week, setWeek] = useState(() => weekToDraft(initial.businessHours ?? organization?.businessHours ?? null));
  const [cutoff, setCutoff] = useState(initial.cutoffTime ?? organization?.cutoffTime ?? '');
  const [ready, setReady] = useState(initial.readyTime ?? organization?.readyTime ?? '');
  const [inheritHours, setInheritHours] = useState(isBranch && initial.businessHours === null);
  const [inheritCutoff, setInheritCutoff] = useState(isBranch && initial.cutoffTime === null);
  const [inheritReady, setInheritReady] = useState(isBranch && initial.readyTime === null);
  const [dayErrors, setDayErrors] = useState<Partial<Record<Weekday, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<{ cutoffTime?: string; readyTime?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const values: CalendarValues = {
      businessHours: inheritHours ? null : draftToWeek(week),
      cutoffTime: inheritCutoff ? null : cutoff || null,
      readyTime: inheritReady ? null : ready || null,
    };
    const parsed = isBranch ? branchCalendarSchema.safeParse(values) : organizationCalendarSchema.safeParse(values);
    const days: Partial<Record<Weekday, string>> = {};
    const fields: { cutoffTime?: string; readyTime?: string } = {};
    let form: string | null = null;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [field, day] = issue.path;
        if (field === 'businessHours' && typeof day === 'string') days[day as Weekday] = t('validation.closeAfterOpen');
        else if (field === 'businessHours') form = t('validation.oneOpenDay');
        else if (field === 'cutoffTime' || field === 'readyTime') fields[field] = t('validation.time');
      }
    }
    setDayErrors(days);
    setFieldErrors(fields);
    setFormError(form);
    if (!parsed.success) return;

    setSaving(true);
    try {
      await onSave(values);
      cmxMessage.success(t('saved'));
    } catch (error) {
      const code = error instanceof BusinessCalendarApiError ? error.code : 'INTERNAL_ERROR';
      cmxMessage.error(t.has(`errors.${code}`) ? t(`errors.${code}` as never) : t('errors.INTERNAL_ERROR'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('hours.title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-6">
        {formError ? <CmxSummaryMessage type="error" title={t('errors.title')} items={[formError]} onDismiss={() => setFormError(null)} /> : null}

        {isBranch ? (
          <InheritSwitch id={`${idPrefix}-inherit-hours`} checked={inheritHours} disabled={!canSave} onChange={setInheritHours} label={t('branch.useOrganizationHours')} />
        ) : null}
        <CalendarWeekEditor
          idPrefix={idPrefix}
          value={inheritHours ? weekToDraft(organization?.businessHours ?? null) : week}
          onChange={setWeek}
          readOnly={!canSave || inheritHours}
          errors={dayErrors}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            {isBranch ? (
              <InheritSwitch id={`${idPrefix}-inherit-cutoff`} checked={inheritCutoff} disabled={!canSave} onChange={setInheritCutoff} label={t('branch.useOrganizationCutoff')} />
            ) : null}
            {inheritCutoff ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('cutoff.label')}: <span dir="ltr">{organization?.cutoffTime || t('cutoff.none')}</span></p>
            ) : (
              <CmxInput label={t('cutoff.label')} type="time" dir="ltr" value={cutoff} disabled={!canSave} onChange={(e) => setCutoff(e.target.value)} error={fieldErrors.cutoffTime} helpText={t('cutoff.help')} />
            )}
          </div>
          <div className="space-y-3">
            {isBranch ? (
              <InheritSwitch id={`${idPrefix}-inherit-ready`} checked={inheritReady} disabled={!canSave} onChange={setInheritReady} label={t('branch.useOrganizationReady')} />
            ) : null}
            {inheritReady ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('ready.label')}: <span dir="ltr">{organization?.readyTime || t('ready.none')}</span></p>
            ) : (
              <CmxInput label={t('ready.label')} type="time" dir="ltr" value={ready} disabled={!canSave} onChange={(e) => setReady(e.target.value)} error={fieldErrors.readyTime} helpText={t('ready.help')} />
            )}
          </div>
        </div>
      </CmxCardContent>
      {canSave ? (
        <CmxCardFooter className="justify-end">
          <CmxButton type="button" onClick={save} loading={saving}>{tCommon('save')}</CmxButton>
        </CmxCardFooter>
      ) : null}
    </CmxCard>
  );
}
