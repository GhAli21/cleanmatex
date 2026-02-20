---
name: cmxMessage Enhancements and Project-Wide Migration
overview: Implement all recommended enhancements to cmxMessage (DOMPurify, error boundaries, unit tests, rate limiting, developer warnings, dark mode verification) then execute comprehensive project-wide migration replacing all legacy notification systems with cmxMessage.
todos: []
---

# cmxMessage Enhancements and Project-Wide Migration Plan

## Overview

This plan implements all recommended enhancements to `cmxMessage` (Phase 0) before executing a comprehensive project-wide migration (Phases 1-5) to replace all legacy notification systems with the unified `cmxMessage` utility.

## Phase 0: Enhancements (Before Migration)

### 0.1 High Priority Enhancements

**0.1.1 Replace HTML Sanitizer with DOMPurify**

- **File**: `web-admin/src/ui/feedback/utils/html-sanitizer.ts`
- **Action**: Install `isomorphic-dompurify` package and replace basic sanitizer
- **Implementation**:
  ```typescript
          import DOMPurify from 'isomorphic-dompurify';
          
          const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'span', 'div', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
          const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];
          
          export function sanitizeHtml(html: string): string {
            if (typeof window === 'undefined') {
              return html; // Server-side: return as-is
            }
            return DOMPurify.sanitize(html, {
              ALLOWED_TAGS,
              ALLOWED_ATTR,
              ALLOW_DATA_ATTR: false,
            });
          }
  ```




- **Dependencies**: Add `isomorphic-dompurify` to `package.json`
- **Testing**: Verify XSS prevention with malicious HTML inputs

**0.1.2 Add Error Boundaries**

- **File**: `web-admin/src/ui/feedback/cmx-message.ts`
- **Action**: Wrap all `show()` method calls in try-catch blocks
- **Implementation**:
  ```typescript
          private show(type: MessageType, message: string, options?: MessageOptions): MessageResult {
            try {
              // Validate message length
              const validatedMessage = this.validateMessage(message);
              
              // Existing show logic...
            } catch (error) {
              console.error('cmxMessage error:', error);
              // Fallback to console or native alert
              if (typeof window !== 'undefined') {
                try {
                  window.alert(validatedMessage || message);
                } catch {
                  console.error('Failed to show message:', message);
                }
              }
              return { id: '', dismiss: () => {} };
            }
          }
          
          private validateMessage(message: string): string {
            if (message.length > 1000) {
              console.warn('Message too long, truncating');
              return message.substring(0, 1000) + '...';
            }
            return message;
          }
  ```




- **Testing**: Test with invalid inputs, null/undefined messages

**0.1.3 Add Unit Tests**

- **Files**: 
- `web-admin/src/ui/feedback/__tests__/cmx-message.test.ts`
- `web-admin/src/ui/feedback/__tests__/error-extractor.test.ts`
- `web-admin/src/ui/feedback/__tests__/html-sanitizer.test.ts`
- `web-admin/src/ui/feedback/__tests__/message-queue.test.ts`
- **Coverage**: Test all public methods, error extraction, sanitization, queuing
- **Framework**: Jest/Vitest (already configured)
- **Test Cases**:
- Error extraction from various error types
- HTML sanitization (XSS prevention)
- Message queuing and batching
- Promise handling with retry logic
- Confirm dialogs
- React hook integration

### 0.2 Medium Priority Enhancements

**0.2.1 Add Rate Limiting**

- **File**: `web-admin/src/ui/feedback/cmx-message.ts`
- **Action**: Implement message throttling to prevent spam
- **Implementation**:
  ```typescript
          private lastMessageTime = 0;
          private messageThrottle = 100; // ms
          
          private shouldThrottle(): boolean {
            const now = Date.now();
            if (now - this.lastMessageTime < this.messageThrottle) {
              return true;
            }
            this.lastMessageTime = now;
            return false;
          }
          
          private show(type: MessageType, message: string, options?: MessageOptions): MessageResult {
            if (this.shouldThrottle() && !options?.force) {
              // Queue message instead of showing immediately
              if (getMessageConfig().queueMessages) {
                messageQueue.enqueue({ type, message, options });
                return { id: '', dismiss: () => {} };
              }
            }
            // Continue with normal show logic...
          }
  ```




- **Configuration**: Add `throttleMs` to `MessageConfig` type

**0.2.2 Improve Developer Warnings**

- **File**: `web-admin/src/ui/feedback/utils/alert-dialog-manager.tsx`
- **Action**: Add development-mode warnings when AlertDialogProvider is missing
- **Implementation**:
  ```typescript
          showConfirm(options: ConfirmOptions): Promise<boolean> {
            if (!this.providerRef && typeof window !== 'undefined') {
              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  'AlertDialogProvider not found. Add <AlertDialogProvider> to AppProviders.tsx'
                );
              }
              // Fallback to native confirm
              return Promise.resolve(window.confirm(options.message || options.title || 'Confirm?'));
            }
            // Existing logic...
          }
  ```




- **File**: `web-admin/src/ui/feedback/cmx-message.ts`
- **Action**: Add warnings for common misconfigurations

**0.2.3 Verify Dark Mode Styling**

- **Files**: 
- `web-admin/src/ui/feedback/components/cmx-alert-dialog.tsx`
- `web-admin/src/ui/feedback/methods/toast-method.ts`
- **Action**: Test and verify dark mode contrast ratios, styling
- **Testing**: 
- Visual testing in dark mode
- WCAG contrast ratio verification (minimum 4.5:1 for text)
- Ensure all variants (success, error, warning, info) are visible

### 0.3 Low Priority Enhancements (Post-Launch)

**0.3.1 Add Analytics Hooks**

- **File**: `web-admin/src/ui/feedback/types.ts`
- **Action**: Add optional analytics callback to `MessageConfig`
- **Implementation**:
  ```typescript
          export interface MessageConfig {
            // ... existing config
            onMessageShown?: (message: { type: MessageType; message: string; method: DisplayMethod }) => void;
          }
  ```




- **Usage**: Allow integration with analytics services

**0.3.2 Enhance Animations**

- **Files**: 
- `web-admin/src/ui/feedback/components/cmx-alert-dialog.tsx`
- Toast animations (via Sonner configuration)
- **Action**: Add entrance/exit animations, micro-interactions
- **Note**: Sonner already provides animations; enhance alert dialog transitions

**0.3.3 Add JSDoc Comments**

- **Files**: All public APIs in `web-admin/src/ui/feedback/`
- **Action**: Add comprehensive JSDoc comments to all exported functions, classes, hooks
- **Format**: Include parameter descriptions, return types, examples, @throws tags

## Phase 1: Foundation Setup (Prerequisites)

### 1.1 Add AlertDialogProvider to App Root

- **File**: `web-admin/lib/providers/AppProviders.tsx`
- **Action**: Import and add `AlertDialogProvider` wrapper
- **Implementation**:
  ```typescript
          import { AlertDialogProvider } from '@ui/feedback';
          
          return (
            <QueryClientProvider client={queryClient}>
              <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Muscat">
                <AuthProvider>
                  <RoleProvider>
                    <AlertDialogProvider>
                      {children}
                      <Toaster position={toastPosition} richColors />
                    </AlertDialogProvider>
                  </RoleProvider>
                </AuthProvider>
              </NextIntlClientProvider>
            </QueryClientProvider>
          )
  ```




- **Testing**: Verify AlertDialogProvider renders without errors

### 1.2 Verify Sonner Configuration

- **File**: `web-admin/lib/providers/AppProviders.tsx`
- **Action**: Ensure Sonner Toaster is properly configured (already present)
- **Verify**: RTL support, position, richColors, accessibility

### 1.3 Create Migration Utilities

- **File**: `web-admin/scripts/migration/cmxmessage-migration-helper.ts`
- **Action**: Create helper script to identify migration targets
- **Features**:
- Scan for `window.alert/confirm` usage
- Scan for `lib/utils/toast` imports
- Scan for `console.error/log` patterns
- Generate migration report

## Phase 2: High-Priority Migrations (Critical User Flows)

### 2.1 Replace Native Alerts/Confirms

- **Priority**: High (affects user experience directly)
- **Files**: 22 files with `window.alert/confirm` (identified via grep)
- **Pattern**: Replace with `cmxMessage.confirm()` or appropriate method
- **Key Files**:
- `app/dashboard/help/page.tsx`
- `app/dashboard/settings/workflow-roles/page.tsx`
- `app/dashboard/orders/new/components/payment-modal-enhanced.tsx`
- All other files using `window.alert` or `window.confirm`
- **Migration Pattern**:
  ```typescript
          // Before
          if (window.confirm('Are you sure?')) {
            deleteItem();
          }
          
          // After
          const { showConfirm } = useMessage();
          const confirmed = await showConfirm({
            title: 'Delete Item?',
            message: 'This action cannot be undone.',
            variant: 'destructive',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
          });
          if (confirmed) {
            deleteItem();
          }
  ```




### 2.2 Replace Legacy Toast Usage

- **Priority**: High (deprecated system)
- **Files**: 12 files using `lib/utils/toast`
- **Pattern**: Replace `toast.success/error/info/warning` with `cmxMessage` equivalents
- **Key Files**:
- `web-admin/src/ui/data-display/cmx-editable-datatable.tsx`
- `web-admin/app/dashboard/orders/components/order-actions.tsx`
- All files importing from `lib/utils/toast`
- **Migration Pattern**:
  ```typescript
          // Before
          import { toast } from '@/lib/utils/toast';
          toast.success('Order created successfully');
          
          // After
          import { useMessage } from '@ui/feedback';
          const { showSuccess } = useMessage();
          showSuccess(t('messages.orderCreated'));
  ```




### 2.3 Migrate Error Handling in API Routes

- **Priority**: High (affects error reporting)
- **Files**: API route handlers with error responses
- **Pattern**: Use `cmxMessage.errorFrom()` for consistent error extraction
- **Focus Areas**:
- Order creation/updates (`app/api/orders/**`)
- Customer management (`app/api/customers/**`)
- Payment processing (`app/api/payments/**`)
- Preparation workflows (`app/api/processing/**`)
- **Migration Pattern**:
  ```typescript
          // Before
          catch (error) {
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Unknown error' },
              { status: 500 }
            );
          }
          
          // After
          import { cmxMessage } from '@ui/feedback';
          catch (error) {
            const errorMessage = extractErrorMessage(error);
            return NextResponse.json(
              { error: errorMessage },
              { status: 500 }
            );
          }
  ```




## Phase 3: Form & Component Migrations (User-Facing Components)

### 3.1 React State Integration Strategy

**IMPORTANT**: `cmxMessage` is designed for **global notifications** (toast, alert, console). For **component-level state** (form errors, loading states), we use a **hybrid approach**:

- **Keep React state** (`useState`, `setError`, `setIsSubmitting`) for component-level concerns that need re-renders
- **Add cmxMessage** for global notifications alongside local state
- **Result**: Better UX with both inline errors AND global notifications

### 3.2 Form Error Handling (Hybrid Approach)

- **Priority**: Medium
- **Strategy**: Keep React state for inline errors, add cmxMessage for global notifications
- **P
- **Strategy**: Keep React state for inline errors, aattern**: Use both `setError()` AND `cmxMessage.errorFrom()`
- **Files**:
- `app/dashboard/orders/[id]/prepare/preparation-form.tsx`
- `app/dashboard/customers/components/customer-create-modal.tsx`
- `app/dashboard/orders/components/bulk-status-update.tsx`
- All form components with inline error displays
- **Migration Pattern**:
  ```typescript
            // Before
            catch (error) {
              console.error('Error:', error);
              const errorMessage = error instanceof Error ? error.message : 'An error occurred';
              setError(errorMessage);
            }
            
            // After - Hybrid Approach
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




### 3.3 Loading States (Hybrid Approach)

- **Priority**: Medium
- **Strategy**: Keep React state for UI control, add cmxMessage.promise() for notifications
- **Pattern**: Use `isSubmitting` state + `cmxMessage.promise()`
- **Local state controls**: button disable, spinner display
- **Global notification provides**: loading/success/error feedback
- **Migration Pattern**:
  ```typescript
            // Before
            const [isSubmitting, setIsSubmitting] = useState(false);
            const handleSubmit = async () => {
              setIsSubmitting(true);
              try {
                await saveOrder();
                toast.success('Order saved');
              } catch (error) {
                toast.error('Failed to save');
              } finally {
                setIsSubmitting(false);
              }
            };
            
            // After - Hybrid Approach
            const [isSubmitting, setIsSubmitting] = useState(false);
            const { handlePromise } = useMessage();
            
            const handleSubmit = async () => {
              setIsSubmitting(true);
              try {
                await handlePromise(
                  () => saveOrder(),
                  {
                    loading: t('messages.saving'),
                    success: t('messages.saved'),
                    error: (err) => extractErrorMessage(err),
                  }
                );
              } finally {
                setIsSubmitting(false); // ✅ Still needed for button disable
              }
            };
            
            // Use local state for UI (unchanged)
            <button disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('save')}
            </button>
  ```




### 3.4 Update Promise-Based Operations

- **Priority**: Medium
- **Pattern**: Use `cmxMessage.promise()` for async operations with retry logic
- **Keep React state** for loading UI control
- **Files with promise handling**:
- Order creation flows
- Payment processing
- Data imports/exports
- Bulk operations
- **Migration Pattern**:
  ```typescript
            // Before
            try {
              const result = await saveOrder();
              toast.success('Order saved');
            } catch (error) {
              toast.error('Failed to save');
            }
            
            // After
            await cmxMessage.promise(
              () => saveOrder(),
              {
                loading: t('messages.saving'),
                success: t('messages.saved'),
                error: (error) => extractErrorMessage(error),
              },
              {
                retry: {
                  maxAttempts: 3,
                  delay: 1000,
                  exponentialBackoff: true,
                  onRetry: (attempt) => t('messages.retrying', { attempt }),
                },
              }
            );
  ```




## Phase 4: Development & Debugging (Console Logging)

### 4.1 Replace Console Logging

- **Priority**: Low (development tooling)
- **Pattern**: Use `cmxMessage` with `method: "console"` for development logs
- **Strategy**:
- Replace `console.error` with `cmxMessage.error()` + keep `console.error` (for debugging)
- Replace `console.log` with `cmxMessage.info({ method: "console" })` for important logs
- Keep debug-only `console.log` statements as-is
- **Files**: 95 files with console logging (351 instances)
- **Migration Pattern**:
  ```typescript
            // Before
            console.error('API Error:', error);
            
            // After
            import { cmxMessage } from '@ui/feedback';
            cmxMessage.errorFrom(error, { method: 'console' });
            console.error('API Error:', error); // Keep for debugging
  ```




### 4.2 Add User Feedback for Important Operations

- **Priority**: Low
- **Action**: Add success/error messages for operations that currently only log to console
- **Examples**:
- Data exports
- Bulk operations
- Background jobs
- File uploads/downloads

## Phase 5: Cleanup & Optimization

### 5.1 Remove Deprecated Code

- **Files**:
- `lib/utils/toast.ts` (remove after migration)
- Unused toast imports
- Legacy error handling utilities
- **Action**: Remove files and clean up imports

### 5.2 Standardize Error Messages

- **Action**: Create error message translation keys
- **Files**: 
- `messages/en.json`
- `messages/ar.json`
- **Pattern**: Use consistent error message patterns
- **Documentation**: Document error message conventions

### 5.3 Performance Optimization

- **Action**: Enable message queuing where appropriate
- **Configuration**: Configure optimal toast durations
- **Review**: Optimize batch operations
- **Files**: `web-admin/src/ui/feedback/message-config.ts`

### 5.4 Update Documentation

- **Files**:
- `web-admin/src/ui/feedback/cmxMessage_developer_guide.md`
- `web-admin/src/ui/feedback/cmxMessage_MIGRATION.md`
- **Action**: Update with migration patterns, examples, troubleshooting

## Testing Strategy

### Unit Tests (Phase 0.1.3)

- Test all public methods
- Test error extraction from various error types
- Test HTML sanitization (XSS prevention)
- Test message queuing and batching
- Test promise handling with retry logic
- Test confirm dialogs
- Test React hook integration

### Integration Tests

- Test user flows after migration
- Test form submissions (verify both inline and global messages)
- Test API error handling
- Test loading states

### Accessibility Tests

- Verify ARIA attributes
- Test keyboard navigation (Escape, Enter, Tab)
- Test screen reader announcements
- Verify focus management

### i18n Tests

- Verify translations work correctly
- Test RTL layout support
- Test locale-aware positioning

### Visual Tests

- Test dark mode styling
- Test all variants (success, error, warning, info)
- Test responsive design
- Test mobile-friendly dialogs

## Rollout Plan

### Week 1: Enhancements + Foundation

- **Days 1-2**: Phase 0.1 (High Priority Enhancements)
- Install DOMPurify
- Add error boundaries
- Write unit tests
- **Days 3-4**: Phase 0.2 (Medium Priority Enhancements)
- Add rate limiting
- Improve developer warnings
- Verify dark mode
- **Day 5**: Phase 1 (Foundation Setup)
- Add AlertDialogProvider
- Verify Sonner configuration

### Week 2: High-Priority Migrations

- **Days 1-2**: Phase 2.1 (Replace Native Alerts)
- **Days 3-4**: Phase 2.2 (Replace Legacy Toast)
- **Day 5**: Phase 2.3 (API Error Handling)

### Week 3: Component Migrations

- **Days 1-3**: Phase 3.2 (Form Error Handling)
- **Days 4-5**: Phase 3.3 (Loading States) + Phase 3.4 (Promise Operations)

### Week 4: Cleanup

- **Days 1-2**: Phase 4 (Console Logging)
- **Days 3-5**: Phase 5 (Cleanup & Optimization)

## Risk Mitigation

1. **Breaking Changes**: Test thoroughly before deploying each phase
2. **User Experience**: Ensure messages are clear and helpful
3. **Performance**: Monitor message queue performance
4. **Accessibility**: Verify all dialogs are accessible
5. **i18n**: Ensure all messages are translatable
6. **Regression**: Test existing functionality after each migration phase

## Success Criteria

### Phase 0 (Enhancements)

- ✅ DOMPurify integrated and tested
- ✅ Error boundaries prevent crashes
- ✅ Unit tests achieve >80% coverage
- ✅ Rate limiting prevents message spam
- ✅ Developer warnings guide setup
- ✅ Dark mode verified and accessible

### Phase 1-5 (Migration)

- ✅ All native alerts replaced with custom dialogs
- ✅ All legacy toast usage migrated
- ✅ Consistent error handling across the app
- ✅ Forms use hybrid approach (React state + cmxMessage)
- ✅ Loading states properly managed (React state + cmxMessage.promise)
- ✅ Consistent error handling with cmxMessage.errorFrom()
- ✅ Improved UX with both inline and global notifications
- ✅ Deprecated code removed
- ✅ Error messages standardized and translated

## Important Notes

### React State is NOT Replaced

**Key Principle**: `cmxMessage` **complements** React state, it does **not replace** it.

- **Component-level state** (`useState`, `setError`, `setIsSubmitting`) → Keep for re-renders
- **Global notifications** (toast, alert) → Use cmxMessage
- **Result**: Hybrid approach provides best UX

### Decision Matrix

| Scenario | Solution | Reason ||----------|----------|--------|| Form validation errors | Keep React state + cmxMessage | Need immediate re-render, also show global notification || API error after submit | cmxMessage only | Global notification sufficient || Loading state | Keep React state + cmxMessage.promise | State controls UI, promise shows notification || Success after submit | cmxMessage only | Global notification sufficient || Field-level errors | Keep React state | Component-specific, needs re-render |

## Files Reference

### Core Implementation

- `web-admin/src/ui/feedback/cmx-message.ts` - Main message utility
- `web-admin/src/ui/feedback/types.ts` - Type definitions
- `web-admin/src/ui/feedback/message-config.ts` - Configuration
- `web-admin/src/ui/feedback/useMessage.ts` - React hook

### Components

- `web-admin/src/ui/feedback/components/cmx-alert-dialog.tsx` - Custom alert dialog
- `web-admin/src/ui/feedback/utils/alert-dialog-manager.tsx` - Dialog manager

### Utilities

- `web-admin/src/ui/feedback/utils/error-extractor.ts` - Error extraction
- `web-admin/src/ui/feedback/utils/html-sanitizer.ts` - HTML sanitization
- `web-admin/src/ui/feedback/utils/message-queue.ts` - Message queuing

### Methods

- `web-admin/src/ui/feedback/methods/toast-method.ts` - Toast display
- `web-admin/src/ui/feedback/methods/alert-method.ts` - Alert display
- `web-admin/src/ui/feedback/methods/console-method.ts` - Console display
- `web-admin/src/ui/feedback/methods/inline-method.ts` - Inline display

### Providers