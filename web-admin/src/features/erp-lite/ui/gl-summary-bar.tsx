import { useTranslations } from 'next-intl'
import { ArrowUpRight, ArrowDownLeft, Rows3 } from 'lucide-react'
import type { ErpLiteGlSummary } from '@/lib/services/erp-lite-reporting.service'

interface GlSummaryBarProps {
  summary: ErpLiteGlSummary
}

/**
 * Stat cards showing total debit, total credit, and row count
 * for the currently active GL filter set.
 */
export function GlSummaryBar({ summary }: GlSummaryBarProps) {
  const t = useTranslations('erpLite.reports')

  const balance = summary.totalDebit - summary.totalCredit
  const isBalanced = Math.abs(balance) < 0.0001

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={<ArrowUpRight className="h-4 w-4 text-red-500" />}
        label={t('summary.totalDebit')}
        value={summary.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        valueClass="text-red-600"
      />
      <StatCard
        icon={<ArrowDownLeft className="h-4 w-4 text-emerald-500" />}
        label={t('summary.totalCredit')}
        value={summary.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        valueClass="text-emerald-600"
      />
      <StatCard
        icon={<Rows3 className="h-4 w-4 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />}
        label={t('gl.summary.rowCount')}
        value={summary.rowCount.toLocaleString()}
        sub={
          isBalanced ? (
            <span className="text-emerald-600">{t('gl.summary.balanced')}</span>
          ) : (
            <span className="text-red-500">{t('gl.summary.unbalanced')}</span>
          )
        }
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  valueClass,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
  sub?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${valueClass ?? 'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]'}`}>
        {value}
      </div>
      {sub && <div className="text-xs">{sub}</div>}
    </div>
  )
}
