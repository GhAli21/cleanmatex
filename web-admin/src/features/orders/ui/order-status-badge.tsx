/**
 * OrderStatusBadge - order workflow status as a semantic badge.
 * Colour comes from a locked tone; each stage keeps its own icon so stages
 * that share a tone stay distinguishable.
 * PRD-005: Basic Workflow & Status Transitions
 */

'use client';

import {
  Archive,
  Boxes,
  Check,
  CheckCheck,
  CheckCircle,
  ClipboardList,
  Droplets,
  FileText,
  Package,
  Package2,
  Shuffle,
  Sparkles,
  Truck,
  Wind,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { CmxStatusBadge, type CmxBadgeTone, type StatusBadgeSize } from '@ui/feedback/cmx-status-badge';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META } from '@/lib/types/workflow';

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  ClipboardList,
  Package,
  Shuffle,
  Droplets,
  Wind,
  Sparkles,
  Boxes,
  CheckCircle,
  Package2,
  CheckCheck,
  Truck,
  Check,
  Archive,
  XCircle,
};

/** STATUS_META hue → locked tone (owner decision 2026-11-16). */
const HUE_TONE: Record<string, CmxBadgeTone> = {
  gray: 'neutral',
  slate: 'neutral',
  blue: 'info',
  sky: 'info',
  cyan: 'info',
  indigo: 'info',
  violet: 'info',
  purple: 'info',
  fuchsia: 'info',
  teal: 'info',
  amber: 'warning',
  orange: 'warning',
  green: 'success',
  emerald: 'success',
  red: 'danger',
};

/**
 * Tone of an order workflow status.
 * @param status - Order status code
 * @returns The badge tone; `neutral` for an unknown status
 */
export function orderStatusTone(status: string): CmxBadgeTone {
  const meta = STATUS_META[status as OrderStatus];
  return (meta && HUE_TONE[meta.color]) || 'neutral';
}

interface OrderStatusBadgeProps {
  status: OrderStatus;
  locale?: 'en' | 'ar';
  showIcon?: boolean;
  size?: StatusBadgeSize;
  variant?: 'default' | 'outline';
}

/**
 * Order status badge with label, tone and stage icon.
 * @param props - status, locale, showIcon, size, variant (`outline` for a border-only badge)
 * @returns The badge, or null for an unknown status
 */
export function OrderStatusBadge({
  status,
  locale = 'en',
  showIcon = true,
  size = 'md',
  variant = 'default',
}: OrderStatusBadgeProps) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  return (
    <CmxStatusBadge
      tone={orderStatusTone(status)}
      appearance={variant === 'outline' ? 'outline' : 'soft'}
      size={size}
      icon={showIcon ? ICON_MAP[meta.icon] : undefined}
      label={locale === 'ar' ? meta.labelAr : meta.label}
      tooltip={meta.description}
    />
  );
}
