'use client';

import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { cmxMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyInfo, OrderChangeEditPolicyRule } from '@/lib/types/order-change';
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
  const identity = policy.assignment;
  const factRows = [
    { label: t('policyInfo.facts.organizationId'), values: [identity.tenantOrgId] },
    { label: t('policyInfo.facts.profileVersion'), values: [identity.profileVersionId, identity.profileCode] },
    { label: t('policyInfo.facts.editPolicy'), values: [identity.editPolicyId, identity.policyCode] },
    { label: t('policyInfo.facts.assignmentId'), values: [identity.assignmentId] },
    { label: t('policyInfo.facts.profileId'), values: [identity.profileId] },
    { label: t('policyInfo.facts.versionNo'), values: [identity.versionNo == null ? null : String(identity.versionNo)] },
    { label: t('policyInfo.facts.versionStatus'), values: [identity.versionStatus] },
    { label: t('policyInfo.facts.policyName'), values: [identity.policyName, identity.policyName2] },
    { label: t('policyInfo.facts.lifecycle'), values: [identity.lifecycleStatus] },
    { label: t('policyInfo.facts.policyRevision'), values: [policy.policyRevision == null ? null : String(policy.policyRevision)] },
    { label: t('policyInfo.facts.workflowStatus'), values: [policy.workflowStatus] },
  ];
  const copyAll = factRows
    .map((row) => `${row.label}: ${row.values.filter((value) => value).join(' | ') || t('policyInfo.facts.empty')}`)
    .join('\n');

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg p-0 text-start sm:max-w-xl">
        <CmxDialogHeader className="border-b border-gray-100 px-4 py-3">
          <CmxDialogTitle>{t('policyInfo.title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-end">
              <CmxButton type="button" variant="outline" size="xs" onClick={() => { void copyValue(copyAll, tCommon('copied'), t('policyInfo.facts.copyFailed')); }}>
                {t('policyInfo.facts.copyAll')}
              </CmxButton>
            </div>
            <ul className="space-y-2">
              {factRows.map((row) => (
                <li key={row.label} className="text-start">
                  <p className="text-xs font-medium">{row.label}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {row.values.filter((value): value is string => Boolean(value)).length === 0 ? (
                      <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('policyInfo.facts.empty')}</span>
                    ) : row.values.filter((value): value is string => Boolean(value)).map((value, index) => (
                      <span key={`${row.label}-${index}`} className="flex min-w-0 items-start gap-2">
                        <span className="select-text break-all font-mono text-xs">{value}</span>
                        <CmxButton type="button" variant="ghost" size="xs" onClick={() => { void copyValue(value, tCommon('copied'), t('policyInfo.facts.copyFailed')); }}>
                          {t('policyInfo.facts.copy')}
                        </CmxButton>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
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
