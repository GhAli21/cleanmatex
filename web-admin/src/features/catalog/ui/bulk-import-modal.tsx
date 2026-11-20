'use client'

/**
 * Bulk Import Modal
 * Import price list items from CSV
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'
import { CmxButton, Label } from '@ui/primitives'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table'
import { Download, Upload } from 'lucide-react'
import { cmxMessage } from '@ui/feedback'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'

interface BulkImportModalProps {
  open: boolean
  onClose: () => void
  priceListId: string
  onSuccess: () => void
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.priceListId
 * @param root0.onSuccess
 */
export function BulkImportModal({
  open,
  onClose,
  priceListId,
  onSuccess,
}: BulkImportModalProps) {
  const t = useTranslations('catalog.bulkImport')
  const tCatalog = useTranslations('catalog')
  const tCommon = useTranslations('common')
  const { formatNumber } = useTenantCurrency()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][]; totalRows: number } | null>(null)

  // Download template
  async function downloadTemplate() {
    try {
      const res = await fetch('/api/v1/pricing/template')
      if (!res.ok) throw new Error(t('templateDownloadError'))

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'price-list-import-template.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      cmxMessage.success(t('templateDownloaded'))
    } catch (err: unknown) {
      cmxMessage.error(err instanceof Error ? err.message : t('templateDownloadError'))
    }
  }

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      cmxMessage.error(t('selectCsvPrompt'))
      return
    }

    setFile(selectedFile)

    // Preview file
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length > 0) {
        const headers = lines[0].split(',')
        const rows = lines.slice(1, 6).map((line) => line.split(',')) // Preview first 5 rows
        setPreview({ headers, rows, totalRows: lines.length - 1 })
      }
    }
    reader.readAsText(selectedFile)
  }

  // Handle upload
  async function handleUpload() {
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('priceListId', priceListId)

      const res = await fetch('/api/v1/pricing/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || t('importError'))

      if (json.errors && json.errors.length > 0) {
        cmxMessage.error(
          t('importPartial', {
            errors: formatNumber(json.errors.length),
            imported: formatNumber(json.imported),
          })
        )
      } else {
        cmxMessage.success(t('importSuccess', { imported: formatNumber(json.imported) }))
      }

      onSuccess()
    } catch (err: unknown) {
      cmxMessage.error(err instanceof Error ? err.message : t('importError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <CmxDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-info-bg border border-info-border rounded-lg p-4">
            <h3 className="font-medium mb-2">{t('instructionsTitle')}</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-foreground">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
              <li>{t('step4')}</li>
            </ol>
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium">{t('csvTemplateTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('csvTemplateDescription')}</p>
            </div>
            <CmxButton variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 me-2" />
              {tCatalog('downloadTemplate')}
            </CmxButton>
          </div>

          {/* File Upload */}
          <div>
            <Label className="block mb-2">{t('selectFileLabel')}</Label>
            {/* cmx-ds-ignore UI001: native file input required for CSV upload */}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-border rounded-lg"
            />
            {file && (
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {t('selectedFileSummary', {
                  name: file.name,
                  kb: formatNumber((file.size / 1024), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
              </p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div>
              <h3 className="font-medium mb-2 tabular-nums">
                {t('previewTitle', { rows: formatNumber(preview.totalRows) })}
              </h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <Table className="min-w-full text-sm">
                    <TableHeader className="bg-muted">
                      <TableRow>
                        {preview.headers.map((header: string, i: number) => (
                          <TableHead key={i} className="px-3 py-2 text-start border-b">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.rows.map((row: string[], i: number) => (
                        <TableRow key={i} className="border-b">
                          {row.map((cell: string, j: number) => (
                            <TableCell key={j} className="px-3 py-2">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              <Upload className="w-4 h-4 me-2" />
              {uploading ? t('uploading') : tCommon('import')}
            </CmxButton>
          </CmxDialogFooter>
        </div>
      </CmxDialogContent>
    </CmxDialog>
  )
}
