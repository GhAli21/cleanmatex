/**
 * Compatibility layer for legacy @/components/ui imports.
 * Re-exports components with the old API for backward compatibility.
 *
 * @see docs/dev/ui-migration-guide.md - Guide for migrating to @ui Cmx components
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Card, CardHeader, CardFooter } from './Card';
export type { CardProps, CardHeaderProps, CardFooterProps } from './Card';

export { Alert, AlertDescription } from './Alert';
export type { AlertProps, AlertVariant, AlertDescriptionProps } from './Alert';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { Tabs } from './Tabs';
export type { TabsProps, Tab } from './Tabs';

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './dialog';
export type {
  DialogProps,
  DialogContentProps,
  DialogHeaderProps,
  DialogTitleProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogCloseProps,
} from './dialog';

export { Textarea } from './textarea';
export type { TextareaProps } from './textarea';

export { Label } from './label';
export type { LabelProps } from './label';

export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

export { Checkbox } from './checkbox';
export type { CheckboxProps } from './checkbox';

export { SummaryMessage } from './summary-message';
export type { SummaryMessageProps } from './summary-message';

// Composable select: use @ui/compat/select-dropdown
// (Not in barrel to avoid conflict with simple Select above)
