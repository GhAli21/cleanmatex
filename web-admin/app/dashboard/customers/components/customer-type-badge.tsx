/**
 * PRD-003: Customer Type Badge Component
 * Reusable badge for displaying customer type (guest/stub/full)
 */

'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { CustomerType } from '@/lib/types/customer'

interface CustomerTypeBadgeProps {
  type: CustomerType
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
}

export default function CustomerTypeBadge({
  type,
  size = 'md',
  showIcon = false,
}: CustomerTypeBadgeProps) {
  const t = useTranslations('customers.types');

  const getBadgeStyles = () => {
    const baseStyles = 'inline-flex items-center font-semibold rounded-full'

    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-xs',
      lg: 'px-3 py-1 text-sm',
    }

    const typeStyles: Record<string, string> = {
      guest: 'bg-gray-100 text-gray-800',
      stub: 'bg-yellow-100 text-yellow-800',
      full: 'bg-green-100 text-green-800',
      walk_in: 'bg-blue-100 text-blue-800',
    }

    return `${baseStyles} ${sizeStyles[size]} ${typeStyles[type] ?? typeStyles.guest}`
  }

  const getIcon = () => {
    if (!showIcon) return null

    const icons: Record<string, ReactNode> = {
      guest: (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      ),
      stub: (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
        </svg>
      ),
      full: (
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    }

    return icons[type] ?? null
  }

  const getLabel = () => {
    const labels: Record<string, string> = {
      guest: t('guest'),
      stub: t('stub'),
      full: t('full'),
      walk_in: t('walk_in'),
    }
    return labels[type] ?? type
  }

  return (
    <span className={getBadgeStyles()}>
      {getIcon()}
      {getLabel()}
    </span>
  )
}
