/**
 * Receipt Preview Component
 * Preview and send receipts
 * PRD-006: Digital Receipts
 */

'use client';

import { useState } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useReceipts, useSendReceipt } from '../hooks/use-receipts';
import { useMessage } from '@ui/feedback/useMessage';
import { Receipt, Send, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ReceiptPreviewProps {
  orderId: string;
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

export function ReceiptPreview({ orderId }: ReceiptPreviewProps) {
  const [receiptType, setReceiptType] = useState('whatsapp_text');
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(['whatsapp']);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const { data: receipts, isLoading } = useReceipts(orderId);
  const { mutate: sendReceipt, isPending: isSending } = useSendReceipt();
  const { showSuccess, showError } = useMessage();

  const handleSend = () => {
    if (deliveryChannels.length === 0) {
      showError('Please select at least one delivery channel');
      return;
    }

    sendReceipt(
      {
        orderId,
        receiptTypeCode: receiptType,
        deliveryChannels,
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
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'sent':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-600 bg-green-50';
      case 'sent':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
            <label className="block text-sm font-medium mb-1">Receipt Type</label>
            <select
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            >
              {RECEIPT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Delivery Channels</label>
            <div className="space-y-2">
              {DELIVERY_CHANNELS.map((channel) => (
                <label key={channel.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={deliveryChannels.includes(channel.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setDeliveryChannels([...deliveryChannels, channel.value]);
                      } else {
                        setDeliveryChannels(
                          deliveryChannels.filter((c) => c !== channel.value)
                        );
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{channel.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'ar')}
              className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>

          <CmxButton onClick={handleSend} loading={isSending} disabled={isSending} className="w-full">
            <Send className="h-4 w-4 mr-2" />
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
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(receipt.deliveryStatusCode)}
                    <div>
                      <div className="font-medium text-sm">
                        {receipt.receiptTypeCode} via {receipt.deliveryChannelCode}
                      </div>
                      <div className="text-xs text-gray-500">
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

