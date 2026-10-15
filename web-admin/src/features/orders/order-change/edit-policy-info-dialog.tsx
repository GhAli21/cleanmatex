'use client';

import { Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { Badge } from '@ui/primitives/badge';
import { CmxButton, Tooltip } from '@ui/primitives';
import { CmxCard } from '@ui/primitives/cmx-card';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyAssignment, OrderChangeEditPolicyInfo, OrderChangeEditPolicyRule } from '@/lib/types/order-change';
import { editPolicyExplanationKeys, sortEditPolicyRules } from './edit-policy-info';

const TONE = {
  ALLOW: {
    row: 'border-[rgb(var(--cmx-success-border-rgb,187_247_208))] bg-[rgb(var(--cmx-success-bg-rgb,240_253_244))]',
    dot: 'bg-[rgb(var(--cmx-success-rgb,34_197_94))]',
  },
  ALLOW_WITH_WARNING: {
    row: 'border-[rgb(var(--cmx-warning-border-rgb,253_224_71))] bg-[rgb(var(--cmx-warning-bg-rgb,254_252_232))]',
    dot: 'bg-[rgb(var(--cmx-warning-rgb,234_179_8))]',
  },
  REQUIRE_OVERRIDE: {
    row: 'border-[rgb(var(--cmx-info-border-rgb,191_219_254))] bg-[rgb(var(--cmx-info-bg-rgb,239_246_255))]',
    dot: 'bg-[rgb(var(--cmx-info-rgb,37_99_235))]',
  },
  DENY: {
    row: 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] bg-[rgb(var(--cmx-destructive-bg-rgb,254_242_242))]',
    dot: 'bg-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
  },
} as const;

/**
 * Read-only explanation of the order's current Edit Policy.
 * Colors follow the policy decision. The lines also say when this screen cannot send the change.
 */
export function EditPolicyInfoDialog({
  open,
  policy,
  onOpenChange,
}: {
  open: boolean;
  policy: OrderChangeEditPolicyInfo;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const operationLabels: Record<OrderChangeOperationCode, string> = {
    ADD_ITEM: t('policyInfo.operations.ADD_ITEM'),
    REMOVE_ITEM: t('policyInfo.operations.REMOVE_ITEM'),
    CHANGE_ITEM_QUANTITY: t('policyInfo.operations.CHANGE_ITEM_QUANTITY'),
    ADD_PIECE: t('policyInfo.operations.ADD_PIECE'),
    REMOVE_PIECE: t('policyInfo.operations.REMOVE_PIECE'),
    ADD_PREFERENCE: t('policyInfo.operations.ADD_PREFERENCE'),
    CHANGE_PREFERENCE: t('policyInfo.operations.CHANGE_PREFERENCE'),
    REMOVE_PREFERENCE: t('policyInfo.operations.REMOVE_PREFERENCE'),
    CHANGE_PRIORITY: t('policyInfo.operations.CHANGE_PRIORITY'),
    CHANGE_SERVICE_SPEED: t('policyInfo.operations.CHANGE_SERVICE_SPEED'),
    CHANGE_READY_BY: t('policyInfo.operations.CHANGE_READY_BY'),
    CHANGE_ORDER_NOTES: t('policyInfo.operations.CHANGE_ORDER_NOTES'),
    CHANGE_CUSTOMER_SNAPSHOT: t('policyInfo.operations.CHANGE_CUSTOMER_SNAPSHOT'),
  };
  const decisionLabels = {
    ALLOW: t('policyInfo.legend.allow'),
    ALLOW_WITH_WARNING: t('policyInfo.legend.warning'),
    REQUIRE_OVERRIDE: t('policyInfo.legend.override'),
    DENY: t('policyInfo.legend.deny'),
  } as const;
  const howLabels = {
    allow: t('policyInfo.how.allow'),
    warning: t('policyInfo.how.warning'),
    override: t('policyInfo.how.override'),
    deny: t('policyInfo.how.deny'),
    screenClosed: t('policyInfo.how.screenClosed'),
    editLocally: t('policyInfo.how.editLocally'),
    totalSame: t('policyInfo.how.totalSame'),
    identityLocked: t('policyInfo.how.identityLocked'),
    reasonRequired: t('policyInfo.how.reasonRequired'),
  } as const;
  const targetLabels = {
    ORDER: t('policyInfo.targets.ORDER'),
    ITEM: t('policyInfo.targets.ITEM'),
    PIECE: t('policyInfo.targets.PIECE'),
    PREFERENCE: t('policyInfo.targets.PREFERENCE'),
  } as const;
  const rules = sortEditPolicyRules(policy.rules);
  const factRows = buildPolicyFactRows(policy.assignment, policy, {
    organizationId: t('policyInfo.facts.organizationId'),
    profileVersion: t('policyInfo.facts.profileVersion'),
    editPolicy: t('policyInfo.facts.editPolicy'),
    assignmentId: t('policyInfo.facts.assignmentId'),
    profileId: t('policyInfo.facts.profileId'),
    versionNo: t('policyInfo.facts.versionNo'),
    versionStatus: t('policyInfo.facts.versionStatus'),
    policyName: t('policyInfo.facts.policyName'),
    lifecycle: t('policyInfo.facts.lifecycle'),
    policyRevision: t('policyInfo.facts.policyRevision'),
    workflowStatus: t('policyInfo.facts.workflowStatus'),
  });
  const emptyFact = t('policyInfo.facts.empty');
  const copyAll = factRows
    .map((row) => `${row.label}: ${row.values.map((value) => value.text).join(' | ') || emptyFact}`)
    .join('\n');

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg p-0 text-start sm:max-w-2xl">
        <CmxDialogHeader className="border-b border-gray-100 px-4 py-3">
          <CmxDialogTitle>{t('policyInfo.title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto px-4 py-4">
          <PolicyFactCard
            rows={factRows}
            emptyLabel={emptyFact}
            copyLabel={t('policyInfo.facts.copy')}
            copyAllLabel={t('policyInfo.facts.copyAll')}
            copiedLabel={tCommon('copied')}
            copyFailedLabel={t('policyInfo.facts.copyFailed')}
            copyAll={copyAll}
          />
          <p className="text-sm">
            {t('policyInfo.statusLine', { status: policy.workflowStatus ?? t('workspace.lockedField') })}
          </p>
          {policy.status === 'MISSING' ? (
            <p className="rounded border border-[rgb(var(--cmx-warning-border-rgb,253_224_71))] bg-[rgb(var(--cmx-warning-bg-rgb,254_252_232))] px-3 py-2 text-sm">
              {t('policyInfo.missing')}
            </p>
          ) : (
            <>
              <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('policyInfo.revisionLine', { revision: policy.policyRevision ?? 0 })}
              </p>
              <ul className="flex flex-wrap gap-2">
                {(['ALLOW', 'ALLOW_WITH_WARNING', 'REQUIRE_OVERRIDE', 'DENY'] as const).map((decision) => (
                  <li key={decision} className="flex items-center gap-1.5 text-xs">
                    <span className={`h-2.5 w-2.5 rounded-full ${TONE[decision].dot}`} aria-hidden="true" />
                    {decisionLabels[decision]}
                  </li>
                ))}
              </ul>
              <ul className="space-y-2">
                {rules.map((rule) => (
                  <PolicyRule key={`${rule.operationCode}-${rule.targetType}`} rule={rule} label={operationLabels[rule.operationCode]} decisionLabel={decisionLabels[rule.decision]} how={editPolicyExplanationKeys(rule).map((key) => howLabels[key])} target={targetLabels[rule.targetType]} />
                ))}
              </ul>
            </>
          )}
        </div>
        <CmxDialogFooter className="border-t border-gray-100 px-4 py-3">
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('close')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

type PolicyFactTone = 'name' | 'code' | 'status' | 'id' | 'plain';

interface PolicyFactValue {
  text: string;
  tone: PolicyFactTone;
}

interface PolicyFactRow {
  key: string;
  label: string;
  values: PolicyFactValue[];
  wide: boolean;
  hero: boolean;
  /** Summary tiles sit above the identifier list that holds codes and ids. */
  group: 'summary' | 'identifier';
}

interface PolicyFactLabels {
  organizationId: string;
  profileVersion: string;
  editPolicy: string;
  assignmentId: string;
  profileId: string;
  versionNo: string;
  versionStatus: string;
  policyName: string;
  lifecycle: string;
  policyRevision: string;
  workflowStatus: string;
}

function textFact(value: string | number | null | undefined, tone: PolicyFactTone): PolicyFactValue | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? { text, tone } : null;
}

function factRow(
  key: string,
  label: string,
  values: Array<PolicyFactValue | null>,
  layout: { wide?: boolean; hero?: boolean; group?: 'summary' | 'identifier' } = {},
): PolicyFactRow {
  return {
    key,
    label,
    values: values.filter((value): value is PolicyFactValue => value != null),
    wide: layout.wide === true || layout.hero === true,
    hero: layout.hero === true,
    group: layout.group ?? 'summary',
  };
}

/** Readable facts first, then the identifiers staff copy into support notes. */
function buildPolicyFactRows(
  identity: OrderChangeEditPolicyAssignment,
  policy: Pick<OrderChangeEditPolicyInfo, 'policyRevision' | 'workflowStatus'>,
  labels: PolicyFactLabels,
): PolicyFactRow[] {
  return [
    factRow('policyName', labels.policyName, [
      textFact(identity.policyName, 'name'),
      textFact(identity.policyName2, 'name'),
    ], { hero: true }),
    factRow('lifecycle', labels.lifecycle, [textFact(identity.lifecycleStatus, 'status')]),
    factRow('versionStatus', labels.versionStatus, [textFact(identity.versionStatus, 'status')]),
    factRow('versionNo', labels.versionNo, [textFact(identity.versionNo, 'plain')]),
    factRow('policyRevision', labels.policyRevision, [textFact(policy.policyRevision, 'plain')]),
    factRow('workflowStatus', labels.workflowStatus, [textFact(policy.workflowStatus, 'status')], { wide: true }),
    factRow('profileVersion', labels.profileVersion, [
      textFact(identity.profileCode, 'code'),
      textFact(identity.profileVersionId, 'id'),
    ], { group: 'identifier' }),
    factRow('editPolicy', labels.editPolicy, [
      textFact(identity.policyCode, 'code'),
      textFact(identity.editPolicyId, 'id'),
    ], { group: 'identifier' }),
    factRow('assignmentId', labels.assignmentId, [textFact(identity.assignmentId, 'id')], { group: 'identifier' }),
    factRow('profileId', labels.profileId, [textFact(identity.profileId, 'id')], { group: 'identifier' }),
    factRow('organizationId', labels.organizationId, [textFact(identity.tenantOrgId, 'id')], { group: 'identifier' }),
  ];
}

function PolicyFactCard({
  rows,
  emptyLabel,
  copyLabel,
  copyAllLabel,
  copiedLabel,
  copyFailedLabel,
  copyAll,
}: {
  rows: PolicyFactRow[];
  emptyLabel: string;
  copyLabel: string;
  copyAllLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
  copyAll: string;
}) {
  const summaryRows = rows.filter((row) => row.group === 'summary');
  const identifierRows = rows.filter((row) => row.group === 'identifier');
  return (
    <CmxCard className="overflow-hidden shadow-none">
      <div className="flex justify-end border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] px-3 py-2">
        <CmxButton
          type="button"
          variant="outline"
          size="xs"
          className="gap-1.5"
          onClick={() => { void copyValue(copyAll, copiedLabel, copyFailedLabel); }}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          {copyAllLabel}
        </CmxButton>
      </div>
      <div className="p-3">
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {summaryRows.map((row) => (
            <PolicyFactTile
              key={row.key}
              row={row}
              emptyLabel={emptyLabel}
              copyLabel={copyLabel}
              copiedLabel={copiedLabel}
              copyFailedLabel={copyFailedLabel}
            />
          ))}
        </dl>
      </div>
      <dl className="divide-y divide-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
        {identifierRows.map((row) => (
          <PolicyIdentifierRow
            key={row.key}
            row={row}
            emptyLabel={emptyLabel}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            copyFailedLabel={copyFailedLabel}
          />
        ))}
      </dl>
    </CmxCard>
  );
}

function PolicyIdentifierRow({
  row,
  emptyLabel,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  row: PolicyFactRow;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
}) {
  const codes = row.values.filter((value) => value.tone === 'code');
  const ids = row.values.filter((value) => value.tone !== 'code');
  return (
    <div className="px-3 py-2.5">
      <dt className="text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {row.label}
      </dt>
      {row.values.length === 0 ? (
        <dd className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{emptyLabel}</dd>
      ) : (
        <dd className="mt-1.5 space-y-1.5">
          {codes.map((value) => (
            <div key={`${row.key}-code-${value.text}`} className="flex min-w-0 items-center justify-between gap-2">
              <Badge variant="outline" className="max-w-full whitespace-normal break-all font-mono font-medium">
                {value.text}
              </Badge>
              <CopyFactButton value={value.text} label={copyLabel} copiedLabel={copiedLabel} copyFailedLabel={copyFailedLabel} />
            </div>
          ))}
          {ids.map((value) => (
            <div
              key={`${row.key}-id-${value.text}`}
              className="flex min-w-0 items-center gap-2 rounded-md border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))] px-2 py-1"
            >
              <span className="min-w-0 flex-1 select-text break-all font-mono text-xs leading-5">{value.text}</span>
              <CopyFactButton value={value.text} label={copyLabel} copiedLabel={copiedLabel} copyFailedLabel={copyFailedLabel} />
            </div>
          ))}
        </dd>
      )}
    </div>
  );
}

function PolicyFactTile({
  row,
  emptyLabel,
  copyLabel,
  copiedLabel,
  copyFailedLabel,
}: {
  row: PolicyFactRow;
  emptyLabel: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
}) {
  return (
    <div
      className={
        row.hero
          ? 'rounded-lg border border-[rgb(var(--cmx-info-border-rgb,191_219_254))] bg-[rgb(var(--cmx-info-bg-rgb,239_246_255))] px-3 py-2.5 sm:col-span-2'
          : `h-full rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))] px-3 py-2${row.wide ? ' sm:col-span-2' : ''}`
      }
    >
      <dt className="text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {row.label}
      </dt>
      {row.values.length === 0 ? (
        <dd className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{emptyLabel}</dd>
      ) : (
        <dd className="mt-1.5">
          <ul className="space-y-1.5">
            {row.values.map((value) => (
              <li key={`${row.key}-${value.tone}-${value.text}`} className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <PolicyFactValueText value={value} prominent={row.hero} />
                </div>
                <span className="shrink-0">
                  <CopyFactButton
                    value={value.text}
                    label={copyLabel}
                    copiedLabel={copiedLabel}
                    copyFailedLabel={copyFailedLabel}
                  />
                </span>
              </li>
            ))}
          </ul>
        </dd>
      )}
    </div>
  );
}

function PolicyFactValueText({ value, prominent }: { value: PolicyFactValue; prominent: boolean }) {
  if (value.tone === 'code') {
    return (
      <Badge variant="outline" className="max-w-full whitespace-normal break-all bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] font-mono font-medium">
        {value.text}
      </Badge>
    );
  }
  if (value.tone === 'status') {
    return (
      <Badge variant="info" className="max-w-full whitespace-normal font-medium">
        {value.text}
      </Badge>
    );
  }
  if (value.tone === 'id') {
    return <span className="min-w-0 select-text break-all font-mono text-xs leading-5">{value.text}</span>;
  }
  if (value.tone === 'name') {
    return <span dir="auto" className={`min-w-0 select-text leading-5 ${prominent ? 'text-sm font-semibold' : 'text-sm'}`}>{value.text}</span>;
  }
  return <span className="min-w-0 select-text text-sm font-semibold leading-5">{value.text}</span>;
}

function CopyFactButton({
  value,
  label,
  copiedLabel,
  copyFailedLabel,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  copyFailedLabel: string;
}) {
  return (
    <Tooltip content={label}>
      <CmxButton
        type="button"
        variant="ghost"
        size="xs"
        className="h-7 w-7 shrink-0 bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] px-0"
        aria-label={label}
        onClick={() => { void copyValue(value, copiedLabel, copyFailedLabel); }}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </CmxButton>
    </Tooltip>
  );
}

async function copyValue(value: string, copied: string, failed: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    cmxMessage.success(copied);
  } catch {
    cmxMessage.error(failed);
  }
}

function PolicyRule({
  rule,
  label,
  decisionLabel,
  target,
  how,
}: {
  rule: OrderChangeEditPolicyRule;
  label: string;
  decisionLabel: string;
  target: string;
  how: string[];
}) {
  const tone = TONE[rule.decision];
  return (
    <li className={`rounded border px-3 py-2 text-sm ${tone.row}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        <span className="font-medium">{label}</span>
        <span className="text-xs">{decisionLabel}</span>
      </div>
      <p className="mt-1 text-xs">{target}</p>
      {how.map((line, index) => (
        <p key={`${rule.operationCode}-${index}`} className="mt-1 text-xs">{line}</p>
      ))}
    </li>
  );
}
