'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Circle } from 'lucide-react'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

const STEP_KEYS = [
  { href: '/dashboard/erp-lite/readiness', key: 'readiness' as const },
  { href: '/dashboard/erp-lite/usage-maps', key: 'usageMaps' as const },
  { href: '/dashboard/erp-lite/periods', key: 'periods' as const },
  { href: '/dashboard/erp-lite/coa', key: 'coa' as const },
  { href: '/dashboard/erp-lite/gl', key: 'gl' as const },
] as const

const STORAGE_KEY = 'erp_lite_setup_wizard_v1'

function readDone(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function ErpLiteSetupWizardScreen() {
  const t = useTranslations('erpLite.setup')
  const [done, setDone] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    setDone(readDone())
  }, [])

  const toggle = (key: string) => {
    const prev = readDone()
    const next = { ...prev, [key]: !prev[key] }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setDone(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">ERP-Lite</p>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('stepsTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3">
          {STEP_KEYS.map((step, idx) => {
            const isDone = Boolean(done[step.key])
            return (
              <div
                key={step.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-medium">{t(`steps.${step.key}.title`)}</div>
                    <p className="text-sm text-muted-foreground">{t(`steps.${step.key}.description`)}</p>
                    <Link href={step.href} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
                      {t('openStep')}
                    </Link>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(step.key)}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                  {isDone ? t('markUndone') : t('markDone')}
                </button>
              </div>
            )
          })}
        </CmxCardContent>
      </CmxCard>
      <p className="text-xs text-muted-foreground">{t('persistHint')}</p>
    </div>
  )
}
