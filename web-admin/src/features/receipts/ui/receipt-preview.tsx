/**
 * Receipt Preview Component
 * Preview and send receipts
 * PRD-006: Digital Receipts
 */

'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxCheckbox, CmxSelect, Label } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useReceipts, useSendReceipt } from '../hooks/use-receipts';
import { useMessage } from '@ui/feedback/useMessage';
import { useOutboxDeliveryReport } from '@features/notifications/hooks/use-outbox-delivery-report';
import { Receipt, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ReceiptPreviewProps {
  orderId: string;
  /** When 'b2b', default delivery channel is email (formal PDF) per B2B receipt rules */
  customerType?: string;
}

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.customerType
 */
export function ReceiptPreview({ orderId, customerType }: ReceiptPreviewProps) {
  const t = useTranslations('receipts');
  const locale = useLocale();
  const [receiptType, setReceiptType] = useState('whatsapp_text');
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(['whatsapp']);
  const isB2b = customerType === 'b2b';
  /** B2B forces email; otherwise use checkbox-controlled state */
  const effectiveChannels = isB2b ? ['email'] : deliveryChannels;
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const { data: receipts } = useReceipts(orderId);
  const { mutate: sendReceipt, isPending: isSending } = useSendReceipt();
  const { showSuccess, showError, showInfo } = useMessage();
  const reportDelivery = useOutboxDeliveryReport();

  const receiptTypeOptions = [
    { value: 'whatsapp_text', label: t('receiptTypes.whatsapp_text') },
    { value: 'whatsapp_image', label: t('receiptTypes.whatsapp_image') },
    { value: 'in_app', label: t('receiptTypes.in_app') },
  ];

  const deliveryChannelOptions = [
    { value: 'whatsapp', label: t('deliveryChannels.whatsapp') },
    { value: 'email', label: t('deliveryChannels.email') },
    { value: 'app', label: t('deliveryChannels.app') },
  ];

  const handleSend = () => {
    if (effectiveChannels.length === 0) {
      showError(t('messages.channelRequired'));
      return;
    }

    sendReceipt(
      {
        orderId,
        receiptTypeCode: receiptType,
        deliveryChannels: effectiveChannels,
        language,
      },
      {
        onSuccess: ({ sends }) => {
          const channelName = (code: string) =>
            code === 'whatsapp' || code === 'email' || code === 'app' ? t(`deliveryChannels.${code}`) : code;
          const queued = sends.filter((x) => x.outboxId);
          if (queued.length > 0) showInfo(t('messages.queued'));
          else if (sends.every((x) => !x.error)) showSuccess(t('messages.sendSuccess'));
          for (const send of sends) {
            const channel = channelName(send.channel);
            if (send.outboxId) {
              // Queued email / WhatsApp: report each channel once HQ has sent it or given up.
              void reportDelivery(send.outboxId, {
                sent: t('messages.channelSent', { channel }),
                failed: t('messages.channelFailed', { channel }),
                pending: t('messages.channelPending', { channel }),
              });
            } else if (send.error === 'NO_RECIPIENT_ADDRESS') {
              showError(t('messages.channelNoAddress', { channel }));
            } else if (send.error) {
              showError(t('messages.channelFailed', { channel }));
            }
          }
        },
        onError: (error) => {
          showError(error.message || t('messages.sendFailed'));
        },
      }
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-success-text" />;
      case 'sent':
        return <Clock className="h-4 w-4 text-primary-text" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-danger-text" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-success-text bg-success-bg';
      case 'sent':
        return 'text-info-text bg-info-bg';
      case 'failed':
        return 'text-danger-text bg-danger-bg';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <div className="space-y-4">
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t('send.title')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div>
            <CmxSelect
              label={t('send.receiptType')}
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              options={receiptTypeOptions}
            />
          </div>

          <div>
            <Label className="block mb-1">{t('send.deliveryChannels')}</Label>
            <div className="space-y-2">
              {deliveryChannelOptions.map((channel) => (
                <CmxCheckbox
                  key={channel.value}
                  disabled={isB2b}
                  checked={effectiveChannels.includes(channel.value)}
                  onChange={(e) => {
                    if (isB2b) return;
                    if (e.target.checked) {
                      setDeliveryChannels([...deliveryChannels, channel.value]);
                    } else {
                      setDeliveryChannels(
                        deliveryChannels.filter((c) => c !== channel.value)
                      );
                    }
                  }}
                  label={channel.label}
                />
              ))}
            </div>
          </div>

          <div>
            <CmxSelect
              label={t('send.language')}
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
              options={[
                { value: 'en', label: t('languages.en') },
                { value: 'ar', label: t('languages.ar') },
              ]}
            />
          </div>

          <CmxButton onClick={handleSend} loading={isSending} disabled={isSending} className="w-full">
            <Send className="h-4 w-4 me-2" />
            {t('send.action')}
          </CmxButton>
        </CmxCardContent>
      </CmxCard>

      {receipts && receipts.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('history.title')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(receipt.deliveryStatusCode)}
                    <div>
                      <div className="font-medium text-sm">
                        {receipt.receiptTypeCode} · {receipt.deliveryChannelCode}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {receipt.sentAt
                          ? t('history.sentAt', {
                              date: new Date(receipt.sentAt).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-OM'),
                            })
                          : t('history.notSent')}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                      receipt.deliveryStatusCode
                    )}`}
                  >
                    {receipt.deliveryStatusCode}
                  </span>
                </div>
              ))}
            </div>
          </CmxCardContent>
        </CmxCard>
      )}
    </div>
  );
}
