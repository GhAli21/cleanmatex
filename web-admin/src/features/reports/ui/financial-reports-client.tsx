'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { CmxTabsPanel } from '@ui/navigation';
import { Badge } from '@ui/primitives/badge';
import { cmxMessage } from '@ui/feedback';

type OrderRow = {
  id: string;
  order_no: string | null;
  created_at: string;
  payment_status: string | null;
  total_paid_amount: number | null;
  total_tax_amount: number | null;
  total_discount_amount: number | null;
  outstanding_amount: number | null;
  currency_code: string | null;
};

type KPIs = {
  totalOrders: number;
  grossRevenue: number;
  totalTax: number;
  totalDiscounts: number;
};

type PaymentRow = {
  methodId: string | null;
  method: { id: string; display_name: string; payment_method_code: string } | null;
  totalAmount: number;
  count: number;
};

type TaxRow = {
  taxType: string;
  label: string;
  baseAmount: number;
  taxAmount: number;
  orderCount: number;
};

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return '—';
  return `${currency ?? ''} ${n.toFixed(3)}`.trim();
}

export function FinancialReportsClient() {
  const t = useTranslations('reports.financial');
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());

  // Orders tab state
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Payments tab state
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Tax tab state
  const [taxRows, setTaxRows] = useState<TaxRow[]>([]);
  const [taxGrandTotal, setTaxGrandTotal] = useState(0);
  const [taxLoading, setTaxLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('orders');

  const fetchOrdersSummary = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/v1/finance/reports/orders-summary?from=${from}&to=${to}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders);
        setKpis(data.data.kpis);
      } else {
        cmxMessage.error(data.error ?? 'Failed to load report');
      }
    } catch {
      cmxMessage.error('Failed to load orders summary');
    } finally {
      setOrdersLoading(false);
    }
  }, [from, to]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await fetch(`/api/v1/finance/reports/payments-breakdown?from=${from}&to=${to}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPayments(data.data);
      } else {
        cmxMessage.error(data.error ?? 'Failed to load report');
      }
    } catch {
      cmxMessage.error('Failed to load payments breakdown');
    } finally {
      setPaymentsLoading(false);
    }
  }, [from, to]);

  const fetchTax = useCallback(async () => {
    setTaxLoading(true);
    try {
      const res = await fetch(`/api/v1/finance/reports/tax-report?from=${from}&to=${to}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setTaxRows(data.data.rows);
        setTaxGrandTotal(data.data.grandTotal);
      } else {
        cmxMessage.error(data.error ?? 'Failed to load report');
      }
    } catch {
      cmxMessage.error('Failed to load tax report');
    } finally {
      setTaxLoading(false);
    }
  }, [from, to]);

  const handleApply = () => {
    if (activeTab === 'orders') fetchOrdersSummary();
    else if (activeTab === 'payments') fetchPayments();
    else fetchTax();
  };

  const orderColumns = [
    {
      key: 'order_no',
      header: t('orderNo'),
      render: (o: OrderRow) => <span className="font-mono font-medium">{o.order_no ?? '—'}</span>,
    },
    {
      key: 'date',
      header: t('date'),
      render: (o: OrderRow) => <span className="text-sm">{new Date(o.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'payment_status',
      header: t('paymentStatus'),
      render: (o: OrderRow) => o.payment_status
        ? <Badge variant="outline" className="text-xs">{o.payment_status}</Badge>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'tax',
      header: t('tax'),
      render: (o: OrderRow) => <span className="font-mono text-sm">{fmt(o.total_tax_amount, o.currency_code)}</span>,
    },
    {
      key: 'discounts',
      header: t('discounts'),
      render: (o: OrderRow) => <span className="font-mono text-sm">{fmt(o.total_discount_amount, o.currency_code)}</span>,
    },
    {
      key: 'total',
      header: t('grandTotal'),
      render: (o: OrderRow) => <span className="font-mono font-medium">{fmt(o.total_paid_amount, o.currency_code)}</span>,
    },
  ];

  const paymentColumns = [
    {
      key: 'method',
      header: t('paymentMethod'),
      render: (p: PaymentRow) => (
        <div>
          <div className="font-medium">{p.method?.display_name ?? '—'}</div>
          {p.method?.payment_method_code && <div className="text-xs text-muted-foreground font-mono">{p.method.payment_method_code}</div>}
        </div>
      ),
    },
    {
      key: 'count',
      header: t('count'),
      render: (p: PaymentRow) => <span className="tabular-nums">{p.count}</span>,
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (p: PaymentRow) => <span className="font-mono font-medium">{p.totalAmount.toFixed(3)}</span>,
    },
  ];

  const taxColumns = [
    {
      key: 'type',
      header: t('taxType'),
      render: (r: TaxRow) => <Badge variant="outline">{r.taxType}</Badge>,
    },
    {
      key: 'label',
      header: t('label'),
      render: (r: TaxRow) => <span>{r.label}</span>,
    },
    {
      key: 'taxable',
      header: t('taxableAmount'),
      render: (r: TaxRow) => <span className="font-mono">{r.baseAmount.toFixed(3)}</span>,
    },
    {
      key: 'tax',
      header: t('taxAmount'),
      render: (r: TaxRow) => <span className="font-mono font-medium">{r.taxAmount.toFixed(3)}</span>,
    },
    {
      key: 'orders',
      header: t('orderCount'),
      render: (r: TaxRow) => <span className="tabular-nums">{r.orderCount}</span>,
    },
  ];

  const filterBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium shrink-0">{t('periodFrom')}</label>
        <input
          type="date"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium shrink-0">{t('periodTo')}</label>
        <input
          type="date"
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <CmxButton onClick={handleApply}>{t('apply')}</CmxButton>
    </div>
  );

  const tabs = [
    {
      id: 'orders',
      label: t('ordersSummary'),
      content: (
        <div>
          {filterBar}
          {kpis && (
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <CmxCard>
                <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalOrders')}</CmxCardTitle></CmxCardHeader>
                <CmxCardContent><span className="text-2xl font-bold">{kpis.totalOrders}</span></CmxCardContent>
              </CmxCard>
              <CmxCard>
                <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('grossRevenue')}</CmxCardTitle></CmxCardHeader>
                <CmxCardContent><span className="text-2xl font-bold">{kpis.grossRevenue.toFixed(3)}</span></CmxCardContent>
              </CmxCard>
              <CmxCard>
                <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalTax')}</CmxCardTitle></CmxCardHeader>
                <CmxCardContent><span className="text-2xl font-bold">{kpis.totalTax.toFixed(3)}</span></CmxCardContent>
              </CmxCard>
              <CmxCard>
                <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalDiscounts')}</CmxCardTitle></CmxCardHeader>
                <CmxCardContent><span className="text-2xl font-bold">{kpis.totalDiscounts.toFixed(3)}</span></CmxCardContent>
              </CmxCard>
            </div>
          )}
          {ordersLoading
            ? <p className="text-sm text-muted-foreground">{t('loading')}</p>
            : orders.length === 0
            ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
            : <CmxDataTable columns={orderColumns} data={orders} />
          }
        </div>
      ),
    },
    {
      id: 'payments',
      label: t('paymentsBreakdown'),
      content: (
        <div>
          {filterBar}
          {paymentsLoading
            ? <p className="text-sm text-muted-foreground">{t('loading')}</p>
            : payments.length === 0
            ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
            : <CmxDataTable columns={paymentColumns} data={payments} />
          }
        </div>
      ),
    },
    {
      id: 'tax',
      label: t('taxReport'),
      content: (
        <div>
          {filterBar}
          {taxLoading
            ? <p className="text-sm text-muted-foreground">{t('loading')}</p>
            : taxRows.length === 0
            ? <p className="text-sm text-muted-foreground">{t('empty')}</p>
            : (
              <div className="space-y-3">
                <CmxDataTable columns={taxColumns} data={taxRows} />
                <div className="flex justify-end rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-medium">
                  {t('grandTotalRow')}: <span className="ms-2 font-mono font-bold">{taxGrandTotal.toFixed(3)}</span>
                </div>
                <div className="flex justify-end">
                  <a
                    href={`/api/v1/finance/reports/tax-report?from=${from}&to=${to}&format=csv`}
                    className="text-sm text-primary underline"
                  >
                    {t('exportCSV')}
                  </a>
                </div>
              </div>
            )
          }
        </div>
      ),
    },
  ];

  return (
    <CmxTabsPanel
      tabs={tabs}
      onChange={(id) => setActiveTab(id)}
    />
  );
}
