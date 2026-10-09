'use client'

/**
 * Password requirements checklist. Each rule shows a check when met and an X when it is not.
 * Server-only rules (breach, reuse) stay neutral until this password has been checked.
 */

import { Check, Circle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import {
  evaluatePasswordRules,
  type PasswordRuleId,
  type PasswordRuleInput,
  type PasswordRuleState,
} from '../model/password-rules'

type PasswordRequirementsProps = PasswordRuleInput & {
  /** Shown on the breach row only after that check fails. */
  onSkipBreach?: () => void
  disabled?: boolean
}

const STATE_CLASS: Record<PasswordRuleState, string> = {
  met: 'text-[rgb(var(--cmx-success-rgb,22_163_74))]',
  unmet: 'text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
  pending: 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
  skipped: 'text-[rgb(var(--cmx-warning-rgb,180_83_9))]',
}

/**
 * @param props - Field values and the server verdict for the password currently typed
 */
export function PasswordRequirements({ onSkipBreach, disabled, ...props }: PasswordRequirementsProps) {
  const t = useTranslations('authSession.password')
  const rules = evaluatePasswordRules(props)

  return (
    <div className="rounded-[var(--cmx-radius-md,0.375rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252)/0.45)] p-3">
      <p className="mb-2 text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('requirements.title')}</p>
      <ul className="space-y-1.5" aria-live="polite">
        {rules.map((rule) => {
          const why = unmetExplanation(rule.id, rule.state, t)
          return (
            <li key={rule.id} data-rule={rule.id} data-state={rule.state} className="flex items-start gap-2 text-sm">
              {rule.id === 'breached' && rule.state === 'unmet' && onSkipBreach ? (
                <CmxButton type="button" size="xs" variant="outline" disabled={disabled} onClick={onSkipBreach}>
                  {t('requirements.skip')}
                </CmxButton>
              ) : null}
              <RuleMark state={rule.state} />
              <span className="min-w-0">
                <span className={rule.state === 'unmet' ? STATE_CLASS.unmet : 'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]'}>
                  {t(`requirements.${rule.id}`)}
                  <span className="sr-only"> — {t(`requirements.${rule.state}`)}</span>
                </span>
                {rule.state === 'skipped' ? (
                  <span className={`mt-0.5 block text-xs leading-snug ${STATE_CLASS.skipped}`}>{t('requirements.skippedNote')}</span>
                ) : why ? (
                  <span className={`mt-0.5 block text-xs leading-snug ${STATE_CLASS.unmet}`}>{why}</span>
                ) : rule.state === 'pending' && (rule.id === 'breached' || rule.id === 'reused') ? (
                  <span className="mt-0.5 block text-xs leading-snug text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {t('requirements.checkedOnSave')}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type PasswordTranslator = ReturnType<typeof useTranslations<'authSession.password'>>

/** Plain-language reason shown under a failed rule. Breach and reuse reuse the shared error sentences. */
function unmetExplanation(id: PasswordRuleId, state: PasswordRuleState, t: PasswordTranslator): string | null {
  if (state !== 'unmet') return null
  if (id === 'breached') return t('errors.breached')
  if (id === 'reused') return t('errors.reused')
  if (id === 'different') return t('errors.same')
  if (id === 'match') return t('errors.mismatch')
  if (id === 'length') return t('requirements.why.length')
  if (id === 'upper') return t('requirements.why.upper')
  if (id === 'lower') return t('requirements.why.lower')
  if (id === 'number') return t('requirements.why.number')
  return null
}

function RuleMark({ state }: { state: PasswordRuleState }) {
  const className = `mt-0.5 h-4 w-4 shrink-0 ${STATE_CLASS[state]}`
  if (state === 'met' || state === 'skipped') return <Check className={className} aria-hidden />
  if (state === 'unmet') return <X className={className} aria-hidden />
  return <Circle className={className} aria-hidden />
}
