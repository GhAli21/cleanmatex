/**
 * @deprecated This component is deprecated. Use the new global message utility instead:
 * - For React components: `import { useMessage } from '@ui/feedback'`
 * - For utility functions: `import { cmxMessage } from '@ui/feedback'`
 *
 * See `src/ui/feedback/cmxMessage_MIGRATION.md` for migration guide.
 *
 * Bridged to cmxMessage so Session Activity capture and toast durations stay single-path.
 */

'use client'

import { cmxMessage } from '@ui/feedback/cmx-message'
import { DisplayMethod } from '@ui/feedback/types'

interface ToastOptions {
  description?: string
}

/**
 *
 * @param message
 * @param options
 */
export function showSuccessToast(message: string, options?: ToastOptions) {
  cmxMessage.success(message, {
    description: options?.description,
    method: DisplayMethod.TOAST,
  })
}

/**
 *
 * @param message
 * @param options
 */
export function showErrorToast(message: string, options?: ToastOptions) {
  cmxMessage.error(message, {
    description: options?.description,
    method: DisplayMethod.TOAST,
  })
}

/**
 *
 * @param message
 * @param options
 */
export function showInfoToast(message: string, options?: ToastOptions) {
  cmxMessage.info(message, {
    description: options?.description,
    method: DisplayMethod.TOAST,
  })
}
