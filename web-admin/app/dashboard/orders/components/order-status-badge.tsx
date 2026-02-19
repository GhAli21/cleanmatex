/**
 * OrderStatusBadge Component
 * Displays order status with color-coding and icons
 * PRD-005: Basic Workflow & Status Transitions
 */

'use client';

import { Badge } from '@ui/compat';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META } from '@/lib/types/workflow';
import {
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
} from 'lucide-react';

const ICON_MAP = {
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

interface OrderStatusBadgeProps {
  status: OrderStatus;
  locale?: 'en' | 'ar';
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline';
}

export function OrderStatusBadge({
  status,
  locale = 'en',
  showIcon = true,
  size = 'md',
  variant = 'default',
}: OrderStatusBadgeProps) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  const IconComponent = ICON_MAP[meta.icon as keyof typeof ICON_MAP];
  const label = locale === 'ar' ? meta.labelAr : meta.label;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  // Color mappings for different statuses
  const colorClasses = {
    gray: variant === 'outline'
      ? 'border-gray-300 text-gray-700 bg-white'
      : 'bg-gray-100 text-gray-800 border-gray-200',
    blue: variant === 'outline'
      ? 'border-blue-300 text-blue-700 bg-white'
      : 'bg-blue-100 text-blue-800 border-blue-200',
    indigo: variant === 'outline'
      ? 'border-indigo-300 text-indigo-700 bg-white'
      : 'bg-indigo-100 text-indigo-800 border-indigo-200',
    purple: variant === 'outline'
      ? 'border-purple-300 text-purple-700 bg-white'
      : 'bg-purple-100 text-purple-800 border-purple-200',
    cyan: variant === 'outline'
      ? 'border-cyan-300 text-cyan-700 bg-white'
      : 'bg-cyan-100 text-cyan-800 border-cyan-200',
    sky: variant === 'outline'
      ? 'border-sky-300 text-sky-700 bg-white'
      : 'bg-sky-100 text-sky-800 border-sky-200',
    violet: variant === 'outline'
      ? 'border-violet-300 text-violet-700 bg-white'
      : 'bg-violet-100 text-violet-800 border-violet-200',
    fuchsia: variant === 'outline'
      ? 'border-fuchsia-300 text-fuchsia-700 bg-white'
      : 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    orange: variant === 'outline'
      ? 'border-orange-300 text-orange-700 bg-white'
      : 'bg-orange-100 text-orange-800 border-orange-200',
    amber: variant === 'outline'
      ? 'border-amber-300 text-amber-700 bg-white'
      : 'bg-amber-100 text-amber-800 border-amber-200',
    green: variant === 'outline'
      ? 'border-green-300 text-green-700 bg-white'
      : 'bg-green-100 text-green-800 border-green-200',
    teal: variant === 'outline'
      ? 'border-teal-300 text-teal-700 bg-white'
      : 'bg-teal-100 text-teal-800 border-teal-200',
    emerald: variant === 'outline'
      ? 'border-emerald-300 text-emerald-700 bg-white'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200',
    slate: variant === 'outline'
      ? 'border-slate-300 text-slate-700 bg-white'
      : 'bg-slate-100 text-slate-800 border-slate-200',
    red: variant === 'outline'
      ? 'border-red-300 text-red-700 bg-white'
      : 'bg-red-100 text-red-800 border-red-200',
  };

  const colorClass = colorClasses[meta.color as keyof typeof colorClasses] || colorClasses.gray;

  return (
    <Badge
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border',
        sizeClasses[size],
        colorClass
      )}
      title={meta.description}
    >
      {showIcon && IconComponent && (
        <IconComponent size={iconSizes[size]} className="shrink-0" />
      )}
      <span>{label}</span>
    </Badge>
  );
}

/**
 * Compact status indicator (dot only)
 */
export function OrderStatusDot({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  if (!meta) return null;

  const dotColors = {
    gray: 'bg-gray-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    fuchsia: 'bg-fuchsia-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    teal: 'bg-teal-500',
    emerald: 'bg-emerald-500',
    slate: 'bg-slate-500',
    red: 'bg-red-500',
  };

  const dotColor = dotColors[meta.color as keyof typeof dotColors] || dotColors.gray;

  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full', dotColor)}
      title={meta.description}
    />
  );
}
