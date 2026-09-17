'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms/cmx-select-dropdown';
import { cmxMessage } from '@ui/feedback';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';

interface IssueTaxDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
}

type DocumentType = 'INVOICE' | 'SIMPLIFIED_INVOICE';

/** B14 follow-up — manual tax document issuance, reason-free (the document type choice is the only decision). */
export function IssueTaxDocumentDialog({ open, onOpenChange, orderId }: IssueTaxDocumentDialogProps) {
  const t = useTranslations('taxDocuments.issueDialog');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { token: csrfToken } = useCSRFToken();
  const [documentType, setDocumentType] = useState<DocumentType>('SIMPLIFIED_INVOICE');
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/tax-documents/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
        body: JSON.stringify({ documentType }),
      });
      const json = await res.json();
      if (json.success) {
        cmxMessage.success(t('success'));
        onOpenChange(false);
        router.refresh();
      } else {
        cmxMessage.error(mapIssueError(json.error, t));
      }
    } catch {
      cmxMessage.error(t('errors.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          <CmxDialogDescription>{t('description')}</CmxDialogDescription>
        </CmxDialogHeader>
        <div className="space-y-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">{t('documentTypeLabel')}</label>
          <CmxSelectDropdown value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
            <CmxSelectDropdownTrigger className="w-full text-sm">
              {documentType === 'INVOICE' ? t('documentTypeInvoice') : t('documentTypeSimplified')}
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              <CmxSelectDropdownItem value="SIMPLIFIED_INVOICE">{t('documentTypeSimplified')}</CmxSelectDropdownItem>
              <CmxSelectDropdownItem value="INVOICE">{t('documentTypeInvoice')}</CmxSelectDropdownItem>
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={close} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton loading={submitting} onClick={submit}>
            {t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

function mapIssueError(code: string, t: (key: string) => string): string {
  switch (code) {
    case 'TAX_REGISTRATION_NOT_CONFIGURED':
    case 'TAX_DOCUMENT_ALREADY_EXISTS':
    case 'NO_TAX_LINES':
    case 'ORDER_NOT_FOUND':
      return t(`errors.${code}`);
    default:
      return t('errors.failed');
  }
}
