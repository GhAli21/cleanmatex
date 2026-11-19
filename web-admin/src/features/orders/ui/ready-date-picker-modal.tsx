/**
 * Ready Date Picker Modal Component
 * Modal for selecting ready-by date and time
 * Re-Design: PRD-010 Advanced Orders - Section 5B
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { X, Calendar, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

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
  const isRTL = useRTL();
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || new Date());
  const [selectedTime, setSelectedTime] = useState(() => initialTime || '17:00');
  const [currentMonth, setCurrentMonth] = useState(() => initialDate || new Date());
  const [dateInput, setDateInput] = useState(() => {
    const d = initialDate || new Date();
    return d.toISOString().split('T')[0];
  });
  const [timeInput, setTimeInput] = useState(() => initialTime || '17:00');

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Parse date input and update selected date
  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    const parsedDate = new Date(value);
    if (!isNaN(parsedDate.getTime())) {
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate);
    }
  };

  // Validate date: future for services; "now" or future for retail (allowNow)
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
      return; // Don't apply if date is not in the future
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

    // Add empty slots for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const focusTrapRef = useFocusTrap(true, { returnFocus: true });

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

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={focusTrapRef}
        className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground text-start">{t('selectReadyDateTime')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Direct Date/Time Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-foreground text-start">
              {t('readyBy')} ({t('directInput') || 'Direct Input'})
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 border ${!dateValidation.isValid ? 'border-destructive' : 'border-border'} rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-start`}
                />
              </div>
              <div>
                <input
                  type="time"
                  value={timeInput}
                  onChange={(e) => {
                    setTimeInput(e.target.value);
                    setSelectedTime(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-start"
                />
              </div>
            </div>
            {!dateValidation.isValid && (
              <p className="text-xs text-danger-text">{t('validation.dateMustBeFuture') || 'Date must be in the future'}</p>
            )}
          </div>

          {/* Calendar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={previousMonth}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                aria-label={tCommon('previous')}
              >
                {isRTL ? '→' : '←'}
              </button>
              <h3 className="font-bold text-base text-start">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                aria-label={tCommon('next')}
              >
                {isRTL ? '←' : '→'}
              </button>
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
                <button
                  key={index}
                  onClick={() => day && setSelectedDate(day)}
                  disabled={!day || day < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={`
                    aspect-square flex items-center justify-center rounded text-xs font-medium transition-all
                    ${!day
                      ? 'invisible'
                      : day < new Date(new Date().setHours(0, 0, 0, 0))
                        ? 'text-muted-foreground cursor-not-allowed'
                        : day && isSameDay(day, selectedDate)
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : isToday(day)
                            ? 'bg-info-bg text-info-text font-bold'
                            : 'hover:bg-muted'
                    }
                  `}
                >
                  {day?.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selector */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-2 text-start">
              <Clock className="w-3.5 h-3.5" />
              {t('selectTime')}
            </label>
            <select
              value={selectedTime}
              onChange={(e) => {
                setSelectedTime(e.target.value);
                setTimeInput(e.target.value);
              }}
              dir="ltr"
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent text-sm text-start"
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 px-4 bg-muted hover:bg-border text-foreground rounded-lg font-medium text-sm transition-colors"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={!dateValidation.isValid}
            className="flex-1 h-10 px-4 bg-success hover:bg-success/90 disabled:bg-border disabled:cursor-not-allowed text-on-solid rounded-lg font-medium text-sm transition-colors shadow-lg"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
