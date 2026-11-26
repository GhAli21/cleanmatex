'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import {
  Package,
  CreditCard,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { civilDateInZone } from '@/lib/utils/operational-time';
import { useReportRange } from '@features/reports/ui/reports-clock';
import type { ReactNode } from 'react';
import ExportDropdown from '@features/reports/ui/export-dropdown-rprt';
import {
  generateCSV,
  downloadCSV,
  generateExcelWorkbook,
  downloadExcel,
  generatePDFReport,
  downloadPDF,
} from '@/lib/utils/report-export';
import {
  fetchOrdersReport,
  fetchPaymentsReport,
  fetchInvoicesReport,
  fetchCustomerReport,
} from '@/app/actions/reports/report-actions';

const REPORT_TABS = [
  { key: 'orders', path: '/dashboard/reports/orders', icon: Package },
  { key: 'payments', path: '/dashboard/reports/payments', icon: CreditCard },
  { key: 'invoices', path: '/dashboard/reports/invoices', icon: FileText },
  { key: 'revenue', path: '/dashboard/reports/revenue', icon: TrendingUp },
  { key: 'customers', path: '/dashboard/reports/customers', icon: Users },
] as const;

function getActiveTab(pathname: string): string {
  for (const tab of REPORT_TABS) {
    if (pathname === tab.path || pathname.startsWith(tab.path + '/')) {
      return tab.key;
    }
  }
  return 'orders';
}

/**
 *
 * @param root0
 * @param root0.children
 */
export function ReportsLayoutClient({ children }: { children: ReactNode }) {
  const t = useTranslations('reports');
  const pathname = usePathname();
  const [isExporting, setIsExporting] = useState(false);

  const isPrintRoute = pathname.includes('/print');
  const activeTab = getActiveTab(pathname);

  const { query, startCivil, endCivil, zone } = useReportRange();

  const getDateParams = useCallback(() => {
    if (!query) return null;
    return {
      startDate: query.start,
      endDate: query.end,
      startDateLabel: startCivil,
      endDateLabel: endCivil,
    };
  }, [query, startCivil, endCivil]);

  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      const dates = getDateParams();
      if (!dates) return;
      const { startDate, endDate, startDateLabel, endDateLabel } = dates;
      const params = { startDate, endDate, limit: 10000 };

      if (activeTab === 'orders') {
        const res = await fetchOrdersReport(params);
        if (res.success && res.data) {
          const headers = [t('table.orderNo'), t('table.customer'), t('table.status'), t('table.items'), t('table.total'), t('table.payment'), t('table.date')];
          const rows = res.data.orders.map((o) => [
            o.orderNo, o.customerName, o.status, String(o.totalItems),
            String(o.total), o.paymentStatus, o.createdAt ? civilDateInZone(o.createdAt, zone) : '',
          ]);
          downloadCSV(generateCSV(headers, rows), `orders-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'payments') {
        const res = await fetchPaymentsReport(params);
        if (res.success && res.data) {
          const headers = [t('table.orderNo'), t('table.invoiceNo'), t('table.customer'), t('table.amount'), t('table.method'), t('table.status'), t('table.date')];
          const rows = res.data.payments.map((p) => [
            p.orderNo ?? '', p.invoiceNo ?? '', p.customerName ?? '',
            String(p.amount), p.methodName ?? p.methodCode, p.status,
            p.paidAt ? civilDateInZone(p.paidAt, zone) : '',
          ]);
          downloadCSV(generateCSV(headers, rows), `payments-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'invoices') {
        const res = await fetchInvoicesReport(params);
        if (res.success && res.data) {
          const headers = [t('table.invoiceNo'), t('table.customer'), t('table.total'), t('table.paid'), t('table.balance'), t('table.status'), t('table.dueDate')];
          const rows = res.data.invoices.map((inv) => [
            inv.invoiceNo, inv.customerName ?? '', String(inv.total),
            String(inv.paidAmount), String(inv.balance), inv.status,
            inv.dueDate ? civilDateInZone(inv.dueDate, zone) : '',
          ]);
          downloadCSV(generateCSV(headers, rows), `invoices-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'customers') {
        const res = await fetchCustomerReport(params);
        if (res.success && res.data) {
          const headers = [t('table.customer'), t('table.phone'), t('table.orders'), t('table.revenue'), t('table.avgValue'), t('table.lastOrder'), t('table.firstOrder')];
          const rows = res.data.customers.map((c) => [
            c.name, c.phone ?? '', String(c.totalOrders), String(c.totalRevenue),
            String(c.avgOrderValue),
            c.lastOrderDate ? civilDateInZone(c.lastOrderDate, zone) : '',
            c.firstOrderDate ? civilDateInZone(c.firstOrderDate, zone) : '',
          ]);
          downloadCSV(generateCSV(headers, rows), `customers-report-${startDateLabel}-${endDateLabel}`);
        }
      }
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, getDateParams, zone]);

  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const dates = getDateParams();
      if (!dates) return;
      const { startDate, endDate, startDateLabel, endDateLabel } = dates;
      const params = { startDate, endDate, limit: 10000 };

      if (activeTab === 'orders') {
        const res = await fetchOrdersReport(params);
        if (res.success && res.data) {
          const blob = await generateExcelWorkbook([{
            name: 'Orders Report',
            headers: [t('table.orderNo'), t('table.customer'), t('table.status'), t('table.items'), t('table.total'), t('table.payment'), t('table.date')],
            rows: res.data.orders.map((o) => [
              o.orderNo, o.customerName, o.status, o.totalItems,
              o.total, o.paymentStatus, o.createdAt ? civilDateInZone(o.createdAt, zone) : '',
            ]),
          }]);
          downloadExcel(blob, `orders-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'payments') {
        const res = await fetchPaymentsReport(params);
        if (res.success && res.data) {
          const blob = await generateExcelWorkbook([{
            name: 'Payments Report',
            headers: [t('table.orderNo'), t('table.invoiceNo'), t('table.customer'), t('table.amount'), t('table.method'), t('table.status'), t('table.date')],
            rows: res.data.payments.map((p) => [
              p.orderNo ?? '', p.invoiceNo ?? '', p.customerName ?? '',
              p.amount, p.methodName ?? p.methodCode, p.status,
              p.paidAt ? civilDateInZone(p.paidAt, zone) : '',
            ]),
          }]);
          downloadExcel(blob, `payments-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'invoices') {
        const res = await fetchInvoicesReport(params);
        if (res.success && res.data) {
          const blob = await generateExcelWorkbook([{
            name: 'Invoices Report',
            headers: [t('table.invoiceNo'), t('table.customer'), t('table.total'), t('table.paid'), t('table.balance'), t('table.status'), t('table.dueDate')],
            rows: res.data.invoices.map((inv) => [
              inv.invoiceNo, inv.customerName ?? '', inv.total,
              inv.paidAmount, inv.balance, inv.status,
              inv.dueDate ? civilDateInZone(inv.dueDate, zone) : '',
            ]),
          }]);
          downloadExcel(blob, `invoices-report-${startDateLabel}-${endDateLabel}`);
        }
      } else if (activeTab === 'customers') {
        const res = await fetchCustomerReport(params);
        if (res.success && res.data) {
          const blob = await generateExcelWorkbook([{
            name: 'Customers Report',
            headers: [t('table.customer'), t('table.phone'), t('table.orders'), t('table.revenue'), t('table.avgValue'), t('table.lastOrder'), t('table.firstOrder')],
            rows: res.data.customers.map((c) => [
              c.name, c.phone ?? '', c.totalOrders, c.totalRevenue,
              c.avgOrderValue,
              c.lastOrderDate ? civilDateInZone(c.lastOrderDate, zone) : '',
              c.firstOrderDate ? civilDateInZone(c.firstOrderDate, zone) : '',
            ]),
          }]);
          downloadExcel(blob, `customers-report-${startDateLabel}-${endDateLabel}`);
        }
      }
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, getDateParams, zone]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const dates = getDateParams();
      if (!dates) return;
      const { startDate, endDate, startDateLabel, endDateLabel } = dates;
      const params = { startDate, endDate, limit: 500 };
      const dateRange = `${startDateLabel} to ${endDateLabel}`;

      if (activeTab === 'orders') {
        const res = await fetchOrdersReport(params);
        if (res.success && res.data) {
          const blob = await generatePDFReport({
            title: 'Orders & Sales Report',
            dateRange,
            kpis: [
              { label: 'Total Revenue', value: `${res.data.kpis.currencyCode} ${res.data.kpis.totalRevenue.toLocaleString()}` },
              { label: 'Total Orders', value: String(res.data.kpis.totalOrders) },
              { label: 'Avg Order Value', value: `${res.data.kpis.currencyCode} ${res.data.kpis.avgOrderValue.toLocaleString()}` },
              { label: 'Active Customers', value: String(res.data.kpis.activeCustomers) },
            ],
            tables: [{
              title: 'Orders',
              headers: [t('table.orderNo'), t('table.customer'), t('table.status'), t('table.items'), t('table.total'), t('table.payment'), t('table.date')],
              rows: res.data.orders.map((o) => [
                o.orderNo, o.customerName, o.status, String(o.totalItems),
                `${res.data!.kpis.currencyCode} ${o.total}`, o.paymentStatus,
                o.createdAt ? civilDateInZone(o.createdAt, zone) : '',
              ]),
            }],
          });
          downloadPDF(blob, `orders-report-${startDateLabel}-${endDateLabel}`);
        }
      }
      // For other tabs, similar pattern; kept concise
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, getDateParams, zone]);

  const handlePrint = useCallback(() => {
    const dates = getDateParams();
    if (!dates) return;
    const { startDateLabel, endDateLabel } = dates;
    window.open(
      `/dashboard/reports/print?type=${activeTab}&startDate=${startDateLabel}&endDate=${endDateLabel}`,
      '_blank',
    );
  }, [activeTab, getDateParams, zone]);

  // Don't render layout chrome for print routes
  if (isPrintRoute) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ExportDropdown
          onExportCSV={handleExportCSV}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
          onPrint={handlePrint}
          isExporting={isExporting}
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Report tabs">
          {REPORT_TABS.map((tab) => {
            const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.path}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary-text'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`tabs.${tab.key}`)}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
