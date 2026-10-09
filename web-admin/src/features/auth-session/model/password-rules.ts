/**
 * Live password-requirement states for the checklist under the new-password fields.
 *
 * Composition rules are known as the user types. Breach and reuse are known only after the server
 * checks this exact password, so they stay pending until that verdict arrives.
 */

export type PasswordRuleId =
  | 'length'
  | 'upper'
  | 'lower'
  | 'number'
  | 'match'
  | 'different'
  | 'breached'
  | 'reused'

/** `pending` = not enough input yet, or a server rule that has not been checked for this value. `skipped` = the user kept a password the breach check warned about. */
export type PasswordRuleState = 'met' | 'unmet' | 'pending' | 'skipped'

export interface PasswordRuleResult {
  id: PasswordRuleId
  state: PasswordRuleState
}

export interface PasswordRuleInput {
  password: string
  confirmation: string
  /** Typed current password. Used only when `compareCurrent` is true. */
  currentPassword?: string
  /** Ask that the new password differ from the current one (three-field change form). */
  compareCurrent?: boolean
  /** True after the user tried to submit, so empty fields count as unmet. */
  submitted?: boolean
  /** Server rejection of the password currently in the field. Cleared when that value changes. */
  serverRule?: 'breached' | 'reused' | null
  /** The user chose to keep this password after the breach warning. */
  breachSkipped?: boolean
  /** Include the breach row. Off when the tenant policy disables the check. */
  showBreachRule?: boolean
  /** Include the reuse row. Off when password history is disabled. */
  showReuseRule?: boolean
}

const MIN_LENGTH = 8

function typedRule(met: boolean, started: boolean, submitted: boolean): PasswordRuleState {
  if (met) return 'met'
  if (started || submitted) return 'unmet'
  return 'pending'
}

/**
 * @param input - Current field values and the latest server verdict for this password
 * @returns Rules in display order
 */
export function evaluatePasswordRules(input: PasswordRuleInput): PasswordRuleResult[] {
  const password = input.password
  const confirmation = input.confirmation
  const started = password.length > 0
  const submitted = input.submitted === true

  const rules: PasswordRuleResult[] = [
    { id: 'length', state: typedRule(password.length >= MIN_LENGTH, started, submitted) },
    { id: 'upper', state: typedRule(/[A-Z]/.test(password), started, submitted) },
    { id: 'lower', state: typedRule(/[a-z]/.test(password), started, submitted) },
    { id: 'number', state: typedRule(/\d/.test(password), started, submitted) },
    {
      id: 'match',
      state:
        confirmation.length === 0
          ? submitted
            ? 'unmet'
            : 'pending'
          : password === confirmation
            ? 'met'
            : 'unmet',
    },
  ]

  if (input.compareCurrent) {
    const current = input.currentPassword ?? ''
    const bothFilled = current.length > 0 && password.length > 0
    rules.push({
      id: 'different',
      state: !bothFilled ? (submitted ? 'unmet' : 'pending') : current === password ? 'unmet' : 'met',
    })
  }

  if (input.showBreachRule !== false) {
    const breached = input.breachSkipped
      ? 'skipped'
      : input.serverRule === 'breached'
        ? 'unmet'
        : 'pending'
    rules.push({ id: 'breached', state: breached })
  }
  if (input.showReuseRule !== false) {
    rules.push({ id: 'reused', state: input.serverRule === 'reused' ? 'unmet' : 'pending' })
  }

  return rules
}
