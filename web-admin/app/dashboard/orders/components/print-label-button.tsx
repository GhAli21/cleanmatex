'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';

interface PrintLabelButtonProps {
  order: {
    id: string;
    order_no: string;
    qr_code?: string | null;
    barcode?: string | null;
    ready_by?: Date | null;
    org_customers_mst: {
      sys_customers_mst: {
        first_name: string;
        last_name?: string | null;
      };
    };
  };
}

export function PrintLabelButton({ order }: PrintLabelButtonProps) {
  const t = useTranslations('orders.printLabel');
  const isRTL = useRTL();
  const locale = useLocale();
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);

    // Create print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (!printWindow) {
      alert(t('errors.allowPopups'));
      setPrinting(false);
      return;
    }

    const customerName = `${order.org_customers_mst.sys_customers_mst.first_name} ${
      order.org_customers_mst.sys_customers_mst.last_name || ''
    }`.trim();

    const readyByFormatted = order.ready_by
      ? new Date(order.ready_by).toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : t('tbd');

    // Generate label HTML
    const labelHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label - ${order.order_no}</title>
          <style>
            @page {
              size: 4in 6in;
              margin: 0.25in;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Arial', sans-serif;
              width: 4in;
              height: 6in;
              padding: 0.25in;
              display: flex;
              flex-direction: column;
            }

            .header {
              text-align: center;
              border-bottom: 3px solid #000;
              padding-bottom: 0.25in;
              margin-bottom: 0.25in;
            }

            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 4px;
            }

            .order-number {
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 2px;
              margin: 0.15in 0;
            }

            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 0.1in;
              font-size: 12px;
            }

            .info-label {
              font-weight: bold;
              color: #333;
            }

            .info-value {
              color: #000;
            }

            .codes-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 0.2in;
              margin: 0.2in 0;
            }

            .qr-container,
            .barcode-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            }

            .qr-container svg,
            .barcode-container svg {
              max-width: 2in;
              max-height: 2in;
            }

            .code-label {
              font-size: 10px;
              font-weight: bold;
              color: #666;
              text-transform: uppercase;
            }

            .footer {
              border-top: 2px solid #000;
              padding-top: 0.1in;
              text-align: center;
              font-size: 10px;
              color: #666;
            }

            .ready-by {
              background: #000;
              color: #fff;
              padding: 8px;
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin: 0.1in 0;
              border-radius: 4px;
            }

            @media print {
              body {
                width: 4in;
                height: 6in;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">CleanMateX</div>
            <div class="order-number">${order.order_no}</div>
          </div>

          <div class="info-row">
            <span class="info-label">${t('label.customer')}:</span>
            <span class="info-value">${customerName}</span>
          </div>

          <div class="ready-by">
            ${t('label.readyBy')}: ${readyByFormatted}
          </div>

          <div class="codes-section">
            ${
              order.qr_code
                ? `
              <div class="qr-container">
                <div class="code-label">${t('label.scanToTrack')}</div>
                ${order.qr_code}
              </div>
            `
                : ''
            }

            ${
              order.barcode
                ? `
              <div class="barcode-container">
                <div class="code-label">${t('label.barcode')}</div>
                ${order.barcode}
              </div>
            `
                : ''
            }
          </div>

          <div class="footer">
            ${t('label.footerThankYou')}<br>
            ${t('label.footerInquiries')}: +968 1234 5678
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(labelHTML);
    printWindow.document.close();

    // Reset printing state after a delay
    setTimeout(() => {
      setPrinting(false);
    }, 2000);
  };

  return (
    <button
      onClick={handlePrint}
      disabled={printing || (!order.qr_code && !order.barcode)}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
      title={!order.qr_code && !order.barcode ? t('errors.noCodesAvailable') : t('title')}
    >
      <Printer className="w-4 h-4" />
      {printing ? t('printing') : t('printLabel')}
    </button>
  );
}
