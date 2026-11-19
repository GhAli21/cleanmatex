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

interface ReadyDatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (date: Date, time: string) => void;
  initialDate?: Date;
  initialTime?: string;
  /** When true (retail orders), allow "now" as valid instead of requiring strict future */
  allowNow?: boolean;
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

function ReadyDatePickerModalOpen({
  onClose,
  onApply,
  initialDate,
  initialTime,
  allowNow = false,
}: ReadyDatePickerModalOpenProps) {
  const t = useTranslations('newOrder.schedule');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || new Date());
  const [selectedTime, setSelectedTime] = useState(() => initialTime || '17:00');
  const [currentMonth, setCurrentMonth] = useState(() => initialDate || new Date());
  const [dateInput, setDateInput] = useState(() => {
    const d = initialDate || new Date();
    return d.toISOString().split('T')[0];
  });
  const [timeInput, setTimeInput] = useState(() => initialTime || '17:00');

  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    const parsedDate = new Date(value);
    if (!isNaN(parsedDate.getTime())) {
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate);
    }
  };

  const dateValidation = useMemo(() => {
    const now = new Date();
    const selectedDateTime = new Date(`${selectedDate.toDateString()} ${selectedTime}`);
    const threshold = allowNow ? now.getTime() - 60000 : now.getTime();
    const isValid = allowNow ? selectedDateTime.getTime() >= threshold : selectedDateTime > now;
    return {
      isValid,
      isFuture: isValid,
    };
  }, [selectedDate, selectedTime, allowNow]);

  const handleApply = () => {
    if (!dateValidation.isValid) {
      return;
    }
    onApply(selectedDate, selectedTime);
    onClose();
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

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
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();

  const isToday = (date: Date) => isSameDay(date, new Date());

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
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
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
                min={new Date().toISOString().split('T')[0]}
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
            {!dateValidation.isValid && (
              <p className="text-xs text-danger-text">{t('validation.dateMustBeFuture') || 'Date must be in the future'}</p>
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
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
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
                  disabled={!day || day < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={`aspect-square h-auto p-0 text-xs font-medium tabular-nums ${
                    !day
                      ? 'invisible'
                      : day && !isSameDay(day, selectedDate) && isToday(day)
                        ? 'bg-info-bg text-info-text font-bold'
                        : ''
                  }`}
                >
                  {day?.getDate()}
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
              {selectedDate.toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
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
