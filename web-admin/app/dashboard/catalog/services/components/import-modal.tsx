'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

interface ImportResult {
  success: boolean
  totalRows: number
  validRows: number
  invalidRows: number
  imported: number
  skipped: number
  errors: { row: number; field: string; message: string }[]
}

interface ImportModalProps {
  onClose: () => void
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const t = useTranslations('catalog')
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
  const sampleAdvanced = 'product_code,product_name,product_name_ar,category_code,price_regular,price_express,unit,min_qty,turnaround_hh,turnaround_hh_express,is_active\nPROD-00002,Dress,فستان,DRY_CLEAN,2.500,3.000,piece,1,24,12,true'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-3xl p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t('import')}</h2>
          <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm font-medium">{t('downloadTemplate')}</label>
              <div className="flex gap-2">
                <Button type="button" variant={template === 'basic' ? 'default' : 'secondary'} onClick={() => setTemplate('basic')}>
                  {t('basicTemplate')}
                </Button>
                <Button type="button" variant={template === 'advanced' ? 'default' : 'secondary'} onClick={() => setTemplate('advanced')}>
                  {t('advancedTemplate')}
                </Button>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <div className="mb-1 font-medium">CSV</div>
                <pre className="overflow-auto rounded bg-gray-50 p-2 text-xs">
                  {template === 'basic' ? sampleBasic : sampleAdvanced}
                </pre>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{t('uploadFile')}</label>
              <Input as="textarea" rows={10} value={csv} onChange={(e: any) => setCsv(e.target.value)} placeholder={template === 'basic' ? sampleBasic : sampleAdvanced} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="submit" disabled={submitting}>{submitting ? t('loading') : t('import')}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>{t('close')}</Button>
          </div>
        </form>

        {result && (
          <div className="mt-4">
            <h3 className="mb-2 text-lg font-medium">{t('validationErrors')}</h3>
            {result.errors.length === 0 ? (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-700">{t('importSuccess')}</div>
            ) : (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-800">
                {result.errors.slice(0, 50).map((er, idx) => (
                  <div key={idx} className="text-xs">Row {er.row} • {er.field}: {er.message}</div>
                ))}
                {result.errors.length > 50 && <div className="text-xs">+{result.errors.length - 50} more...</div>}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
