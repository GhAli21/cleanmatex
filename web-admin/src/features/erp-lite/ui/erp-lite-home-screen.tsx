'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FileSearch,
  Landmark,
  LayoutDashboard,
  Link2,
  ListOrdered,
  Scale,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import type { ErpLiteTenantReadiness } from '@/lib/types/erp-lite-ops'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'
import { Alert, AlertDescription } from '@ui/primitives'

export interface ErpLiteHomeVisibility {
  readiness: boolean
  usageMaps: boolean
  exceptions: boolean
  periods: boolean
  coa: boolean
  gl: boolean
  journals: boolean
  reports: boolean
  postingAudit: boolean
  financeActions: boolean
  setup: boolean
}

interface ErpLiteHomeScreenProps {
  readiness: ErpLiteTenantReadiness | null
  openPeriodCode: string | null
  visibility: ErpLiteHomeVisibility
  loadError: string | null
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function ShortcutCard({
  href,
  title,
  description,
  openLabel,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  openLabel: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Link href={href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <CmxCard className="h-full transition-colors hover:bg-muted/40">
        <CmxCardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CmxCardTitle className="text-base font-semibold">{title}</CmxCardTitle>
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        </CmxCardHeader>
        <CmxCardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            <span>{openLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </CmxCardContent>
      </CmxCard>
    </Link>
  )
}

export function ErpLiteHomeScreen({
  readiness,
  openPeriodCode,
  visibility,
  loadError,
}: ErpLiteHomeScreenProps) {
  const t = useTranslations('erpLite.home')
  const tCommon = useTranslations('erpLite.common')

  const shortcuts: Array<{
    key: keyof ErpLiteHomeVisibility
    href: string
    title: string
    description: string
    icon: ComponentType<{ className?: string }>
  }> = [
    {
      key: 'readiness',
      href: '/dashboard/erp-lite/readiness',
      title: t('shortcuts.readiness.title'),
      description: t('shortcuts.readiness.description'),
      icon: ShieldCheck,
    },
    {
      key: 'usageMaps',
      href: '/dashboard/erp-lite/usage-maps',
      title: t('shortcuts.usageMaps.title'),
      description: t('shortcuts.usageMaps.description'),
      icon: Link2,
    },
    {
      key: 'periods',
      href: '/dashboard/erp-lite/periods',
      title: t('shortcuts.periods.title'),
      description: t('shortcuts.periods.description'),
      icon: LayoutDashboard,
    },
    {
      key: 'exceptions',
      href: '/dashboard/erp-lite/exceptions',
      title: t('shortcuts.exceptions.title'),
      description: t('shortcuts.exceptions.description'),
      icon: ClipboardList,
    },
    {
      key: 'coa',
      href: '/dashboard/erp-lite/coa',
      title: t('shortcuts.coa.title'),
      description: t('shortcuts.coa.description'),
      icon: BookOpen,
    },
    {
      key: 'gl',
      href: '/dashboard/erp-lite/gl',
      title: t('shortcuts.gl.title'),
      description: t('shortcuts.gl.description'),
      icon: Scale,
    },
    {
      key: 'journals',
      href: '/dashboard/erp-lite/journals',
      title: t('shortcuts.journals.title'),
      description: t('shortcuts.journals.description'),
      icon: ListOrdered,
    },
    {
      key: 'reports',
      href: '/dashboard/erp-lite/reports',
      title: t('shortcuts.reports.title'),
      description: t('shortcuts.reports.description'),
      icon: FileSearch,
    },
    {
      key: 'postingAudit',
      href: '/dashboard/erp-lite/posting-audit',
      title: t('shortcuts.postingAudit.title'),
      description: t('shortcuts.postingAudit.description'),
      icon: Landmark,
    },
    {
      key: 'financeActions',
      href: '/dashboard/erp-lite/finance-actions',
      title: t('shortcuts.financeActions.title'),
      description: t('shortcuts.financeActions.description'),
      icon: ShieldCheck,
    },
    {
      key: 'setup',
      href: '/dashboard/erp-lite/setup',
      title: t('shortcuts.setup.title'),
      description: t('shortcuts.setup.description'),
      icon: Wrench,
    },
  ]

  const visibleShortcuts = shortcuts.filter((s) => visibility[s.key])
  const openLabel = t('shortcuts.open')

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">ERP-Lite</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      {!loadError && readiness && (
        <div className="grid gap-4 lg:grid-cols-2">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('snapshot.title')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3">
              <StatLine label={t('snapshot.status')} value={readiness.readiness_status} />
              <StatLine
                label={t('snapshot.missingMappings')}
                value={`${readiness.missing_required_mappings} / ${readiness.total_required_mappings}`}
              />
              <StatLine
                label={t('snapshot.openExceptions')}
                value={String(readiness.open_exception_count)}
              />
              <StatLine label={t('snapshot.openPeriods')} value={String(readiness.open_period_count)} />
              <StatLine
                label={t('snapshot.currentOpenPeriod')}
                value={openPeriodCode ?? t('snapshot.none')}
              />
            </CmxCardContent>
          </CmxCard>
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('governance.title')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{t('governance.body')}</p>
              {visibility.readiness ? (
                <Link href="/dashboard/erp-lite/readiness" className="font-medium text-primary hover:underline">
                  {t('governance.linkReadiness')}
                </Link>
              ) : null}
            </CmxCardContent>
          </CmxCard>
        </div>
      )}

      {!loadError && !readiness && (
        <Alert>
          <AlertDescription>{tCommon('loadError')}</AlertDescription>
        </Alert>
      )}

      {visibleShortcuts.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">{t('shortcuts.sectionTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleShortcuts.map((s) => (
              <ShortcutCard
                key={s.key}
                href={s.href}
                title={s.title}
                description={s.description}
                openLabel={openLabel}
                icon={s.icon}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
