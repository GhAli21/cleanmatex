/**
 * Ready Date Picker Modal Component
 * Modal for selecting ready-by date and time
 * Re-Design: PRD-010 Advanced Orders - Section 5B
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

interface ReadyDatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (date: Date, time: string) => void;
  initialDate?: Date;
  initialTime?: string;
}

export function ReadyDatePickerModal({
  open,
  onClose,
  onApply,
  initialDate,
  initialTime,
}: ReadyDatePickerModalProps) {
  const t = useTranslations('newOrder.schedule');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRTL = useRTL();
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [selectedTime, setSelectedTime] = useState(initialTime || '17:00');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState(initialTime || '17:00');

  useEffect(() => {
    if (open) {
      const initDate = initialDate || new Date();
      const initTime = initialTime || '17:00';
      setSelectedDate(initDate);
      setSelectedTime(initTime);
      setTimeInput(initTime);
      setCurrentMonth(initDate);
      // Format date for input (YYYY-MM-DD)
      setDateInput(initDate.toISOString().split('T')[0]);
    }
  }, [open, initialDate, initialTime]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  // Parse date input and update selected date
  const handleDateInputChange = (value: string) => {
    setDateInput(value);
    const parsedDate = new Date(value);
    if (!isNaN(parsedDate.getTime())) {
      setSelectedDate(parsedDate);
      setCurrentMonth(parsedDate);
    }
  };

  // Validate date is in the future
  const dateValidation = useMemo(() => {
    const now = new Date();
    const selectedDateTime = new Date(`${selectedDate.toDateString()} ${selectedTime}`);
    return {
      isValid: selectedDateTime > now,
      isFuture: selectedDateTime > now,
    };
  }, [selectedDate, selectedTime]);

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

  if (!open) return null;

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
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-4 border-b border-gray-200`}>
          <h2 className={`text-lg font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('selectReadyDateTime')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Direct Date/Time Input */}
          <div className="space-y-2">
            <label className={`block text-xs font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('readyBy')} ({t('directInput') || 'Direct Input'})
            </label>
            <div className={`grid grid-cols-2 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => handleDateInputChange(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 border ${!dateValidation.isValid ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
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
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'}`}
                />
              </div>
            </div>
            {!dateValidation.isValid && (
              <p className="text-xs text-red-600">{t('validation.dateMustBeFuture') || 'Date must be in the future'}</p>
            )}
          </div>

          {/* Calendar */}
          <div>
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-2`}>
              <button
                onClick={previousMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={tCommon('previous')}
              >
                {isRTL ? '→' : '←'}
              </button>
              <h3 className={`font-bold text-base ${isRTL ? 'text-right' : 'text-left'}`}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={tCommon('next')}
              >
                {isRTL ? '←' : '→'}
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">
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
                        ? 'text-gray-300 cursor-not-allowed'
                        : day && isSameDay(day, selectedDate)
                          ? 'bg-blue-600 text-white shadow-md'
                          : isToday(day)
                            ? 'bg-blue-100 text-blue-700 font-bold'
                            : 'hover:bg-gray-100'
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
            <label className={`block text-xs font-semibold text-gray-700 mb-1.5 flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
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
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div className={`p-3 bg-blue-50 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="text-xs text-gray-600 mb-1">{t('readyBy')}:</p>
            <p className="font-bold text-sm text-blue-700">
              {selectedDate.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-US', {
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
        <div className={`flex items-center gap-2 p-4 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={onClose}
            className="flex-1 h-10 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={!dateValidation.isValid}
            className="flex-1 h-10 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors shadow-lg"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
