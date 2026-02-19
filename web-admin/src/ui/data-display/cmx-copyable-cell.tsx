'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react'; 
import { useMessage } from '@ui/feedback';

interface CmxCopyableCellProps {
  /** Value to display and copy (will be stringified) */
  value: string | number | null | undefined;
  /** Optional display override (e.g. truncated) */
  displayValue?: string;
  /** Optional copy hint for empty values */
  emptyPlaceholder?: string;
  /** Additional class names */
  className?: string;
  /** Truncate long values with ellipsis (max chars) */
  maxLength?: number;
  /** RTL-aware alignment */
  align?: 'left' | 'right';
  /** Render as td (default) or span for use inside existing td */
  as?: 'td' | 'span';
}

/**
 * Table cell (or span) that displays a value and copies it to clipboard on click.
 * Shows a brief success toast when copied.
 */
export function CmxCopyableCell({
  value,
  displayValue,
  emptyPlaceholder = '—',
  className = '',
  maxLength,
  align = 'left',
  as = 'td',
}: CmxCopyableCellProps) {
  const t = useTranslations('common');
  const { showSuccess } = useMessage();
  const [copied, setCopied] = useState(false);

  const strValue = value != null && value !== '' ? String(value) : null;
  const toCopy = strValue ?? '';
  const toShow = displayValue ?? strValue ?? emptyPlaceholder;
  const truncated =
    maxLength && toShow.length > maxLength
      ? `${String(toShow).slice(0, maxLength)}…`
      : toShow;

  const handleCopy = useCallback(async () => {
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      showSuccess(t('copied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [toCopy, showSuccess]);

  const isClickable = !!toCopy;
  const Tag = as;

  return (
    <Tag
      onClick={isClickable ? handleCopy : undefined}
      title={isClickable ? 'Click to copy' : strValue ?? undefined}
      className={`${as === 'td' ? 'px-4 py-3' : ''} text-sm text-gray-900 group ${className} ${
        isClickable ? 'cursor-pointer hover:bg-blue-50' : ''
      } ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className="inline-flex items-center gap-2 min-w-0 max-w-full">
        <span className="truncate" title={strValue ?? undefined}>
          {truncated}
        </span>
        {isClickable && (
          <span className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-500" />
            )}
          </span>
        )}
      </span>
    </Tag>
  );
}
