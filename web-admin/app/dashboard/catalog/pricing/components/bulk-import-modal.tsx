'use client'

/**
 * Bulk Import Modal
 * Import price list items from CSV
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from '@ui/compat'
import { Download, Upload, X } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '@/src/ui/feedback/cmx-toast'

interface BulkImportModalProps {
  open: boolean
  onClose: () => void
  priceListId: string
  onSuccess: () => void
}

export function BulkImportModal({
  open,
  onClose,
  priceListId,
  onSuccess,
}: BulkImportModalProps) {
  const t = useTranslations('catalog')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<any>(null)

  // Download template
  async function downloadTemplate() {
    try {
      const res = await fetch('/api/v1/pricing/template')
      if (!res.ok) throw new Error('Failed to download template')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'price-list-import-template.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showSuccessToast('Template downloaded')
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to download template')
    }
  }

  // Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      showErrorToast('Please select a CSV file')
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
      if (!res.ok) throw new Error(json?.error || 'Failed to import')

      if (json.errors && json.errors.length > 0) {
        showErrorToast(`Import completed with ${json.errors.length} errors. ${json.imported} items imported.`)
      } else {
        showSuccessToast(`Successfully imported ${json.imported} items`)
      }

      onSuccess()
    } catch (err: any) {
      showErrorToast(err.message || 'Failed to import')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Price List Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium mb-2">Import Instructions</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
              <li>Download the CSV template</li>
              <li>Fill in product codes/IDs, prices, discounts, and quantity ranges</li>
              <li>Upload the completed CSV file</li>
              <li>Review validation results before confirming</li>
            </ol>
          </div>

          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium">CSV Template</p>
              <p className="text-sm text-gray-500">Download template with required columns</p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Select CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div>
              <h3 className="font-medium mb-2">Preview ({preview.totalRows} rows)</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((header: string, i: number) => (
                          <th key={i} className="px-3 py-2 text-left border-b">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row: string[], i: number) => (
                        <tr key={i} className="border-b">
                          {row.map((cell: string, j: number) => (
                            <td key={j} className="px-3 py-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Import'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

