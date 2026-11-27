/**
 * Ready Date Picker Modal Component
 * Modal for selecting ready-by date and time
 * Re-Design: PRD-010 Advanced Orders - Section 5B
 */

'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { civilDateFromPickerDate, civilDateInZone, formatCivilDate, instantFromCivilDateTime } from '@/lib/utils/operational-time';

interface ReadyDatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (date: Date, time: string) => void;
  initialDate?: Date;
  initialTime?: string;
  /** When true (retail orders), allow "now" as valid instead of requiring strict future */
  allowNow?: boolean;
  /** Fulfilment branch zone, otherwise the organization zone. */
  opsZone?: string | null;
  /** True while the zone is still being read. */
  zonePending?: boolean;
}

/**
 *
 * @param props
 */
export function ReadyDatePickerModal(props: ReadyDatePickerModalProps) {
  const { open, ...rest } = props;
  if (!open) return null;
  return <ReadyDatePickerModalOpen {...rest} />;
}

type ReadyDatePickerModalOpenProps = Omit<ReadyDatePickerModalProps, 'open'>;

/**
 * Picker cells are local wall-calendar containers (year, month, day), never instants;
 * the instant is always built with `instantFromCivilDateTime(…, opsZone)`.
 */
// clock-ok: wall-calendar container fields of a picker cell, not an instant (S4 review)
const cal = (d: Date) => ({ y: d.getFullYear(), m: d.getMonth(), day: d.getDate(), wd: d.getDay() });

function calendarDate(initialDate: Date | undefined, opsZone: string | null): Date {
  if (initialDate) return initialDate;
  if (!opsZone) return new Date();
  const civil = civilDateInZone(new Date(), opsZone);
  const [year, month, day] = civil.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function ReadyDatePickerModalOpen({
  onClose,
  onApply,
  initialDate,
  initialTime,
  allowNow = false,
  opsZone = null,
  zonePending = false,
}: ReadyDatePickerModalOpenProps) {
  const t = useTranslations('newOrder.schedule');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState<Date>(() => calendarDate(initialDate, opsZone));
  const [selectedTime, setSelectedTime] = useState(() => initialTime || '17:00');
  const [currentMonth, setCurrentMonth] = useState(() => calendarDate(initialDate, opsZone));
  const [dateInput, setDateInput] = useState(() => civilDateFromPickerDate(calendarDate(initialDate, opsZone)));
  const [timeInput, setTimeInput] = useState(() => initialTime || '17:00');

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(year, month - 1, day);
    setSelectedDate(parsedDate);
    setCurrentMonth(parsedDate);
  };

  const civilToday = opsZone ? civilDateInZone(new Date(), opsZone) : '';
  const dateValidation = useMemo(() => {
    if (!opsZone) return { isValid: false, isFuture: false };
    try {
      const instant = instantFromCivilDateTime(civilDateFromPickerDate(selectedDate), selectedTime, opsZone);
      const nowMs = new Date().getTime();
      const isValid = allowNow ? instant.getTime() >= nowMs - 60000 : instant.getTime() > nowMs;
      return { isValid, isFuture: isValid };
    } catch {
      return { isValid: false, isFuture: false };
    }
  }, [selectedDate, selectedTime, allowNow, opsZone]);

  const handleApply = () => {
    if (!dateValidation.isValid) {
      return;
    }
    onApply(selectedDate, selectedTime);
    onClose();
  };

  const getDaysInMonth = (date: Date) => {
    const { y: year, m: month } = cal(date);
    const daysInMonth = cal(new Date(year, month + 1, 0)).day;
    const startingDayOfWeek = cal(new Date(year, month, 1)).wd;

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const isSameDay = (date1: Date, date2: Date) =>
    civilDateFromPickerDate(date1) === civilDateFromPickerDate(date2);

  const isToday = (date: Date) => civilDateFromPickerDate(date) === civilToday;

  const days = getDaysInMonth(currentMonth);
  const monthNames = [
    t('monthNames.january'),
    t('monthNames.february'),
    t('monthNames.march'),
    t('monthNames.april'),
    t('monthNames.may'),
    t('monthNames.june'),
    t('monthNames.july'),
    t('monthNames.august'),
    t('monthNames.september'),
    t('monthNames.october'),
    t('monthNames.november'),
    t('monthNames.december'),
  ];
  const dayNames = [
    t('dayNames.sun'),
    t('dayNames.mon'),
    t('dayNames.tue'),
    t('dayNames.wed'),
    t('dayNames.thu'),
    t('dayNames.fri'),
    t('dayNames.sat'),
  ];

  const previousMonth = () => {
    setCurrentMonth(new Date(cal(currentMonth).y, cal(currentMonth).m - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(cal(currentMonth).y, cal(currentMonth).m + 1));
  };

  // Time options (every hour from 8 AM to 10 PM)
  const timeOptions = [];
  for (let hour = 8; hour <= 22; hour++) {
    const time12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const period = hour >= 12 ? 'PM' : 'AM';
    const timeValue = `${hour.toString().padStart(2, '0')}:00`;
    timeOptions.push({
      value: timeValue,
      label: `${time12}:00 ${period}`,
    });
  }

  return (
    <CmxDialog open onOpenChange={(next) => { if (!next) onClose(); }} closeOnOverlayClick>
      <CmxDialogContent className="max-w-md w-full" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('selectReadyDateTime')}</CmxDialogTitle>
        </CmxDialogHeader>

        {/* Content */}
        <div className="space-y-4">
          {/* Direct Date/Time Input */}
          <div className="space-y-2">
            <Label className="block text-xs font-semibold text-foreground text-start">
              {t('readyBy')} ({t('directInput') || 'Direct Input'})
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <CmxInput
                type="date"
                value={dateInput}
                onChange={(e) => handleDateInputChange(e.target.value)}
                min={civilToday}
                error={!dateValidation.isValid ? ' ' : undefined}
                aria-label={t('readyBy')}
              />
              <CmxInput
                type="time"
                value={timeInput}
                onChange={(e) => {
                  setTimeInput(e.target.value);
                  setSelectedTime(e.target.value);
                }}
                aria-label={t('selectTime')}
              />
            </div>
            {!opsZone && !zonePending && (
              <p className="text-xs text-danger-text">{t('timezoneNotConfigured')}</p>
            )}
            {opsZone && !dateValidation.isValid && (
              <p className="text-xs text-danger-text">{t('validation.dateMustBeFuture')}</p>
            )}
          </div>

          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <CmxButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={previousMonth}
                aria-label={tCommon('previous')}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </CmxButton>
              <h3 className="font-bold text-base text-start">
                {monthNames[cal(currentMonth).m]} {cal(currentMonth).y}
              </h3>
              <CmxButton
                type="button"
                variant="ghost"
                size="icon"
                onClick={nextMonth}
                aria-label={tCommon('next')}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </CmxButton>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day, index) => (
                <CmxButton
                  key={index}
                  type="button"
                  variant={day && isSameDay(day, selectedDate) ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => day && setSelectedDate(day)}
                  disabled={!day || !civilToday || civilDateFromPickerDate(day) < civilToday}
                  className={`aspect-square h-auto p-0 text-xs font-medium tabular-nums ${
                    !day
                      ? 'invisible'
                      : day && !isSameDay(day, selectedDate) && isToday(day)
                        ? 'bg-info-bg text-info-text font-bold'
                        : ''
                  }`}
                >
                  {day ? cal(day).day : null}
                </CmxButton>
              ))}
            </div>
          </div>

          {/* Time Selector */}
          <div>
            <Label className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground text-start">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {t('selectTime')}
            </Label>
            <CmxSelect
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setTimeInput(e.target.value);
              }}
              dir="ltr"
              options={timeOptions}
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-info-bg rounded-lg text-start">
            <p className="text-xs text-muted-foreground mb-1">{t('readyBy')}:</p>
            <p className="font-bold text-sm text-primary-text">
              {formatCivilDate(civilDateFromPickerDate(selectedDate), locale)}{' '}
              {t('at')}{' '}
              {timeOptions.find((t) => t.value === selectedTime)?.label || selectedTime}
            </p>
          </div>
        </div>

        <CmxDialogFooter className="gap-2">
          <CmxButton type="button" variant="outline" onClick={onClose} className="flex-1">
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="primary"
            onClick={handleApply}
            disabled={!dateValidation.isValid}
            className="flex-1"
          >
            {t('apply')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
