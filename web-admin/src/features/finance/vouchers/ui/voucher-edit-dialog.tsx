'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { useMessage } from '@ui/feedback';
import { updateBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import type { VoucherListItem } from '@/lib/types/voucher';
import type { UpdateBizVoucherInput } from '@/lib/types/voucher';

interface VoucherEditDialogProps {
  open: boolean;
  voucher: VoucherListItem | null;
  onClose: () => void;
}

interface EditForm {
  voucher_date: string;
  party_name: string;
  description: string;
  notes: string;
}

const EMPTY_FORM: EditForm = {
  voucher_date: '',
  party_name: '',
  description: '',
  notes: '',
};

export function VoucherEditDialog({ open, voucher, onClose }: VoucherEditDialogProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const { showSuccess, showError } = useMessage();

  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (voucher) {
      setForm({
        voucher_date: voucher.voucher_date ?? '',
        party_name: voucher.party_name ?? '',
        description: '',
        notes: '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [voucher]);

  function handleChange(key: keyof EditForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit() {
    if (!voucher) return;
    setLoading(true);
    try {
      const input: UpdateBizVoucherInput = {};
      if (form.voucher_date) input.voucher_date = form.voucher_date;
      if (form.party_name)   input.party_name   = form.party_name;
      if (form.description)  input.description  = form.description;
      if (form.notes)        input.notes        = form.notes;

      const result = await updateBizVoucherAction(voucher.id, input);
      if (!result.success) {
        showError(result.error ?? tCommon('error'));
        return;
      }
      showSuccess(t('editSuccess'));
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={onClose}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.edit')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('voucherDate')}
            </label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.voucher_date}
              onChange={handleChange('voucher_date')}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('party')}
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.party_name}
              onChange={handleChange('party_name')}
              maxLength={250}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('description')}
            </label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.description}
              onChange={handleChange('description')}
              maxLength={500}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t('notes')}
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={form.notes}
              onChange={handleChange('notes')}
            />
          </div>
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton variant="primary" onClick={handleSubmit} loading={loading}>
            {tCommon('save')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
