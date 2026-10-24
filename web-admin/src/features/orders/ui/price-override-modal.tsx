'use client'

/**
 * Price Override Modal
 * Allows authorized users to manually override item prices, or reset an
 * existing override back to the default (calculated) price.
 */

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode, roundMoneyAmount } from '@/lib/money/format-money'
import { useRTL } from '@/lib/hooks/useRTL'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'
import { CmxButton, CmxMoneyField } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import { CmxTextarea } from '@ui/primitives'
import { CmxKeypad, KEYPAD_NUMERIC_3COL } from '@ui/utilities'
import { cmxMessage } from '@ui/feedback'
import { parseMoneyDraft, applyKeypadInput } from '@/lib/money/money-draft'
import { AlertCircle, Info, RotateCcw } from 'lucide-react'

interface PriceOverrideModalProps {
    open: boolean
    onClose: () => void
    item: {
        id: string
        productName: string
        quantity: number
        calculatedPrice: number
        currentPrice?: number
        /** True when the item already carries a price override (enables Reset). */
        hasOverride?: boolean
    }
    onSave: (override: { price: number; reason: string }) => void
    /** Clears the override price and reason, restoring the default price. */
    onReset?: () => void
    hasPermission: boolean
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.item
 * @param root0.onSave
 * @param root0.onReset
 * @param root0.hasPermission
 */
export function PriceOverrideModal({
    open,
    onClose,
    item,
    onSave,
    onReset,
    hasPermission,
}: PriceOverrideModalProps) {
    const t = useTranslations('newOrder.priceOverride')
    const tCommon = useTranslations('common')
    const isRTL = useRTL()
    const locale = useLocale()
    const { currencyCode, decimalPlaces } = useTenantCurrency()
    const moneyLocale = locale === 'ar' ? 'ar' : 'en'
    const fmt = (n: number) =>
        formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale })
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

        const price = parseMoneyDraft(overridePrice)
        if (price < 0) {
            newErrors.price = t('errors.invalidPrice')
        }

        if (!reason.trim()) {
            newErrors.reason = t('errors.reasonRequired')
        } else if (reason.trim().length < 10) {
            newErrors.reason = t('errors.reasonTooShort')
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    async function handleSave() {
        if (!validate()) return

        setSaving(true)
        try {
            const price = parseMoneyDraft(overridePrice)
            onSave({
                price,
                reason: reason.trim(),
            })
            cmxMessage.success(t('applied'))
            onClose()
        } catch (err: unknown) {
            cmxMessage.error(err instanceof Error && err.message ? err.message : t('applyFailed'))
        } finally {
            setSaving(false)
        }
    }

    function handleReset() {
        if (!onReset) return
        onReset()
        cmxMessage.success(t('reset'))
        onClose()
    }

    if (!hasPermission) {
        return (
            <CmxDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
                <CmxDialogContent>
                    <CmxDialogHeader>
                        <CmxDialogTitle>{t('permissionDeniedTitle')}</CmxDialogTitle>
                    </CmxDialogHeader>
                    <div className={`flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">{t('accessDenied')}</p>
                            <p className="text-sm text-red-700 mt-1">
                                {t('accessDeniedMessage')}
                            </p>
                        </div>
                    </div>
                    <CmxDialogFooter>
                        <CmxButton variant="outline" onClick={onClose}>
                            {tCommon('close')}
                        </CmxButton>
                    </CmxDialogFooter>
                </CmxDialogContent>
            </CmxDialog>
        )
    }

    const priceDiff = parseMoneyDraft(overridePrice) - item.calculatedPrice
    const priceDiffPercent = item.calculatedPrice > 0
        ? ((priceDiff / item.calculatedPrice) * 100).toFixed(1)
        : '0'
    const canReset = Boolean(item.hasOverride && onReset)

    return (
        <CmxDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <CmxDialogContent className="max-w-2xl">
                <CmxDialogHeader>
                    <CmxDialogTitle>{t('title')}</CmxDialogTitle>
                </CmxDialogHeader>

                <div className="space-y-4">
                    {/* Item Info */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm font-medium text-gray-900 mb-2">{item.productName}</p>
                        <div className={`flex items-center gap-4 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <span>{t('quantity', { quantity: item.quantity })}</span>
                            <span>{t('calculatedPrice', { price: fmt(item.calculatedPrice) })}</span>
                        </div>
                    </div>

                    {/* Current Calculated Price (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('calculatedPriceReadOnly')}
                        </label>
                        <CmxInput
                            value={String(roundMoneyAmount(item.calculatedPrice, decimalPlaces))}
                            disabled
                            className="bg-gray-50"
                        />
                    </div>

                    {/* Override Price */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('overridePriceLabel', { currency: currencyCode })}
                        </label>
                        <CmxMoneyField
                            value={parseMoneyDraft(overridePrice) || null}
                            draftValue={overridePrice}
                            decimalPlaces={decimalPlaces}
                            min={0}
                            showZero
                            onValueChange={(_, d) => setOverridePrice(d)}
                            placeholder={fmt(0)}
                        />
                        {errors.price && (
                            <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                        )}
                        {!errors.price && priceDiff !== 0 && (
                            <p className={`mt-1 text-sm ${priceDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {priceDiff > 0
                                    ? t('priceIncrease', { amount: `+${fmt(priceDiff)}`, percent: priceDiffPercent })
                                    : t('priceDecrease', { amount: fmt(priceDiff), percent: priceDiffPercent })}
                            </p>
                        )}
                        <div className="mt-3">
                            <CmxKeypad
                                keys={KEYPAD_NUMERIC_3COL}
                                columns={3}
                                keyHeight="lg"
                                onKeyPress={(key) => {
                                    const next = applyKeypadInput(overridePrice, key, decimalPlaces)
                                    setOverridePrice(next)
                                }}
                                onKeyLongPress={(k) => { if (k === 'backspace') setOverridePrice('') }}
                                getKeyClassName={(k) => k === 'backspace' ? undefined : 'bg-white'}
                            />
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('reasonLabel')}
                        </label>
                        <CmxTextarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={t('reasonPlaceholder')}
                            rows={4}
                            required
                        />
                        {errors.reason && (
                            <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                            {t('reasonHint')}
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="flex-1 text-sm text-blue-800">
                            <p className="font-medium mb-1">{t('infoTitle')}</p>
                            <ul className={`list-disc list-inside space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                                <li>{t('infoAudit')}</li>
                                <li>{t('infoScope')}</li>
                                <li>{t('infoTax')}</li>
                                <li>{t('infoPermission')}</li>
                            </ul>
                        </div>
                    </div>

                    {/* Reset hint — states what the reset restores before the user clicks */}
                    {canReset && (
                        <p className="text-xs text-gray-500">
                            {t('resetHint', { price: fmt(item.calculatedPrice) })}
                        </p>
                    )}
                </div>

                <CmxDialogFooter>
                    {canReset && (
                        <CmxButton
                            type="button"
                            variant="outline"
                            onClick={handleReset}
                            disabled={saving}
                            className="me-auto"
                        >
                            <RotateCcw className="w-4 h-4 me-1.5" aria-hidden="true" />
                            {t('resetToDefault')}
                        </CmxButton>
                    )}
                    <CmxButton type="button" variant="outline" onClick={onClose}>
                        {tCommon('cancel')}
                    </CmxButton>
                    <CmxButton onClick={handleSave} disabled={saving}>
                        {saving ? tCommon('saving') : t('apply')}
                    </CmxButton>
                </CmxDialogFooter>
            </CmxDialogContent>
        </CmxDialog>
    )
}
