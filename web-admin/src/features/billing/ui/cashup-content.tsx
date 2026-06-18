'use client';

import { useState } from 'react';
import CashUpForm from './cashup-form';
import CashUpHistory from './cashup-history';
import type { CashUpDayData } from '@/lib/types/payment';

interface CashUpContentProps {
  data: CashUpDayData;
  selectedDate: string;
  currencyCode: string;
}

/**
 * Client wrapper that coordinates form and history. When reconciliation is
 * saved successfully, the history list is refreshed by remounting it.
 * @param root0
 * @param root0.data
 * @param root0.selectedDate
 * @param root0.currencyCode
 */
export default function CashUpContent({
  data,
  selectedDate,
  currencyCode,
}: CashUpContentProps) {
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <>
      <CashUpForm
        data={data}
        selectedDate={selectedDate}
        currencyCode={currencyCode}
        onSuccess={() => setHistoryKey((k) => k + 1)}
      />
      <CashUpHistory key={historyKey} currencyCode={currencyCode} />
    </>
  );
}
