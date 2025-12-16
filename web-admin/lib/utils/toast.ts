/**
 * Toast Notification Utilities
 * Wrapper around react-hot-toast for consistent notifications
 * 
 * @deprecated This module is deprecated. Use the new global message utility instead:
 * - For React components: `import { useMessage } from '@ui/feedback'`
 * - For utility functions: `import { cmxMessage } from '@ui/feedback'`
 * 
 * See `src/ui/feedback/MIGRATION.md` for migration guide.
 */

// Note: Install react-hot-toast first: npm install react-hot-toast
// For now, we'll provide a simple console-based fallback

interface ToastOptions {
  duration?: number
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

// Simple fallback implementation (replace with react-hot-toast when installed)
class Toast {
  success(message: string, options?: ToastOptions) {
    console.log('✅ SUCCESS:', message)
    this.showBrowserNotification('success', message)
  }

  error(message: string, options?: ToastOptions) {
    console.error('❌ ERROR:', message)
    this.showBrowserNotification('error', message)
  }

  info(message: string, options?: ToastOptions) {
    console.info('ℹ️ INFO:', message)
    this.showBrowserNotification('info', message)
  }

  warning(message: string, options?: ToastOptions) {
    console.warn('⚠️ WARNING:', message)
    this.showBrowserNotification('warning', message)
  }

  loading(message: string) {
    console.log('⏳ LOADING:', message)
    return () => console.log('✓ DONE:', message)
  }

  promise<T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string
      success: string
      error: string
    }
  ): Promise<T> {
    console.log('⏳', loading)
    return promise
      .then((result) => {
        console.log('✅', success)
        this.showBrowserNotification('success', success)
        return result
      })
      .catch((err) => {
        console.error('❌', error)
        this.showBrowserNotification('error', error)
        throw err
      })
  }

  private showBrowserNotification(type: string, message: string) {
    // Simple browser alert fallback
    if (typeof window === 'undefined') return

    // Create a simple toast notification element
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `

    // Set background color based on type
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      info: '#3b82f6',
      warning: '#f59e0b',
    }
    toast.style.backgroundColor = colors[type as keyof typeof colors] || colors.info

    toast.textContent = message

    document.body.appendChild(toast)

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in'
      setTimeout(() => document.body.removeChild(toast), 300)
    }, 3000)
  }
}

export const toast = new Toast()

// Add keyframe animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)
}

// Usage:
// import { toast } from '@/lib/utils/toast'
//
// toast.success('Customer created successfully')
// toast.error('Failed to save changes')
// toast.info('Processing your request...')
// toast.warning('This action cannot be undone')
//
// // With promise
// toast.promise(
//   saveCustomer(),
//   {
//     loading: 'Saving customer...',
//     success: 'Customer saved!',
//     error: 'Failed to save customer'
//   }
// )
