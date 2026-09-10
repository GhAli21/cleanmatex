'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton, CmxInput, Label } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxCountPicker } from '@ui/forms';
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback';

interface RackBagsFields {
  rackLocation: string;
  lockerLocation: string;
  lockerCode: string;
  bagCount: number;
  hangingCount: number;
}

interface CustomerRackWarning {
  hasOtherRackedOrders: boolean;
  rackCount: number;
  totalBags: number;
  totalHanging: number;
  orderNos: string[];
}

interface RackBagsContext {
  fields: RackBagsFields;
  customerRackWarning: CustomerRackWarning;
}

const DEFAULT_FIELDS: RackBagsFields = {
  rackLocation: '',
  lockerLocation: '',
  lockerCode: '',
  bagCount: 1,
  hangingCount: 0,
};

async function fetchRackBagsContext(orderId: string): Promise<RackBagsContext | null> {
  const response = await fetch(`/api/v1/orders/${orderId}/rack-bags`, { credentials: 'include' });
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; fields?: RackBagsFields; customerRackWarning?: CustomerRackWarning }
    | null;
  if (!payload?.success || !payload.fields || !payload.customerRackWarning) return null;
  return { fields: payload.fields, customerRackWarning: payload.customerRackWarning };
}

export interface RackBagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerId?: string | null;
  onSaved: (fields: RackBagsFields) => void;
}

/**
 * Standalone rack/locker/bag/hanging entry dialog. Self-fetches on open and
 * only persists fields via batch-update — it has no knowledge of "workflow
 * actions" or "execute"; callers decide what to do next with `onSaved`.
 */
export function RackBagsModal({ open, onOpenChange, orderId, onSaved }: RackBagsModalProps) {
  const t = useTranslations('workflow.ready.rackBags');
  const tMessages = useTranslations('workflow.ready.messages');
  const isRTL = useRTL();

  const contextQuery = useQuery({
    queryKey: ['rack-bags', orderId],
    enabled: open && !!orderId,
    queryFn: () => fetchRackBagsContext(orderId),
    staleTime: 0,
    gcTime: 0,
  });

  const [fields, setFields] = useState<RackBagsFields>(DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open && contextQuery.data) {
      setFields(contextQuery.data.fields);
      setSubmitError(null);
    }
  }, [open, contextQuery.data]);

  const customerRackWarning = contextQuery.data?.customerRackWarning;
  const rackTrimmed = fields.rackLocation.trim();

  async function handleSubmit() {
    if (!rackTrimmed) {
      setSubmitError(tMessages('rackRequired'));
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          updates: [],
          orderRackLocation: rackTrimmed,
          lockerLocation: fields.lockerLocation.trim(),
          lockerCode: fields.lockerCode.trim(),
          bagCount: fields.bagCount,
          hangingCount: fields.hangingCount,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || tMessages('rackBagsSaveFailed'));
      }
      cmxMessage.success(tMessages('rackBagsSaved'));
      onSaved({ ...fields, rackLocation: rackTrimmed });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : tMessages('rackBagsSaveFailed');
      setSubmitError(message);
      cmxMessage.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        // Ignore close attempts mid-save: the fields are already in flight.
        if (saving && !next) return;
        onOpenChange(next);
      }}
    >
      <CmxDialogContent
        className="max-w-lg"
        bodyPadding="default"
        scrollBody
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.defaultPrevented) return;
          const target = event.target as HTMLElement | null;
          if (target?.tagName === 'TEXTAREA') return;
          if (saving) return;
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4 py-2">
          {customerRackWarning?.hasOtherRackedOrders ? (
            <CmxSummaryMessage
              type="warning"
              title={t('customerRackWarning', {
                rackCount: customerRackWarning.rackCount,
                bags: customerRackWarning.totalBags,
                hanging: customerRackWarning.totalHanging,
              })}
              items={customerRackWarning.orderNos}
            />
          ) : null}

          {submitError ? (
            <CmxSummaryMessage type="error" title={submitError} items={[]} />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor={`rack-bags-rack-${orderId}`}>
              {t('rack')} <span className="text-red-500" aria-hidden="true">*</span>
            </Label>
            <CmxInput
              id={`rack-bags-rack-${orderId}`}
              value={fields.rackLocation}
              onChange={(e) => setFields((f) => ({ ...f, rackLocation: e.target.value }))}
              placeholder={t('rackPlaceholder')}
              autoComplete="off"
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`rack-bags-locker-${orderId}`}>{t('locker')}</Label>
              <CmxInput
                id={`rack-bags-locker-${orderId}`}
                value={fields.lockerLocation}
                onChange={(e) => setFields((f) => ({ ...f, lockerLocation: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`rack-bags-code-${orderId}`}>{t('code')}</Label>
              <CmxInput
                id={`rack-bags-code-${orderId}`}
                value={fields.lockerCode}
                onChange={(e) => setFields((f) => ({ ...f, lockerCode: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('bags')}</Label>
            <CmxCountPicker
              value={fields.bagCount}
              onChange={(v) => setFields((f) => ({ ...f, bagCount: v }))}
              min={1}
              max={7}
              customCeiling={100}
              groupLabel={t('bags')}
              customLabel={t('custom')}
              disabled={saving}
              isRTL={isRTL}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('hanging')}</Label>
            <CmxCountPicker
              value={fields.hangingCount}
              onChange={(v) => setFields((f) => ({ ...f, hangingCount: v }))}
              min={0}
              max={7}
              customCeiling={9999}
              groupLabel={t('hanging')}
              customLabel={t('custom')}
              disabled={saving}
              isRTL={isRTL}
            />
          </div>
        </div>

        <CmxDialogFooter>
          <CmxButton
            type="button"
            loading={saving}
            disabled={saving || !rackTrimmed}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {t('submit')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
