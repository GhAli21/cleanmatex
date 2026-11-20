'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxTextarea, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

interface ImportResult {
  success: boolean
  totalRows: number
  validRows: number
  invalidRows: number
  imported: number
  skipped: number
  errors: { row: number; field: string; message: string; code?: string }[]
}

interface ImportModalProps {
  onClose: () => void
}

/**
 *
 * @param root0
 * @param root0.onClose
 */
export default function ImportModal({ onClose }: ImportModalProps) {
  const t = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const [template, setTemplate] = useState<'basic' | 'advanced'>('advanced')
  const [csv, setCsv] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/v1/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, data: csv }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Import failed')
      setResult(json.data)
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const sampleBasic = 'product_code,product_name,product_name_ar,category_code,price,unit\nPROD-00001,Shirt,قميص,LAUNDRY,1.000,piece'
  const sampleAdvanced = 'product_code,product_name,product_name_ar,category_code,price_regular,price_express,express_multiplier,unit,min_qty,turnaround_hh,turnaround_hh_express,tax_category_code,is_active\nPROD-00002,Dress,فستان,DRY_CLEAN,2.500,3.000,,piece,1,24,12,STANDARD,true'

  return (
    <CmxDialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <CmxDialogContent className="w-full max-w-3xl" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle>{tCommon('import')}</CmxDialogTitle>
        </CmxDialogHeader>

        {error && (
          <div className="mb-3 rounded-md border border-danger-border bg-danger-bg p-3 text-danger-text">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <Label className="mb-1 block text-sm font-medium">{t('downloadTemplate')}</Label>
              <div className="flex gap-2">
                <CmxButton type="button" variant={template === 'basic' ? 'primary' : 'secondary'} onClick={() => setTemplate('basic')}>
                  {t('basicTemplate')}
                </CmxButton>
                <CmxButton type="button" variant={template === 'advanced' ? 'primary' : 'secondary'} onClick={() => setTemplate('advanced')}>
                  {t('advancedTemplate')}
                </CmxButton>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {/* cmx-ds-ignore UI008: standard file format acronym CSV */}
                <div className="mb-1 font-medium">CSV</div>
                <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                  {template === 'basic' ? sampleBasic : sampleAdvanced}
                </pre>
                {template === 'advanced' ? <p className="mt-1">{t('importAdvancedHint')}</p> : null}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label className="mb-1 block text-sm font-medium">{t('uploadFile')}</Label>
              <CmxTextarea rows={10} value={csv} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCsv(e.target.value)} placeholder={template === 'basic' ? sampleBasic : sampleAdvanced} />
            </div>
          </div>

          <CmxDialogFooter className="justify-between">
            <CmxButton type="submit" disabled={submitting} loading={submitting}>{submitting ? tCommon('loading') : tCommon('import')}</CmxButton>
            <CmxButton type="button" variant="secondary" onClick={onClose}>{t('close')}</CmxButton>
          </CmxDialogFooter>
        </form>

        {result && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-medium">{t('validationErrors')}</h3>
            {result.errors.length === 0 ? (
              <div className="rounded-md border border-success-border bg-success-bg p-3 text-success-text">{t('importSuccess')}</div>
            ) : (
              <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-warning-text">
                {result.errors.slice(0, 50).map((er, idx) => (
                  <div key={idx} className="text-xs">Row {er.row} • {er.field}: {er.code && t.has(`importErrors.${er.code}`) ? t(`importErrors.${er.code}` as never) : er.message}</div>
                ))}
                {result.errors.length > 50 && <div className="text-xs">+{result.errors.length - 50} more...</div>}
              </div>
            )}
          </div>
        )}
      </CmxDialogContent>
    </CmxDialog>
  )
}
