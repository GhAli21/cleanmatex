/**
 * Business-rule failure shared by every password flow (self change, recovery reset, admin reset).
 * The `code` is one of PASSWORD_ERROR_CODES (single source: lib/constants/auth-session.ts) so the API layer and
 * the UI can map it without parsing messages.
 */

import type { PasswordErrorCode } from '@/lib/constants/auth-session'

export class PasswordError extends Error {
  constructor(
    public readonly code: PasswordErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PasswordError'
  }
}
