# Migration Guide: Global Message Utility

This guide helps you migrate from old message/toast implementations to the new unified `cmxMessage` utility.

## Overview

The new global message utility consolidates:
- `src/ui/feedback/cmx-toast.ts` (deprecated)
- `lib/utils/toast.ts` (deprecated)

Into a single, unified API: `cmxMessage` from `@ui/feedback`.

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { cmxToast, showSuccessToast } from '@ui/feedback';
// or
import { toast } from '@/lib/utils/toast';
```

**After:**
```typescript
import { cmxMessage, showSuccess } from '@ui/feedback';
// or for React components
import { useMessage } from '@ui/feedback';
```

### Step 2: Update Method Calls

#### Basic Messages

**Before:**
```typescript
cmxToast.success('Order created');
cmxToast.error('Failed to save');
cmxToast.info('Processing...');
```

**After:**
```typescript
cmxMessage.success('Order created');
cmxMessage.error('Failed to save');
cmxMessage.info('Processing...');
```

#### With Options

**Before:**
```typescript
cmxToast.success('Saved!', { description: 'Order #123' });
```

**After:**
```typescript
cmxMessage.success('Saved!', { description: 'Order #123' });
// Options are the same, but now you can also specify method:
cmxMessage.success('Saved!', { 
  description: 'Order #123',
  method: 'toast', // or 'alert', 'console', 'inline'
});
```

#### Old toast utility

**Before:**
```typescript
import { toast } from '@/lib/utils/toast';

toast.success('Saved!');
toast.error('Error!');
toast.warning('Warning!');
toast.info('Info');
```

**After:**
```typescript
import { cmxMessage } from '@ui/feedback';

cmxMessage.success('Saved!');
cmxMessage.error('Error!');
cmxMessage.warning('Warning!');
cmxMessage.info('Info');
```

### Step 3: Promise Handling

**Before:**
```typescript
import { toast } from '@/lib/utils/toast';

toast.promise(
  saveOrder(),
  {
    loading: 'Saving...',
    success: 'Saved!',
    error: 'Failed to save',
  }
);
```

**After:**
```typescript
import { cmxMessage } from '@ui/feedback';

cmxMessage.promise(
  saveOrder(),
  {
    loading: 'Saving...',
    success: 'Saved!',
    error: 'Failed to save',
  }
);
```

### Step 4: React Components (Recommended)

**Before:**
```typescript
import { cmxToast } from '@ui/feedback';
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('orders');
  
  const handleSave = () => {
    cmxToast.success(t('messages.saveSuccess'));
  };
}
```

**After (Recommended):**
```typescript
import { useMessage } from '@ui/feedback';
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('orders');
  const { showSuccess, showError } = useMessage();
  
  const handleSave = async () => {
    try {
      await saveOrder();
      showSuccess(t('messages.saveSuccess'));
    } catch (error) {
      showError(t('errors.saveFailed'));
    }
  };
}
```

## Common Patterns

### Pattern 1: Simple Success/Error

**Before:**
```typescript
if (success) {
  cmxToast.success('Saved!');
} else {
  cmxToast.error('Failed!');
}
```

**After:**
```typescript
if (success) {
  cmxMessage.success('Saved!');
} else {
  cmxMessage.error('Failed!');
}
```

### Pattern 2: Async Operations

**Before:**
```typescript
const handleSave = async () => {
  try {
    await saveData();
    cmxToast.success('Saved!');
  } catch (error) {
    cmxToast.error('Failed to save');
  }
};
```

**After (Option 1 - Manual):**
```typescript
const handleSave = async () => {
  try {
    await saveData();
    cmxMessage.success('Saved!');
  } catch (error) {
    cmxMessage.error('Failed to save');
  }
};
```

**After (Option 2 - Promise Method):**
```typescript
const handleSave = async () => {
  await cmxMessage.promise(
    saveData(),
    {
      loading: 'Saving...',
      success: 'Saved!',
      error: 'Failed to save',
    }
  );
};
```

### Pattern 3: With i18n

**Before:**
```typescript
import { cmxToast } from '@ui/feedback';
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations();
  cmxToast.success(t('messages.saveSuccess'));
}
```

**After:**
```typescript
import { useMessage } from '@ui/feedback';
import { useTranslations } from 'next-intl';

function Component() {
  const t = useTranslations();
  const { showSuccess } = useMessage();
  showSuccess(t('messages.saveSuccess'));
}
```

Or even simpler (auto-translation):
```typescript
import { useMessage } from '@ui/feedback';

function Component() {
  const { showSuccess } = useMessage();
  // Automatically translates if it looks like a translation key
  showSuccess('messages.saveSuccess');
}
```

## Breaking Changes

### 1. Method Names

- `cmxToast.success()` → `cmxMessage.success()`
- `cmxToast.error()` → `cmxMessage.error()`
- `cmxToast.info()` → `cmxMessage.info()`
- `showSuccessToast()` → `showSuccess()` or `cmxMessage.success()`

### 2. Options Structure

Options structure is mostly the same, but now includes `method` option:

```typescript
// New: method option
cmxMessage.success('Saved!', { method: 'toast' });
```

### 3. Promise API

Promise API is the same, but now supports function callbacks:

```typescript
// New: function callbacks
cmxMessage.promise(
  saveOrder(),
  {
    loading: 'Saving...',
    success: (result) => `Order ${result.orderNo} saved!`,
    error: (error) => `Failed: ${error.message}`,
  }
);
```

## Backward Compatibility

The old implementations are still available but deprecated:

- `cmxToast` - Still works but shows deprecation warnings
- `lib/utils/toast.ts` - Still works but should be migrated

**Recommendation:** Migrate as soon as possible to avoid future breaking changes.

## Hybrid Approach for Forms

**Important**: For form components with error handling, use a **hybrid approach**:

- **Keep React state** for inline error display (needs re-render)
- **Add cmxMessage** for global notifications (toast/alert)

### Example: Form Error Handling

**Before:**
```typescript
const [error, setError] = useState<string | null>(null);

catch (error) {
  console.error('Error:', error);
  setError(error.message);
}
```

**After (Hybrid Approach):**
```typescript
import { useMessage } from '@ui/feedback';
const { showErrorFrom } = useMessage();
const [error, setError] = useState<string | null>(null);

catch (error) {
  const errorMsg = error instanceof Error ? error.message : t('errors.operationFailed');
  setError(errorMsg); // ✅ Keep for inline display
  showErrorFrom(error); // ✅ Add global notification
}

// Render inline error (unchanged)
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-700">{error}</p>
  </div>
)}
```

**Why Hybrid?**
- React state controls component re-renders for inline errors
- cmxMessage provides global feedback (toast notifications)
- Best UX: Users see both inline errors AND global notifications

## Migration Checklist

- [ ] Update imports from `cmxToast` to `cmxMessage`
- [ ] Update imports from `@/lib/utils/toast` to `@ui/feedback`
- [ ] Replace `cmxToast.*` calls with `cmxMessage.*`
- [ ] Replace `toast.*` calls with `cmxMessage.*`
- [ ] Replace direct `sonner` imports with `useMessage` hook
- [ ] Update React components to use `useMessage` hook (optional but recommended)
- [ ] For forms: Implement hybrid approach (React state + cmxMessage)
- [ ] Test all message displays
- [ ] Test dark mode styling
- [ ] Remove old imports
- [ ] Update any custom message handling

## Need Help?

- See [README.md](./README.md) for full API documentation
- Check examples in the codebase
- Review type definitions in `types.ts`

## Timeline

- **Phase 1 (Current)**: Old implementations deprecated but functional
- **Phase 2 (Future)**: Old implementations removed
- **Target**: Complete migration before Phase 2
