'use client';

import { useTranslations } from 'next-intl';
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';

type StatusFieldKey =
  | 'order_source_code'
  | 'order_type_id'
  | 'order_subtype'
  | 'state_version'
  | 'workflow_profile_name'
  | 'wf_profile_id'
  | 'wf_version_no'
  | 'wf_profile_revision'
  | 'wf_profile_version_id'
  | 'status'
  | 'current_status'
  | 'current_stage'
  | 'preparation_status'
  | 'payment_status'
  | 'rec_status'
  | 'is_rejected'
  | 'rejected_from_stage'
  | 'has_issue'
  | 'physical_intake_status'
  | 'ar_invoice_status'
  | 'tax_document_status'
  | 'financial_snapshot_status'
  | 'last_transition_at'
  | 'last_transition_by'
  | 'physical_intake_at'
  | 'physical_intake_by'
  | 'physical_intake_info'
  | 'received_info'
  | 'financial_last_calculated_at'
  | 'financial_last_calculated_by'
  | 'received_at'
  | 'prepared_at'
  | 'ready_by_at'
  | 'ready_at'
  | 'delivered_at'
  | 'cancelled_at'
  | 'cancelled_by'
  | 'cancelled_note'
  | 'returned_at'
  | 'returned_by'
  | 'return_reason'
  | 'return_reason_code';

interface StatusFieldDefinition {
  key: StatusFieldKey;
  kind?: 'boolean' | 'date' | 'status';
}

type GroupColor = 'blue' | 'violet' | 'slate' | 'amber' | 'teal' | 'emerald' | 'red' | 'orange';

interface StatusFieldGroup {
  id: string;
  color: GroupColor;
  fields: readonly StatusFieldDefinition[];
}

const GROUP_COLOR_CLASSES: Record<GroupColor, { frame: string; title: string }> = {
  blue: {
    frame: 'border-primary/30 bg-primary/5',
    title: 'text-primary-text',
  },
  violet: {
    frame: 'border-primary/30 bg-primary/5',
    title: 'text-primary-text',
  },
  slate: {
    frame: 'border-muted-foreground/40 bg-border/5',
    title: 'text-foreground',
  },
  amber: {
    frame: 'border-warning/30 bg-warning/5',
    title: 'text-warning-text',
  },
  teal: {
    frame: 'border-primary/30 bg-primary/5',
    title: 'text-primary-text',
  },
  emerald: {
    frame: 'border-success/30 bg-success/5',
    title: 'text-success-text',
  },
  red: {
    frame: 'border-destructive/30 bg-destructive/5',
    title: 'text-danger-text',
  },
  orange: {
    frame: 'border-warning/30 bg-warning/5',
    title: 'text-warning-text',
  },
};

const WORKFLOW_GROUPS: readonly StatusFieldGroup[] = [
  {
    id: 'orderClassification',
    color: 'blue',
    fields: [
      { key: 'order_source_code' },
      { key: 'order_type_id' },
      { key: 'order_subtype' },
    ],
  },
  {
    id: 'workflowProfile',
    color: 'violet',
    fields: [
      { key: 'workflow_profile_name' },
      { key: 'wf_profile_id' },
      { key: 'wf_profile_version_id' },
      { key: 'wf_version_no' },
      { key: 'wf_profile_revision' },
      { key: 'state_version' },
    ],
  },
  {
    id: 'statusFlags',
    color: 'slate',
    fields: [
      { key: 'status', kind: 'status' },
      { key: 'current_status', kind: 'status' },
      { key: 'current_stage', kind: 'status' },
      { key: 'preparation_status', kind: 'status' },
      { key: 'payment_status', kind: 'status' },
      { key: 'rec_status', kind: 'status' },
    ],
  },
  {
    id: 'exceptions',
    color: 'amber',
    fields: [
      { key: 'is_rejected', kind: 'boolean' },
      { key: 'rejected_from_stage', kind: 'status' },
      { key: 'has_issue', kind: 'boolean' },
    ],
  },
  {
    id: 'financialIntake',
    color: 'teal',
    fields: [
      { key: 'physical_intake_status', kind: 'status' },
      { key: 'ar_invoice_status', kind: 'status' },
      { key: 'tax_document_status', kind: 'status' },
      { key: 'financial_snapshot_status', kind: 'status' },
      { key: 'last_transition_at', kind: 'date' },
      { key: 'last_transition_by' },
      { key: 'physical_intake_at', kind: 'date' },
      { key: 'physical_intake_by' },
      { key: 'physical_intake_info' },
      { key: 'received_info' },
      { key: 'financial_last_calculated_at', kind: 'date' },
      { key: 'financial_last_calculated_by' },
    ],
  },
];

const LIFECYCLE_GROUPS: readonly StatusFieldGroup[] = [
  {
    id: 'fulfilmentTimeline',
    color: 'emerald',
    fields: [
      { key: 'received_at', kind: 'date' },
      { key: 'prepared_at', kind: 'date' },
      { key: 'ready_by_at', kind: 'date' },
      { key: 'ready_at', kind: 'date' },
      { key: 'delivered_at', kind: 'date' },
    ],
  },
  {
    id: 'cancellation',
    color: 'red',
    fields: [
      { key: 'cancelled_at', kind: 'date' },
      { key: 'cancelled_by' },
      { key: 'cancelled_note' },
    ],
  },
  {
    id: 'returnGroup',
    color: 'orange',
    fields: [
      { key: 'returned_at', kind: 'date' },
      { key: 'returned_by' },
      { key: 'return_reason' },
      { key: 'return_reason_code' },
    ],
  },
];

/**
 * Values required to expose the full operational status and lifecycle state
 * already returned by the tenant-scoped order-details request.
 */
export interface OrderStatusLifecycleTabProps {
  order: Record<string, unknown>;
  locale: 'en' | 'ar';
}

function formatStatusLabel(value: unknown): string {
  return String(value).replace(/_/g, ' ').toUpperCase();
}

function resolveStatusVariant(key: StatusFieldKey, value: unknown): CmxBadgeTone {
  const normalizedValue = String(value).toLowerCase();

  if (key === 'is_rejected' || normalizedValue === 'cancelled' || normalizedValue === 'failed') {
    return 'danger';
  }
  if (key === 'has_issue' || normalizedValue === 'pending' || normalizedValue === 'partial') {
    return 'warning';
  }
  if (normalizedValue === 'completed' || normalizedValue === 'paid' || normalizedValue === 'delivered') {
    return 'success';
  }
  if (normalizedValue === 'processing' || normalizedValue === 'in_progress') {
    return 'info';
  }

  return 'info';
}

/**
 * Displays every status and lifecycle field returned for an order so operators
 * can diagnose its current state without opening a second details screen.
 *
 * @param props - Tenant-scoped order data and the active UI locale.
 */
export function OrderStatusLifecycleTab({ order, locale }: OrderStatusLifecycleTabProps) {
  const t = useTranslations('orders.detail.financial.statusLifecycle');

  const renderValue = (field: StatusFieldDefinition) => {
    const value = field.key === 'workflow_profile_name'
      ? (locale === 'ar' ? order.workflow_profile_name2 ?? order.workflow_profile_name : order.workflow_profile_name)
      : order[field.key];
    if (value === null || value === undefined || value === '') {
      return <span className="text-sm text-muted-foreground">{t('notAvailable')}</span>;
    }

    if (field.kind === 'boolean') {
      return (
        <CmxStatusBadge
          label={value === true ? t('yes') : t('no')}
          tone={value === true ? 'warning' : 'success'}
          size="sm"
        />
      );
    }

    if (field.kind === 'date') {
      const date = new Date(String(value));
      return Number.isNaN(date.getTime())
        ? <span className="text-sm font-medium">{String(value)}</span>
        : <span className="text-sm font-medium">{date.toLocaleString(locale)}</span>;
    }

    if (field.kind === 'status') {
      return (
        <CmxStatusBadge
          label={formatStatusLabel(value)}
          tone={resolveStatusVariant(field.key, value)}
          size="sm"
        />
      );
    }

    return <span className="break-words text-sm font-medium">{String(value)}</span>;
  };

  const renderGroup = (group: StatusFieldGroup) => {
    const colors = GROUP_COLOR_CLASSES[group.color];
    return (
      <div key={group.id} className={`rounded-lg border p-3 ${colors.frame}`}>
        <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${colors.title}`}>
          {t(`groups.${group.id}`)}
        </p>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {group.fields.map((field) => (
            <div key={field.key} className="min-w-0 space-y-1">
              <dt className="text-xs text-muted-foreground">{t(`fields.${field.key}`)}</dt>
              <dd>{renderValue(field)}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const renderSection = (title: string, groups: readonly StatusFieldGroup[]) => (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{title}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-3">
        {groups.map((group) => renderGroup(group))}
      </CmxCardContent>
    </CmxCard>
  );

  return (
    <div className="space-y-4">
      {renderSection(t('workflowTitle'), WORKFLOW_GROUPS)}
      {renderSection(t('lifecycleTitle'), LIFECYCLE_GROUPS)}
    </div>
  );
}
