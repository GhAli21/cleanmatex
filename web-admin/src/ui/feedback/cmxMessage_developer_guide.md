# Global Message Utility

Unified API for displaying messages across the application with support for multiple display methods (Toast, Alert, Console, Inline) and full i18n/RTL support.

## Quick Start

```typescript
import { cmxMessage } from "@ui/feedback";
// or
import { useMessage } from "@ui/feedback";

// Direct usage
cmxMessage.success("Order created successfully");
cmxMessage.error("Failed to save");

// React hook (with i18n)
const { showSuccess, showError } = useMessage();
showSuccess(t("messages.saveSuccess"));
```

## Features

- **Multiple Display Methods**: Toast, Alert, Console, Inline
- **Type-Safe**: Full TypeScript support
- **i18n Integration**: Automatic translation support
- **RTL Support**: Right-to-left layout awareness
- **Promise Support**: Built-in promise handling with loading/success/error states
- **Configurable**: Customizable defaults and per-call overrides
- **Custom Alert Dialogs**: Styled, accessible confirmation dialogs
- **Error Extraction**: Automatic error message extraction from various error types
- **Message Queuing**: Queue management for multiple simultaneous messages
- **Rich Content**: Support for React nodes and HTML content
- **Retry Logic**: Built-in retry mechanism for failed operations
- **Accessibility**: Full ARIA support and keyboard navigation

## API Reference

### Core Utility (`cmxMessage`)

#### Basic Methods

```typescript
cmxMessage.success(message: string, options?: MessageOptions): MessageResult
cmxMessage.error(message: string, options?: MessageOptions): MessageResult
cmxMessage.warning(message: string, options?: MessageOptions): MessageResult
cmxMessage.info(message: string, options?: MessageOptions): MessageResult
cmxMessage.loading(message: string, options?: MessageOptions): MessageResult
```

#### Error Extraction Method

```typescript
cmxMessage.errorFrom(
  error: unknown,
  options?: ErrorExtractionOptions
): MessageResult
```

Automatically extracts error messages from Error, AxiosError, Supabase errors, fetch responses, and plain objects.

#### Confirm Dialog Method

```typescript
cmxMessage.confirm(options: ConfirmDialogOptions): Promise<boolean>
```

Shows a custom styled confirmation dialog. Returns `true` if confirmed, `false` if cancelled.

#### Batch Method

```typescript
cmxMessage.batch(
  messages: Array<{
    type: MessageType;
    message: string;
    options?: MessageOptions;
  }>
): Promise<MessageResult[]>
```

Shows multiple messages sequentially with a delay between them.

#### Promise Method

```typescript
cmxMessage.promise<T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T>
```

Supports retry logic when `options.retry` is configured. Use a function `() => Promise<T>` for retry to work properly.

### React Hook (`useMessage`)

```typescript
const {
  showSuccess,
  showError,
  showErrorFrom,
  showWarning,
  showInfo,
  showLoading,
  handlePromise,
} = useMessage();
```

The hook automatically integrates with `useTranslations` from `next-intl` for i18n support.

## Display Methods

### 1. Toast (Default)

Sonner toast notifications. Best for most user-facing messages.

```typescript
cmxMessage.success("Saved!", { method: "toast" });
cmxMessage.error("Error!", {
  method: "toast",
  description: "Additional details here",
  duration: 5000,
});
```

### 2. Alert

Custom styled alert/confirm dialogs with full accessibility support. Use for critical errors or confirmations.

```typescript
// Simple alert
cmxMessage.error("Critical error!", { method: "alert" });

// Confirm dialog (legacy API)
cmxMessage.warning("Are you sure?", {
  method: "alert",
  confirm: true,
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
});

// New confirm API (recommended)
const confirmed = await cmxMessage.confirm({
  title: "Delete Order?",
  message: "This action cannot be undone.",
  variant: "destructive",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
});

if (confirmed) {
  // Handle deletion
}
```

### 3. Console

Console logging. Useful for development and debugging.

```typescript
cmxMessage.info("Debug info", { method: "console" });
cmxMessage.error("Error logged", {
  method: "console",
  data: { userId: 123, action: "save" },
});
```

### 4. Inline

Returns message object for component rendering. Use with `SummaryMessage` component.

```typescript
const result = cmxMessage.success("Saved!", { method: "inline" });
// result.message contains: { type, title, description, ... }

// In component:
{
  result.message && (
    <SummaryMessage
      type={result.message.type}
      title={result.message.title}
      items={result.message.items}
      onDismiss={result.dismiss}
    />
  );
}
```

## Message Options

```typescript
interface MessageOptions {
  method?: DisplayMethod; // Override default display method
  description?: string; // Additional description/details
  duration?: number; // Duration in ms (for toast)
  dismissible?: boolean; // Whether message can be dismissed
  action?: {
    // Action button (for toast)
    label: string;
    onClick: () => void;
  };
  data?: Record<string, unknown>; // Custom data
  onDismiss?: () => void; // Callback when dismissed
  confirm?: boolean; // Show as confirm dialog (alert)
  confirmLabel?: string; // Confirm button label
  cancelLabel?: string; // Cancel button label
  content?: React.ReactNode; // Rich content (React node)
  html?: boolean; // Enable HTML rendering (sanitized)
  retry?: {
    maxAttempts?: number; // Maximum retry attempts
    delay?: number; // Delay between retries (ms)
    exponentialBackoff?: boolean; // Use exponential backoff
    onRetry?: (attempt: number) => string; // Retry message callback
    shouldRetry?: (error: unknown) => boolean; // Retry condition
  };
}
```

## Examples

### Basic Usage

```typescript
import { cmxMessage } from "@ui/feedback";

// Success message
cmxMessage.success("Order created successfully");

// Error with description
cmxMessage.error("Failed to save", {
  description: "Please check your connection and try again.",
});

// Warning
cmxMessage.warning("This action cannot be undone");

// Info
cmxMessage.info("Processing your request...");
```

### With i18n

```typescript
import { useMessage } from "@ui/feedback";
import { useTranslations } from "next-intl";

function MyComponent() {
  const t = useTranslations("orders");
  const { showSuccess, showError } = useMessage();

  const handleSave = async () => {
    try {
      await saveOrder();
      showSuccess(t("messages.saveSuccess"));
    } catch (error) {
      showError(t("errors.saveFailed"));
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### Promise Handling

```typescript
import { cmxMessage } from "@ui/feedback";

// Automatic loading/success/error states
await cmxMessage.promise(saveOrder(orderData), {
  loading: "Saving order...",
  success: (result) => `Order ${result.orderNo} saved!`,
  error: (error) => `Failed to save: ${error.message}`,
});

// With retry logic (use function for retry to work)
await cmxMessage.promise(
  () => saveOrder(orderData),
  {
    loading: "Saving order...",
    success: "Order saved!",
    error: "Failed to save",
  },
  {
    retry: {
      maxAttempts: 3,
      delay: 1000,
      exponentialBackoff: true,
      onRetry: (attempt) => `Retrying... (${attempt}/3)`,
      shouldRetry: (error) => {
        // Only retry on network errors
        return error instanceof TypeError && error.message.includes('fetch');
      },
    },
  }
);
```

### Error Extraction

```typescript
import { cmxMessage } from "@ui/feedback";

try {
  await fetchData();
} catch (error) {
  // Automatically extracts message from various error types
  cmxMessage.errorFrom(error, {
    fallback: "An unexpected error occurred",
    extractFrom: ["message", "error", "detail"], // Custom extraction paths
  });
}

// With React hook
const { showErrorFrom } = useMessage();
showErrorFrom(error);
```

### Custom Confirm Dialogs

```typescript
import { cmxMessage } from "@ui/feedback";

// Delete confirmation
const confirmed = await cmxMessage.confirm({
  title: "Delete Order?",
  message: "This action cannot be undone.",
  variant: "destructive",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
});

if (confirmed) {
  await deleteOrder(orderId);
}

// Success confirmation
const proceed = await cmxMessage.confirm({
  title: "Order Created",
  message: "Would you like to view the order?",
  variant: "success",
  confirmLabel: "View Order",
  cancelLabel: "Close",
});
```

### Message Queuing

```typescript
import { cmxMessage } from "@ui/feedback";

// Enable queuing
cmxMessage.setConfig({
  queueMessages: true,
  maxQueueSize: 3,
});

// Messages will be queued and shown sequentially
cmxMessage.success("First message");
cmxMessage.info("Second message");
cmxMessage.warning("Third message");

// Clear queue
cmxMessage.clearQueue();
```

### Batch Messages

```typescript
import { cmxMessage } from "@ui/feedback";

// Show multiple messages sequentially
await cmxMessage.batch([
  { type: "success", message: "Order saved" },
  { type: "info", message: "Email sent" },
  { type: "success", message: "Notification sent" },
]);
```

### Rich Content

```typescript
import { cmxMessage } from "@ui/feedback";
import Link from "next/link";

// React node content
cmxMessage.success("Order created", {
  content: <Link href="/orders/123">View Order</Link>,
});

// HTML content (sanitized)
cmxMessage.info("Order status", {
  html: true,
  description: "<strong>Status:</strong> Processing",
});
```

### With React Hook

```typescript
import { useMessage } from "@ui/feedback";

function MyComponent() {
  const { handlePromise } = useMessage();
  const t = useTranslations("orders");

  const handleSave = async () => {
    await handlePromise(saveOrder(orderData), {
      loading: t("messages.saving"),
      success: t("messages.saveSuccess"),
      error: t("errors.saveFailed"),
    });
  };
}
```

### Different Display Methods

```typescript
// Toast (default)
cmxMessage.success("Saved!");

// Alert
cmxMessage.error("Critical error!", { method: "alert" });

// Console (development)
cmxMessage.info("Debug info", { method: "console" });

// Inline (for component rendering)
const result = cmxMessage.success("Saved!", { method: "inline" });
```

### Toast with Action Button

```typescript
cmxMessage.success("Order created", {
  action: {
    label: "View Order",
    onClick: () => router.push(`/orders/${orderId}`),
  },
});
```

### Inline Messages in Components

```typescript
import { useMessage } from "@ui/feedback";
import { SummaryMessage } from "@ui/compat";
import { useState, useEffect } from "react";

function MyComponent() {
  const { showSuccess, showError } = useMessage();
  const [inlineMessage, setInlineMessage] = useState(null);

  useEffect(() => {
    const result = showSuccess("Saved!", { method: "inline" });
    if (result.message) {
      setInlineMessage(result.message);
    }
  }, []);

  return (
    <div>
      {inlineMessage && (
        <SummaryMessage
          type={inlineMessage.type}
          title={inlineMessage.title}
          items={inlineMessage.items}
          onDismiss={() => setInlineMessage(null)}
        />
      )}
    </div>
  );
}
```

### Hybrid Approach: React State + cmxMessage

**Important**: `cmxMessage` is designed for **global notifications** (toast, alert, console). For **component-level state** (form errors, loading states), use a **hybrid approach**:

- **Keep React state** (`useState`, `setError`, `setIsSubmitting`) for component-level concerns that need re-renders
- **Add cmxMessage** for global notifications alongside local state
- **Result**: Better UX with both inline errors AND global notifications

```typescript
import { useMessage } from "@ui/feedback";
import { useState } from "react";

function MyForm() {
  const { showErrorFrom } = useMessage();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await saveData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg); // ✅ Keep for inline display
      showErrorFrom(err, { fallback: "Failed to save" }); // ✅ Add global notification
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Inline error display (unchanged) */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      <button disabled={isSubmitting}>Save</button>
    </form>
  );
}
```

**Decision Matrix:**

| Scenario | Solution | Reason |
|----------|----------|--------|
| Form validation errors | Keep React state + cmxMessage | Need immediate re-render, also show global notification |
| API error after submit | cmxMessage only | Global notification sufficient |
| Loading state | Keep React state + cmxMessage.promise | State controls UI, promise shows notification |
| Success after submit | cmxMessage only | Global notification sufficient |
| Field-level errors | Keep React state | Component-specific, needs re-render |

## Configuration

### Default Configuration

```typescript
import { setMessageConfig } from "@ui/feedback";

// Change default display method
setMessageConfig({
  defaultMethod: "alert", // or 'toast', 'console', 'inline'
});

// Change toast durations
setMessageConfig({
  durations: {
    success: 5000,
    error: 7000,
    warning: 4000,
    info: 3000,
  },
});
```

### RTL Support

RTL support is automatically handled based on document direction. The toast position adjusts automatically:

- LTR: `top-right`
- RTL: `top-left`

## Migration

See [MIGRATION.md](./MIGRATION.md) for migrating from old implementations.

## Type Definitions

All types are exported from `@ui/feedback`:

```typescript
import type {
  MessageType,
  DisplayMethod,
  MessageOptions,
  MessageResult,
  PromiseMessageConfig,
} from "@ui/feedback";
```

## Best Practices

1. **Use Toast for most messages** - Best user experience
2. **Use Alert for critical errors** - Requires user attention
3. **Use Console for debugging** - Development only
4. **Use Inline for form validation** - Component-level feedback
5. **Always use i18n** - Use `useMessage` hook or translate manually
6. **Handle promises** - Use `promise()` method for async operations
7. **Provide descriptions** - Add context with `description` option
8. **Use errorFrom()** - Automatically extract error messages instead of manual extraction
9. **Enable queuing** - Use message queuing when showing multiple messages rapidly
10. **Use confirm()** - Use custom confirm dialogs instead of native alerts for better UX
11. **Add retry logic** - Use retry configuration for network operations
12. **Ensure accessibility** - All dialogs include proper ARIA attributes and keyboard navigation

## Setup

### Alert Dialog Provider

To use custom alert dialogs, add the `AlertDialogProvider` to your app root:

```typescript
// app/layout.tsx or app/providers.tsx
import { AlertDialogProvider } from "@ui/feedback";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AlertDialogProvider>
          {children}
        </AlertDialogProvider>
      </body>
    </html>
  );
}
```

## Related Documentation

- [Migration Guide](./MIGRATION.md)
- [UI Blueprint](../../.claude/docs/ui_blueprint.md)
- [Frontend Standards](../../.claude/docs/frontend_standards.md)
