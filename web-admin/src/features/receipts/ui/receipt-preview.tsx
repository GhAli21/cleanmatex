/**
 * Receipt Preview Component
 * Preview and send receipts
 * PRD-006: Digital Receipts
 */

'use client';

import { useState } from 'react';
import { CmxButton, CmxCheckbox, CmxSelect, Label } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useReceipts, useSendReceipt } from '../hooks/use-receipts';
import { useMessage } from '@ui/feedback/useMessage';
import { Receipt, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ReceiptPreviewProps {
  orderId: string;
  /** When 'b2b', default delivery channel is email (formal PDF) per B2B receipt rules */
  customerType?: string;
}

const RECEIPT_TYPES = [
  { value: 'whatsapp_text', label: 'WhatsApp Text' },
  { value: 'whatsapp_image', label: 'WhatsApp Image' },
  { value: 'in_app', label: 'In-App Receipt' },
];

const DELIVERY_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'app', label: 'In-App' },
];

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.customerType
 */
export function ReceiptPreview({ orderId, customerType }: ReceiptPreviewProps) {
  const [receiptType, setReceiptType] = useState('whatsapp_text');
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(['whatsapp']);
  const isB2b = customerType === 'b2b';
  /** B2B forces email; otherwise use checkbox-controlled state */
  const effectiveChannels = isB2b ? ['email'] : deliveryChannels;
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const { data: receipts } = useReceipts(orderId);
  const { mutate: sendReceipt, isPending: isSending } = useSendReceipt();
  const { showSuccess, showError } = useMessage();

  const handleSend = () => {
    if (effectiveChannels.length === 0) {
      showError('Please select at least one delivery channel');
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
        onSuccess: () => {
          showSuccess('Receipt sent successfully');
        },
        onError: (error) => {
          showError(error.message || 'Failed to send receipt');
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
            Send Receipt
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <div>
            <CmxSelect
              label="Receipt Type"
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              options={RECEIPT_TYPES}
            />
          </div>

          <div>
            <Label className="block mb-1">Delivery Channels</Label>
            <div className="space-y-2">
              {DELIVERY_CHANNELS.map((channel) => (
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
              label="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'Arabic' },
              ]}
            />
          </div>

          <CmxButton onClick={handleSend} loading={isSending} disabled={isSending} className="w-full">
            <Send className="h-4 w-4 me-2" />
            Send Receipt
          </CmxButton>
        </CmxCardContent>
      </CmxCard>

      {receipts && receipts.length > 0 && (
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>Receipt History</CmxCardTitle>
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
                        {receipt.receiptTypeCode} via {receipt.deliveryChannelCode}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {receipt.sentAt
                          ? `Sent: ${new Date(receipt.sentAt).toLocaleString()}`
                          : 'Not sent'}
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
