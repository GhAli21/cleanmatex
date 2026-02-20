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

#### Promise Method

```typescript
cmxMessage.promise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((result: T) => string);
    error: string | ((error: Error) => string);
  },
  options?: MessageOptions
): Promise<T>
```

### React Hook (`useMessage`)

```typescript
const {
  showSuccess,
  showError,
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

Browser alert/confirm dialogs. Use for critical errors or confirmations.

```typescript
cmxMessage.error("Critical error!", { method: "alert" });
cmxMessage.warning("Are you sure?", {
  method: "alert",
  confirm: true,
});
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
import { CmxSummaryMessage } from "@ui/feedback";
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

## Related Documentation

- [Migration Guide](./MIGRATION.md)
- [UI Blueprint](../../.claude/docs/ui_blueprint.md)
- [Frontend Standards](../../.claude/docs/frontend_standards.md)
