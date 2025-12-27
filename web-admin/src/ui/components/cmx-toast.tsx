/**
 * @deprecated This component is deprecated. Use the new global message utility instead:
 * - For React components: `import { useMessage } from '@ui/feedback'`
 * - For utility functions: `import { cmxMessage } from '@ui/feedback'`
 * 
 * See `src/ui/feedback/cmxMessage_MIGRATION.md` for migration guide.
 */

'use client'

import { toast } from 'sonner'

interface ToastOptions {
  description?: string
}

export function showSuccessToast(message: string, options?: ToastOptions) {
  toast.success(message, {
    description: options?.description,
  })
}

export function showErrorToast(message: string, options?: ToastOptions) {
  toast.error(message, {
    description: options?.description,
  })
}

export function showInfoToast(message: string, options?: ToastOptions) {
  toast(message, {
    description: options?.description,
  })
}
