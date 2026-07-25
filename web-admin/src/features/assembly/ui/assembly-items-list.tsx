/**
 * Assembly Items List
 * Shows all task items so users can manually mark them as assembled
 * without a barcode scanner.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useScanItem, type AssemblyTaskItem } from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { CheckCircle2, Circle, ListChecks, AlertTriangle } from 'lucide-react';

interface AssemblyItemsListProps {
  taskId: string;
  items: AssemblyTaskItem[];
  isLoading?: boolean;
  onItemMarked?: () => void;
}

function statusVariant(
  status: string
): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'SCANNED':
      return 'success';
    case 'EXCEPTION':
      return 'destructive';
    case 'RESOLVED':
      return 'warning';
    default:
      return 'secondary';
  }
}

/**
 * @param root0
 * @param root0.taskId
 * @param root0.items
 * @param root0.isLoading
 * @param root0.onItemMarked
 */
export function AssemblyItemsList({
  taskId,
  items,
  isLoading = false,
  onItemMarked,
}: AssemblyItemsListProps) {
  const t = useTranslations('workflow.assembly.task');
  const locale = useLocale();
  const isArabic = locale.startsWith('ar');
  const { showSuccess, showError } = useMessage();
  const { mutate: markItem, isPending: isMarking, variables } = useScanItem();

  const pendingCount = items.filter((item) => item.itemStatus === 'PENDING').length;

  const handleSelect = (item: AssemblyTaskItem) => {
    if (item.itemStatus !== 'PENDING' || isMarking) return;

    markItem(
      { taskId, assemblyItemId: item.id },
      {
        onSuccess: (result) => {
          if (result.success && result.isMatch) {
            showSuccess(t('messages.itemMarked'));
            onItemMarked?.();
          } else {
            showError(t('messages.itemMarkFailed'));
          }
        },
        onError: (error) => {
          showError(error.message || t('messages.itemMarkFailed'));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            {t('itemsTitle')}
          </CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3">
          <CmxSkeleton className="h-14 w-full" />
          <CmxSkeleton className="h-14 w-full" />
          <CmxSkeleton className="h-14 w-full" />
        </CmxCardContent>
      </CmxCard>
    );
  }

  return (
    <CmxCard>
      <CmxCardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CmxCardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          {t('itemsTitle')}
        </CmxCardTitle>
        <span className="text-sm text-muted-foreground">
          {t('pendingRemaining', { count: pendingCount })}
        </span>
      </CmxCardHeader>
      <CmxCardContent>
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-medium">{t('emptyItemsTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('emptyItemsDescription')}
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label={t('itemsTitle')}>
            {items.map((item) => {
              const name = isArabic
                ? item.productName2 || item.productName
                : item.productName;
              const isItemPending = item.itemStatus === 'PENDING';
              const isThisMarking =
                isMarking && variables?.assemblyItemId === item.id;

              return (
                <li key={item.id}>
                  <div
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      isItemPending
                        ? 'border-border bg-background hover:bg-muted/40'
                        : item.itemStatus === 'SCANNED'
                          ? 'border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30'
                          : 'border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30'
                    }`}
                  >
                    <div className="shrink-0 text-muted-foreground" aria-hidden>
                      {item.itemStatus === 'SCANNED' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : item.itemStatus === 'EXCEPTION' ? (
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{name}</p>
                        <Badge variant={statusVariant(item.itemStatus)}>
                          {t(
                            `itemStatus.${normalizeStatusKey(item.itemStatus)}`
                          )}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t('quantity', { count: item.quantity })}
                        {item.barcode
                          ? ` · ${t('barcodeLabel')}: ${item.barcode}`
                          : ` · ${t('noBarcode')}`}
                      </p>
                    </div>

                    {isItemPending ? (
                      <CmxButton
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelect(item)}
                        loading={isThisMarking}
                        disabled={isMarking}
                        className="shrink-0"
                      >
                        {t('actions.markAssembled')}
                      </CmxButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}

function normalizeStatusKey(
  status: string
): 'PENDING' | 'SCANNED' | 'EXCEPTION' | 'RESOLVED' {
  if (
    status === 'PENDING' ||
    status === 'SCANNED' ||
    status === 'EXCEPTION' ||
    status === 'RESOLVED'
  ) {
    return status;
  }
  return 'PENDING';
}
