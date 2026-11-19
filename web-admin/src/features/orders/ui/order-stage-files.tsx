/**
 * OrderStageFiles — collapsed "Files" panel for an order on a workflow stage screen
 * (preparation, processing, assembly, QA, packing, ready, delivery). Files uploaded here record the screen
 * (`source`) and, on the server, the order's status at that moment (`stage_code`), so the order's
 * Files tab can show and filter which stage each photo came from.
 */

'use client';

import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxCollapsibleSection } from '@ui/data-display/cmx-collapsible-section';
import { FileAttachments } from '@features/file-util';
import { useHasPermission } from '@/lib/hooks/use-has-permission';
import {
  FILE_CATEGORIES,
  ORDER_FILE_DEFAULT_PURPOSE_BY_SOURCE,
  type FileRefTypeCode,
  type FileSourceCode,
} from '@/lib/constants/file-util';

export interface OrderStageFilesProps {
  orderId: string;
  /** The stage screen, e.g. FILE_SOURCES.ORDER_QA. */
  source: FileSourceCode;
  /** Optional sub-record (e.g. ASM_TASK + task id): the panel then shows and saves only its files. */
  refType?: FileRefTypeCode;
  refId?: string;
  className?: string;
}

/**
 * Order files on a stage screen; the list loads only when the panel is opened.
 * @param props order, source screen, optional sub-record
 */
export function OrderStageFiles({ orderId, source, refType, refId, className }: OrderStageFilesProps) {
  const t = useTranslations('fileUtil');
  // Mirrors FILE_CATEGORY_ACCESS.ORDER_FILE.write: floor staff move orders with orders:transition.
  const canUpdate = useHasPermission('orders', 'update');
  const canTransition = useHasPermission('orders', 'transition');
  // Drivers may open delivery screens without orders:read; the file list would only fail for them.
  const canRead = useHasPermission('orders', 'read');
  if (!canRead) return null;

  return (
    <CmxCard className={className}>
      <CmxCardContent className="py-2">
        <CmxCollapsibleSection title={<span className="font-semibold">{t('title')}</span>} bodyClassName="ps-2 pe-2 pb-2 pt-2">
          <FileAttachments
            category={FILE_CATEGORIES.ORDER_FILE}
            entityId={orderId}
            source={source}
            defaultPurpose={ORDER_FILE_DEFAULT_PURPOSE_BY_SOURCE[source]}
            refType={refType}
            refId={refId}
            title={t('stageFilesTitle')}
            readOnly={!(canUpdate || canTransition)}
          />
        </CmxCollapsibleSection>
      </CmxCardContent>
    </CmxCard>
  );
}
