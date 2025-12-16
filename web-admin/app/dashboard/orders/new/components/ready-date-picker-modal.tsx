/**
 * Ready Date Picker Modal Component
 * Modal for selecting ready-by date and time
 * Re-Design: PRD-010 Advanced Orders - Section 5B
 */

'use client';

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (open) {
      setSelectedDate(initialDate || new Date());
      setSelectedTime(initialTime || '17:00');
      setCurrentMonth(initialDate || new Date());
    }
  }, [open, initialDate, initialTime]);

  const handleApply = () => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} p-6 border-b border-gray-200`}>
          <h2 className={`text-2xl font-bold text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>{t('selectReadyDateTime')}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={tCommon('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Calendar */}
          <div>
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'} mb-4`}>
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={tCommon('previous')}
              >
                {isRTL ? '→' : '←'}
              </button>
              <h3 className={`font-bold text-lg ${isRTL ? 'text-right' : 'text-left'}`}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={tCommon('next')}
              >
                {isRTL ? '←' : '→'}
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <button
                  key={index}
                  onClick={() => day && setSelectedDate(day)}
                  disabled={!day || day < new Date(new Date().setHours(0, 0, 0, 0))}
                  className={`
                    aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${
                      !day
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
            <label className={`block text-sm font-semibold text-gray-900 mb-2 flex items-center ${isRTL ? 'flex-row-reverse' : ''} gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <Clock className="w-4 h-4" />
              {t('selectTime')}
            </label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              dir="ltr"
              className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div className={`p-4 bg-blue-50 rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="text-sm text-gray-600 mb-1">{t('readyBy')}:</p>
            <p className="font-bold text-lg text-blue-700">
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
        <div className={`flex items-center gap-3 p-6 border-t border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={onClose}
            className="flex-1 h-12 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleApply}
            className="flex-1 h-12 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-lg"
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
