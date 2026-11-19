'use client'

import { useLocale, useTranslations } from 'next-intl'

import type {
  TenantWorkflowProfileView,
  WorkflowProfileCategoryOverrideView,
  WorkflowProfileScreenStatusView,
  WorkflowProfileTemplateView,
} from '@/lib/services/workflow-profile.service'
import { CmxEmptyState } from '@ui/data-display'
import { CmxSummaryMessage, CmxStatusBadge } from '@ui/feedback'
import { CmxTabsPanel } from '@ui/navigation'

import {
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card'

interface WorkflowProfileSettingsScreenProps {
  data: TenantWorkflowProfileView
}

function localizeLabel(
  locale: string,
  primary: string | null | undefined,
  secondary: string | null | undefined,
  fallback: string,
): string {
  if (locale.startsWith('ar')) {
    return secondary?.trim() || primary?.trim() || fallback
  }
  return primary?.trim() || secondary?.trim() || fallback
}

function renderBooleanBadge(
  value: boolean,
  enabledLabel: string,
  disabledLabel: string,
) {
  return (
    <CmxStatusBadge size="sm" tone={value ? 'success' : 'neutral'}>
      {value ? enabledLabel : disabledLabel}
    </CmxStatusBadge>
  )
}

function TemplateCard({
  locale,
  template,
  defaultLabel,
  activeLabel,
  backStepsLabel,
}: {
  locale: string
  template: WorkflowProfileTemplateView
  defaultLabel: string
  activeLabel: string
  backStepsLabel: string
}) {
  return (
    <CmxCard>
      <CmxCardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CmxCardTitle>
              {localizeLabel(
                locale,
                template.templateName,
                template.templateName2,
                template.templateCode,
              )}
            </CmxCardTitle>
            <CmxCardDescription className="font-mono text-xs">
              {template.templateCode}
            </CmxCardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {template.isDefault && <CmxStatusBadge size="sm" tone="success">{defaultLabel}</CmxStatusBadge>}
            {template.isActive && <CmxStatusBadge size="sm" tone="neutral" appearance="outline">{activeLabel}</CmxStatusBadge>}
            {template.allowBackSteps && (
              <CmxStatusBadge size="sm" tone="neutral">{backStepsLabel}</CmxStatusBadge>
            )}
          </div>
        </div>
        {template.templateDescription ? (
          <CmxCardDescription>{template.templateDescription}</CmxCardDescription>
        ) : null}
      </CmxCardHeader>
      <CmxCardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {template.stages.map((stage) => (
            <CmxStatusBadge size="sm" key={`${template.templateId}:${stage.code}`} tone="neutral" appearance="outline">
              {localizeLabel(locale, stage.name, stage.name2, stage.code)}
            </CmxStatusBadge>
          ))}
        </div>
      </CmxCardContent>
    </CmxCard>
  )
}

function StatusBadge({
  locale,
  status,
}: {
  locale: string
  status: WorkflowProfileScreenStatusView
}) {
  return (
    <CmxStatusBadge size="sm" tone="neutral" appearance="outline">
      {localizeLabel(locale, status.name, status.name2, status.code)}
    </CmxStatusBadge>
  )
}

function CategoryOverrideCard({
  locale,
  item,
  t,
  tCommon,
}: {
  locale: string
  item: WorkflowProfileCategoryOverrideView
  t: ReturnType<typeof useTranslations<'workflowSettings'>>
  tCommon: ReturnType<typeof useTranslations<'common'>>
}) {
  const templateLabel =
    item.templateCode && item.templateName
      ? `${localizeLabel(locale, item.templateName, item.templateName2, item.templateCode)} (${item.templateCode})`
      : t('effectiveProfile.overrideFallback')

  return (
    <CmxCard>
      <CmxCardHeader className="gap-2">
        <CmxCardTitle>
          {localizeLabel(
            locale,
            item.serviceCategoryName,
            item.serviceCategoryName2,
            item.serviceCategoryCode,
          )}
        </CmxCardTitle>
        <CmxCardDescription className="font-mono text-xs">
          {item.serviceCategoryCode}
        </CmxCardDescription>
      </CmxCardHeader>
      <CmxCardContent className="space-y-3 text-sm">
        <div className="space-y-1">
          <div className="text-muted-foreground">
            {t('effectiveProfile.overrideTemplate')}
          </div>
          <div>{templateLabel}</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>{t('effectiveProfile.capabilities.preparation')}</span>
            {renderBooleanBadge(
              item.usePreparationScreen === true,
              tCommon('enabled'),
              tCommon('disabled'),
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>{t('effectiveProfile.capabilities.assembly')}</span>
            {renderBooleanBadge(
              item.useAssemblyScreen === true,
              tCommon('enabled'),
              tCommon('disabled'),
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>{t('effectiveProfile.capabilities.qa')}</span>
            {renderBooleanBadge(
              item.useQaScreen === true,
              tCommon('enabled'),
              tCommon('disabled'),
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span>{t('effectiveProfile.capabilities.trackPieces')}</span>
            {renderBooleanBadge(
              item.trackIndividualPiece === true,
              tCommon('enabled'),
              tCommon('disabled'),
            )}
          </div>
        </div>
      </CmxCardContent>
    </CmxCard>
  )
}

export function WorkflowProfileSettingsScreen({
  data,
}: WorkflowProfileSettingsScreenProps) {
  const locale = useLocale()
  const t = useTranslations('workflowSettings')
  const tCommon = useTranslations('common')

  const defaultTemplate = data.approvedTemplates.find((template) => template.isDefault) ?? null
  const enabledCapabilities = [
    {
      key: 'preparation',
      label: t('effectiveProfile.capabilities.preparation'),
      value: data.settingsFlags?.usePreparationScreen === true,
    },
    {
      key: 'assembly',
      label: t('effectiveProfile.capabilities.assembly'),
      value: data.settingsFlags?.useAssemblyScreen === true,
    },
    {
      key: 'qa',
      label: t('effectiveProfile.capabilities.qa'),
      value: data.settingsFlags?.useQaScreen === true,
    },
    {
      key: 'track-pieces',
      label: t('effectiveProfile.capabilities.trackPieces'),
      value: data.settingsFlags?.trackIndividualPiece === true,
    },
    {
      key: 'split-orders',
      label: t('effectiveProfile.capabilities.splitOrders'),
      value: data.settingsFlags?.ordersSplitEnabled === true,
    },
  ]

  const tabs = [
    {
      id: 'overview',
      label: t('effectiveProfile.tabs.overview'),
      content: (
        <div className="space-y-6">
          <CmxSummaryMessage
            type="info"
            title={t('effectiveProfile.summaryTitle')}
            items={[
              t('effectiveProfile.summaryPoints.readOnly'),
              t('effectiveProfile.summaryPoints.hqManaged'),
              t('effectiveProfile.summaryPoints.legacyGuard'),
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('effectiveProfile.currentModeTitle')}</CmxCardTitle>
                <CmxCardDescription>
                  {t('effectiveProfile.currentModeDescription')}
                </CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span>{t('effectiveProfile.modeLabel')}</span>
                  <CmxStatusBadge size="sm" tone="success">{t('effectiveProfile.modeV2')}</CmxStatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span>{t('effectiveProfile.defaultTemplateLabel')}</span>
                  <span className="text-end font-medium">
                    {defaultTemplate
                      ? localizeLabel(
                          locale,
                          defaultTemplate.templateName,
                          defaultTemplate.templateName2,
                          defaultTemplate.templateCode,
                        )
                      : t('effectiveProfile.notAssigned')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span>{t('effectiveProfile.assignmentCountLabel')}</span>
                  <span className="font-medium">
                    {data.workflowAssignments.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                  <span>{t('effectiveProfile.approvedTemplatesLabel')}</span>
                  <span className="font-medium">
                    {data.approvedTemplates.length}
                  </span>
                </div>
              </CmxCardContent>
            </CmxCard>

            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('effectiveProfile.capabilitiesTitle')}</CmxCardTitle>
                <CmxCardDescription>
                  {t('effectiveProfile.capabilitiesDescription')}
                </CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="grid gap-3 sm:grid-cols-2">
                {enabledCapabilities.map((capability) => (
                  <div
                    key={capability.key}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{capability.label}</span>
                    {renderBooleanBadge(
                      capability.value,
                      tCommon('enabled'),
                      tCommon('disabled'),
                    )}
                  </div>
                ))}
              </CmxCardContent>
            </CmxCard>
          </div>
        </div>
      ),
    },
    {
      id: 'assignments',
      label: t('effectiveProfile.tabs.assignments'),
      content: data.workflowAssignments.length === 0 ? (
        <CmxEmptyState
          title={t('effectiveProfile.assignmentsEmptyTitle')}
          description={t('effectiveProfile.assignmentsEmptyDescription')}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.workflowAssignments.map((assignment) => (
            <CmxCard key={assignment.id}>
              <CmxCardHeader className="gap-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CmxCardTitle className="font-mono text-base">
                      {assignment.workflowProfileId}
                    </CmxCardTitle>
                    <CmxCardDescription>
                      {assignment.workflowVersionNo == null
                        ? t('effectiveProfile.versionPending')
                        : t('effectiveProfile.versionValue', {
                            version: assignment.workflowVersionNo,
                          })}
                    </CmxCardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignment.isDefault ? (
                      <CmxStatusBadge size="sm" tone="success">
                        {t('effectiveProfile.defaultBadge')}
                      </CmxStatusBadge>
                    ) : null}
                    <CmxStatusBadge size="sm" tone={assignment.isActive ? 'neutral' : 'neutral'}>
                      {assignment.isActive
                        ? tCommon('active')
                        : tCommon('inactive')}
                    </CmxStatusBadge>
                  </div>
                </div>
              </CmxCardHeader>
              <CmxCardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {t('effectiveProfile.serviceScopeLabel')}
                  </div>
                  <div className="font-medium">
                    {assignment.serviceCode ?? t('effectiveProfile.allServices')}
                  </div>
                </div>
                <div className="rounded-md border px-3 py-2">
                  <div className="text-xs text-muted-foreground">
                    {t('effectiveProfile.branchScopeLabel')}
                  </div>
                  <div className="font-medium">
                    {assignment.branchId ?? t('effectiveProfile.allBranches')}
                  </div>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      ),
    },
    {
      id: 'templates',
      label: t('effectiveProfile.tabs.templates'),
      content: data.approvedTemplates.length === 0 ? (
        <CmxEmptyState
          title={t('effectiveProfile.templatesEmptyTitle')}
          description={t('effectiveProfile.templatesEmptyDescription')}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.approvedTemplates.map((template) => (
            <TemplateCard
              key={template.assignmentId}
              locale={locale}
              template={template}
              defaultLabel={t('effectiveProfile.defaultBadge')}
              activeLabel={tCommon('active')}
              backStepsLabel={t('effectiveProfile.backStepsEnabled')}
            />
          ))}
        </div>
      ),
    },
    {
      id: 'screens',
      label: t('effectiveProfile.tabs.screens'),
      content: data.workflowScreens.length === 0 ? (
        <CmxEmptyState
          title={t('effectiveProfile.screensEmptyTitle')}
          description={t('effectiveProfile.screensEmptyDescription')}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.workflowScreens.map((screen) => {
            const screenLabelKey = `screenContracts.screens.${screen.screenKey}`
            const resolvedScreenLabel = t.has(screenLabelKey)
              ? t(screenLabelKey as never)
              : localizeLabel(locale, screen.name, screen.name2, screen.screenKey)

            return (
              <CmxCard key={screen.screenKey}>
                <CmxCardHeader className="gap-2">
                  <CmxCardTitle>{resolvedScreenLabel}</CmxCardTitle>
                  <CmxCardDescription className="font-mono text-xs">
                    {screen.screenKey}
                  </CmxCardDescription>
                </CmxCardHeader>
                <CmxCardContent>
                  <div className="flex flex-wrap gap-2">
                    {screen.statuses.length === 0 ? (
                      <CmxStatusBadge size="sm" tone="neutral">
                        {t('effectiveProfile.noStatuses')}
                      </CmxStatusBadge>
                    ) : (
                      screen.statuses.map((status) => (
                        <StatusBadge
                          key={`${screen.screenKey}:${status.code}`}
                          locale={locale}
                          status={status}
                        />
                      ))
                    )}
                  </div>
                </CmxCardContent>
              </CmxCard>
            )
          })}
        </div>
      ),
    },
    {
      id: 'overrides',
      label: t('effectiveProfile.tabs.overrides'),
      content: data.categoryOverrides.length === 0 ? (
        <CmxEmptyState
          title={t('effectiveProfile.overridesEmptyTitle')}
          description={t('effectiveProfile.overridesEmptyDescription')}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.categoryOverrides.map((item) => (
            <CategoryOverrideCard
              key={item.id}
              locale={locale}
              item={item}
              t={t}
              tCommon={tCommon}
            />
          ))}
        </div>
      ),
    },
  ]

  return <CmxTabsPanel tabs={tabs} defaultTab="overview" />
}
