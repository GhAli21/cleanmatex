'use client';

import { Alert, AlertDescription, CmxButton } from '@ui/primitives';
import { useTranslations, useLocale } from 'next-intl';
import { useWorkflowActions } from '@/lib/hooks/use-workflow-actions';

export interface WorkflowActionBarProps {
  orderId: string;
  screen: string;
  /** Optional: hide when engine canary is off (default true). */
  hideWhenDisabled?: boolean;
  className?: string;
  onActionSuccess?: () => void;
}

/**
 * Floor action CTA bar driven by listAvailableActions / executeAction.
 * Shows enabled actions as primary buttons; disabled actions with blocked reasons.
 * No raw toStatus picker — action codes only (V1.0 UX contract).
 */
export function WorkflowActionBar({
  orderId,
  screen,
  hideWhenDisabled = true,
  className,
  onActionSuccess,
}: WorkflowActionBarProps) {
  const t = useTranslations('workflow.engine');
  const locale = useLocale();
  const { enabled, loading, actions, currentStatus, execute } = useWorkflowActions(
    orderId,
    screen,
  );

  if (!enabled && hideWhenDisabled) {
    return null;
  }

  if (!enabled) {
    return (
      <Alert variant="info" title={t('actionBarTitle')} className={className}>
        <AlertDescription>{t('canaryOff')}</AlertDescription>
      </Alert>
    );
  }

  const visible = actions.filter((a) => a.enabled || a.blockedReasons.length > 0);

  return (
    <section
      className={className ?? 'rounded-lg border border-border bg-card p-4 space-y-3'}
      aria-label={t('actionBarLabel')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{t('actionBarTitle')}</h2>
        {currentStatus ? (
          <span className="text-xs text-muted-foreground">
            {t('statusLabel', { status: currentStatus })}
          </span>
        ) : null}
      </div>

      {loading && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : null}

      {!loading && visible.length === 0 ? (
        <Alert variant="info" title={t('noActionsTitle')}>
          <AlertDescription>{t('noActions')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {visible.map((action) => {
          const label =
            locale.startsWith('ar') && action.label2 ? action.label2 : action.label;
          const blockedHint = action.blockedReasons
            .map((r) => (locale.startsWith('ar') && r.message2 ? r.message2 : r.message))
            .join(' · ');

          return (
            <div key={action.actionCode} className="flex flex-col gap-1 min-w-[10rem] flex-1 sm:flex-none">
              <CmxButton
                type="button"
                variant={action.enabled ? 'primary' : 'outline'}
                size="sm"
                className="w-full"
                disabled={!action.enabled || loading}
                loading={loading}
                title={!action.enabled ? blockedHint : undefined}
                onClick={() => {
                  void (async () => {
                    const ok = await execute(action.actionCode);
                    if (ok) onActionSuccess?.();
                  })();
                }}
              >
                {label}
              </CmxButton>
              {!action.enabled && blockedHint ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {blockedHint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
