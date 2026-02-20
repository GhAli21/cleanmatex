import * as React from "react"
import { cn } from "@/lib/utils"

export type AlertVariant = "info" | "success" | "warning" | "error" | "destructive"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
  /** Short message; rendered as content when no children provided (compat with compat Alert) */
  message?: string
  onClose?: () => void
}

const errorIcon = (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
)

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant: variantProp = "info", title, message, children, onClose, ...props }, ref) => {
    const variant = variantProp === "destructive" ? "error" : variantProp
    const variants: Record<Exclude<AlertVariant, "destructive">, { container: string; icon: React.ReactNode }> = {
      info: {
        container: "bg-blue-50 border-blue-200 text-blue-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        ),
      },
      success: {
        container: "bg-green-50 border-green-200 text-green-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
      },
      warning: {
        container: "bg-yellow-50 border-yellow-200 text-yellow-800",
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ),
      },
      error: {
        container: "bg-red-50 border-red-200 text-red-800",
        icon: errorIcon,
      },
    }

    const { container, icon } = variants[variant]

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex gap-3 rounded-lg border p-4",
          container,
          className
        )}
        role="alert"
        {...props}
      >
        <div className="flex-shrink-0">{icon}</div>

        <div className="flex-1 space-y-1">
          {title && <h5 className="font-semibold">{title}</h5>}
          {(message ?? children) && (
            <div className="text-sm">{message ?? children}</div>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    )
  }
)

Alert.displayName = "Alert"

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function AlertDescription({ children, className, ...props }: AlertDescriptionProps) {
  return (
    <div className={cn("text-sm", className)} {...props}>
      {children}
    </div>
  )
}

export { Alert }
