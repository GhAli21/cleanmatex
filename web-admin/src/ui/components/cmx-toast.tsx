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
