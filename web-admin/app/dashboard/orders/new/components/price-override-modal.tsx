'use client'

/**
 * Price Override Modal
 * Allows authorized users to manually override item prices
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Info } from 'lucide-react'
import { showSuccessToast, showErrorToast } from '@/src/ui/feedback/cmx-toast'

interface PriceOverrideModalProps {
    open: boolean
    onClose: () => void
    item: {
        id: string
        productName: string
        quantity: number
        calculatedPrice: number
        currentPrice?: number
    }
    onSave: (override: { price: number; reason: string }) => void
    hasPermission: boolean
}

export function PriceOverrideModal({
    open,
    onClose,
    item,
    onSave,
    hasPermission,
}: PriceOverrideModalProps) {
    const t = useTranslations('newOrder')
    const isRTL = useRTL()
    const [overridePrice, setOverridePrice] = useState(
        item.currentPrice ? String(item.currentPrice) : String(item.calculatedPrice)
    )
    const [reason, setReason] = useState('')
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Reset form when modal opens/closes or item changes
    useEffect(() => {
        if (open) {
            setOverridePrice(
                item.currentPrice ? String(item.currentPrice) : String(item.calculatedPrice)
            )
            setReason('')
            setErrors({})
        }
    }, [open, item])

    function validate(): boolean {
        const newErrors: Record<string, string> = {}

        const price = parseFloat(overridePrice)
        if (isNaN(price) || price < 0) {
            newErrors.price = 'Price must be a valid number >= 0'
        }

        if (!reason.trim()) {
            newErrors.reason = 'Reason is required for price override'
        }

        if (reason.trim().length < 10) {
            newErrors.reason = 'Reason must be at least 10 characters'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    async function handleSave() {
        if (!validate()) return

        setSaving(true)
        try {
            const price = parseFloat(overridePrice)
            onSave({
                price,
                reason: reason.trim(),
            })
            showSuccessToast('Price override applied successfully')
            onClose()
        } catch (err: any) {
            showErrorToast(err.message || 'Failed to apply price override')
        } finally {
            setSaving(false)
        }
    }

    if (!hasPermission) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Permission Denied</DialogTitle>
                    </DialogHeader>
                    <div className={`flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">Access Denied</p>
                            <p className="text-sm text-red-700 mt-1">
                                You do not have permission to override prices. Please contact your administrator.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    const priceDiff = parseFloat(overridePrice) - item.calculatedPrice
    const priceDiffPercent = item.calculatedPrice > 0
        ? ((priceDiff / item.calculatedPrice) * 100).toFixed(1)
        : '0'

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Override Price</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Item Info */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">{item.productName}</p>
                        <div className={`flex items-center gap-4 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span>Quantity: {item.quantity}</span>
                            <span>Calculated Price: {item.calculatedPrice.toFixed(3)} OMR</span>
                        </div>
                    </div>

                    {/* Current Calculated Price (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Calculated Price (Read-only)
                        </label>
                        <Input
                            value={item.calculatedPrice.toFixed(3)}
                            disabled
                            className="bg-gray-50"
                        />
                    </div>

                    {/* Override Price */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Override Price (OMR) *
                        </label>
                        <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={overridePrice}
                            onChange={(e) => setOverridePrice(e.target.value)}
                            required
                        />
                        {errors.price && (
                            <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                        )}
                        {!errors.price && priceDiff !== 0 && (
                            <p className={`mt-1 text-sm ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(3)} OMR ({priceDiffPercent}%)
                                {priceDiff > 0 ? ' increase' : ' decrease'}
                            </p>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reason for Override *
                        </label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain why you are overriding the calculated price..."
                            rows={4}
                            required
                        />
                        {errors.reason && (
                            <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            Minimum 10 characters. This will be recorded in the audit trail.
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm text-blue-800">
                            <p className="font-medium mb-1">Price Override Information</p>
                            <ul className={`list-disc list-inside space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                <li>Price overrides are logged in the audit trail</li>
                                <li>Override applies to this item only</li>
                                <li>Tax will be recalculated based on the override price</li>
                                <li>This action requires pricing:override permission</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Apply Override'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

