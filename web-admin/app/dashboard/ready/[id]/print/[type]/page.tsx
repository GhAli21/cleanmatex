/**
 * Ready Order Print Preview
 * Route: /dashboard/ready/[id]/print/[type]?layout=thermal|a4&sort=asc|desc
 * type: receipt | order-details | invoices-payments-rprt | payments-rprt | history-rprt
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/lib/hooks/useLocale';
import {
  mapReadyOrderFromStateResponse,
  type ReadyOrder,
  type ReadyOrderStateResponse,
} from '@features/orders/model/ready-order-types';
import { OrderReceiptPrint } from '@features/orders/ui/order-receipt-print';
import { OrderDetailsPrint } from '@features/orders/ui/order-details-print';
import { OrderInvoicesPaymentsPrintRprt, type OrderInvoicesPaymentsPrintRprtData } from '@features/orders/ui/order-invoices-payments-print-rprt';
import { OrderPaymentsPrintRprt, type OrderPaymentsPrintRprtData } from '@features/orders/ui/order-payments-print-rprt';
import { OrderHistoryPrintRprt, type OrderHistoryPrintRprtData } from '@features/orders/ui/order-history-print-rprt';

type PrintType = 'receipt' | 'order-details' | 'invoices-payments-rprt' | 'payments-rprt' | 'history-rprt';
type PrintLayout = 'thermal' | 'a4';

const RPRT_TYPES: PrintType[] = ['invoices-payments-rprt', 'payments-rprt', 'history-rprt'];

export default function ReadyPrintPage() {
  const params = useParams<{ id: string; type: string }>();
  const searchParams = useSearchParams();
  const tCommon = useTranslations('common');
  const tWorkflow = useTranslations('workflow.ready');
  const locale = useLocale();

  const rawLayout = (searchParams.get('layout') as PrintLayout) || 'thermal';
  const type = (params?.type as PrintType) || 'receipt';
  const isRprt = RPRT_TYPES.includes(type);
  const layout: PrintLayout = isRprt ? 'a4' : rawLayout;
  const sortParam = searchParams.get('sort') === 'asc' ? 'asc' : 'desc';

  const [order, setOrder] = useState<ReadyOrder | null>(null);
  const [reportData, setReportData] = useState<OrderInvoicesPaymentsPrintRprtData | OrderPaymentsPrintRprtData | OrderHistoryPrintRprtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const id = params?.id;

    async function loadStateOnly() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/orders/${id}/state`, { signal: controller.signal, cache: 'no-store' });
        const json: ReadyOrderStateResponse = await res.json();
        const mapped = mapReadyOrderFromStateResponse(json);
        if (mapped) setOrder(mapped);
        else setError(json.error || tWorkflow('messages.loadFailed'));
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : tWorkflow('messages.loadFailed'));
      } finally {
        setLoading(false);
      }
    }

    async function loadInvoicesPaymentsRprt() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/orders/${id}/report/invoices-payments-rprt`, { signal: controller.signal, cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load report');
          return;
        }
        setReportData({ order: json.order, invoices: json.invoices ?? [] });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    async function loadPaymentsRprt() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/orders/${id}/report/payments-rprt?sort=${sortParam}`, { signal: controller.signal, cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load report');
          return;
        }
        setReportData({ order: json.order, payments: json.payments ?? [], sortOrder: json.sortOrder ?? 'desc' });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    async function loadHistoryRprt() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [stateRes, historyRes] = await Promise.all([
          fetch(`/api/v1/orders/${id}/state`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`/api/v1/orders/${id}/history`, { signal: controller.signal, cache: 'no-store' }),
        ]);
        const stateJson: ReadyOrderStateResponse = await stateRes.json();
        const historyJson = await historyRes.json();
        const mapped = mapReadyOrderFromStateResponse(stateJson);
        if (!mapped) {
          setError(stateJson.error || tWorkflow('messages.loadFailed'));
          return;
        }
        const history = Array.isArray(historyJson.data) ? historyJson.data : historyJson.history ?? [];
        setReportData({
          order: { id: mapped.id, order_no: mapped.orderNo, customer: mapped.customer },
          history,
        });
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    if (!id) return;

    if (type === 'invoices-payments-rprt') {
      loadInvoicesPaymentsRprt();
    } else if (type === 'payments-rprt') {
      loadPaymentsRprt();
    } else if (type === 'history-rprt') {
      loadHistoryRprt();
    } else {
      loadStateOnly();
    }

    return () => controller.abort();
  }, [params?.id, type, sortParam, tWorkflow]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Customizable print styles: edit variables below to change header, footer, fonts, spacing */}
      <style 
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              /* Fonts */
              --print-font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              --print-font-size-base: ${layout === 'thermal' ? '11px' : '12px'};
              --print-line-height: 1.4;
              /* Header */
              --print-header-padding-top: ${layout === 'thermal' ? '0' : '0.25rem'};
              --print-header-padding-bottom: ${layout === 'thermal' ? '0.5rem' : '0.75rem'};
              --print-header-margin-bottom: ${layout === 'thermal' ? '0.5rem' : '0.75rem'};
              --print-header-font-size: ${layout === 'thermal' ? '14px' : '16px'};
              --print-header-sub-font-size: ${layout === 'thermal' ? '10px' : '11px'};
              --print-header-border-width: 1px;
              /* Footer */
              --print-footer-padding-top: ${layout === 'thermal' ? '0.5rem' : '0.75rem'};
              --print-footer-margin-top: ${layout === 'thermal' ? '0.5rem' : '1rem'};
              --print-footer-font-size: ${layout === 'thermal' ? '10px' : '11px'};
              --print-footer-border-width: 1px;
              /* Section spacing */
              --print-section-margin-bottom: ${layout === 'thermal' ? '0.5rem' : '0.75rem'};
              --print-section-inner-spacing: ${layout === 'thermal' ? '0.25rem' : '0.375rem'};
            }
            .print-document {
              font-family: var(--print-font-family);
              font-size: var(--print-font-size-base);
              line-height: var(--print-line-height);
              color: #111827;
            }
            .print-document .print-header {
              padding-top: var(--print-header-padding-top);
              padding-bottom: var(--print-header-padding-bottom);
              margin-bottom: var(--print-header-margin-bottom);
              border-bottom: var(--print-header-border-width) solid #d1d5db;
            }
            .print-document .print-header h1,
            .print-document .print-header .print-title {
              font-size: var(--print-header-font-size);
              font-weight: 700;
              margin: 0;
            }
            .print-document .print-header .print-subtitle {
              font-size: var(--print-header-sub-font-size);
              color: #4b5563;
              margin-top: 0.125rem;
            }
            .print-document .print-footer {
              margin-top: var(--print-footer-margin-top);
              padding-top: var(--print-footer-padding-top);
              border-top: var(--print-footer-border-width) dashed #d1d5db;
              font-size: var(--print-footer-font-size);
              color: #6b7280;
              text-align: center;
            }
            .print-document .print-section {
              margin-bottom: var(--print-section-margin-bottom);
            }
            .print-document .print-section h2 {
              font-size: var(--print-font-size-base);
              font-weight: 600;
              margin: 0 0 var(--print-section-inner-spacing) 0;
            }
            .print-document .print-section .print-row {
              margin-bottom: var(--print-section-inner-spacing);
            }
            @page {
              size: ${layout === 'thermal' ? '80mm auto' : 'A4'};
              margin: ${layout === 'thermal' ? '5mm' : '10mm'};
            }
            @media print {
              html,
              body {
                margin: 0;
                padding: 0;
                height: auto;
                background: white;
              }
              .min-h-screen {
                min-height: auto !important;
              }
              .print-hidden {
                display: none !important;
              }
            }
          `,
        }}
      />

      <div className="print-hidden mb-4 flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold">
            {type === 'receipt'
              ? tWorkflow('actions.printReceipt')
              : type === 'order-details'
                ? tWorkflow('itemsTitle')
                : type === 'invoices-payments-rprt'
                  ? (tWorkflow('actions.printInvoicesPaymentsA4Rprt') ?? 'Invoices & Payments (A4)')
                  : type === 'payments-rprt'
                    ? (tWorkflow('actions.printPaymentsA4DescRprt') ?? 'Payments (A4)')
                    : type === 'history-rprt'
                      ? (tWorkflow('actions.printOrderHistoryA4Rprt') ?? 'Order History (A4)')
                      : tWorkflow('itemsTitle')}
          </h1>
          <p className="text-sm text-gray-500">
            {layout === 'thermal' ? '80mm receipt layout' : 'A4 layout'} •{' '}
            {tCommon('print')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {tCommon('print')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center text-gray-500">
          {tCommon('loading')}
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (order || reportData) && (
        <div className="print-document px-4">
          {type === 'receipt' && order && (
            <OrderReceiptPrint order={order} layout={layout} />
          )}
          {type === 'order-details' && order && (
            <OrderDetailsPrint order={order} layout={layout} />
          )}
          {type === 'invoices-payments-rprt' && reportData && 'invoices' in reportData && (
            <OrderInvoicesPaymentsPrintRprt data={reportData} />
          )}
          {type === 'payments-rprt' && reportData && 'payments' in reportData && (
            <OrderPaymentsPrintRprt data={reportData} />
          )}
          {type === 'history-rprt' && reportData && 'history' in reportData && (
            <OrderHistoryPrintRprt data={reportData} />
          )}
        </div>
      )}
    </div>
  );
}

