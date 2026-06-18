'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Discount Rule Create / Edit Dialog
 *
 * Structured conditions form based on discountConditionsSchema fields.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { CmxSwitch } from '@ui/primitives';
import { Label } from '@ui/primitives';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms';
import { Alert, AlertDescription } from '@ui/primitives';
import { createDiscountRule, updateDiscountRule } from '@/app/actions/marketing/discount-rule-actions';
import type { DiscountRule } from '@/lib/types/payment';

const schema = z.object({
  rule_code: z
    .string()
    .min(1, 'Required')
    .max(50)
    .regex(/^[A-Z0-9_-]+$/, 'Uppercase letters, digits, hyphens, underscores only'),
  rule_name: z.string().min(1, 'Required').max(200),
  rule_name2: z.string().max(200).optional(),
  rule_type: z.enum([
    'bulk_discount',
    'category_discount',
    'customer_tier',
    'seasonal',
    'first_order',
    'loyalty',
  ]),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  priority: z.number().int().min(0),
  can_stack_with_promo: z.boolean(),
  can_stack_with_other_rules: z.boolean(),
  valid_from: z.string().min(1, 'Required'),
  valid_to: z.string().optional(),
  is_enabled: z.boolean(),
  // Conditions fields
  min_order_amount: z.number().nonnegative().optional(),
  min_items: z.number().int().positive().optional(),
});

type FormValues = z.infer<typeof schema>;

interface DiscountRuleFormDialogProps {
  open: boolean;
  rule?: DiscountRule;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.rule
 * @param root0.onClose
 * @param root0.onSuccess
 */
export function DiscountRuleFormDialog({ open, rule, onClose, onSuccess }: DiscountRuleFormDialogProps) {
  const t = useTranslations('marketing.discountRules');
  const tCond = useTranslations('marketing.discountRules.conditions');
  const tCommon = useTranslations('common');

  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!rule;

   
  const getConditions = (r?: DiscountRule): any => {
    if (!r) return {};
    const c = r.conditions as Record<string, unknown> | undefined;
    return c ?? {};
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rule_code: '',
      rule_name: '',
      rule_type: 'seasonal',
      discount_type: 'percentage',
      discount_value: 0,
      priority: 0,
      can_stack_with_promo: false,
      can_stack_with_other_rules: false,
      valid_from: new Date().toISOString().slice(0, 16),
      valid_to: '',
      is_enabled: true,
    },
  });

  useEffect(() => {
    if (rule) {
      const c = getConditions(rule);
      form.reset({
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        rule_name2: rule.rule_name2,
        rule_type: rule.rule_type,
        discount_type: rule.discount_type,
        discount_value: rule.discount_value,
        priority: rule.priority,
        can_stack_with_promo: rule.can_stack_with_promo,
        can_stack_with_other_rules: rule.can_stack_with_other_rules,
        valid_from: rule.valid_from?.slice(0, 16) ?? '',
        valid_to: rule.valid_to?.slice(0, 16) ?? '',
        is_enabled: rule.is_enabled,
        min_order_amount: typeof c.min_order_amount === 'number' ? c.min_order_amount : undefined,
        min_items: typeof c.min_items === 'number' ? c.min_items : undefined,
      });
    } else {
      form.reset({
        rule_code: '', rule_name: '', rule_type: 'seasonal',
        discount_type: 'percentage', discount_value: 0, priority: 0,
        can_stack_with_promo: false, can_stack_with_other_rules: false,
        valid_from: new Date().toISOString().slice(0, 16), valid_to: '',
        is_enabled: true,
      });
    }
    setServerError(null);
  }, [rule, form]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);

    const conditions = {
      schema_version: 1 as const,
      ...(values.min_order_amount != null && values.min_order_amount > 0 && { min_order_amount: values.min_order_amount }),
      ...(values.min_items != null && values.min_items > 0 && { min_items: values.min_items }),
    };

    const payload = {
      rule_code: values.rule_code,
      rule_name: values.rule_name,
      rule_name2: values.rule_name2,
      rule_type: values.rule_type,
      discount_type: values.discount_type,
      discount_value: values.discount_value,
      conditions,
      priority: values.priority,
      can_stack_with_promo: values.can_stack_with_promo,
      can_stack_with_other_rules: values.can_stack_with_other_rules,
      valid_from: new Date(values.valid_from).toISOString(),
      valid_to: values.valid_to ? new Date(values.valid_to).toISOString() : undefined,
      is_enabled: values.is_enabled,
    };

    let result;
    if (isEdit && rule) {
      result = await updateDiscountRule(rule.id, payload);
    } else {
      result = await createDiscountRule(payload);
    }

    if (result.success) {
      onSuccess();
    } else {
      setServerError(result.error);
    }
  };

  const { formState: { isSubmitting } } = form;

  return (
    <CmxDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{isEdit ? t('edit') : t('create')}</CmxDialogTitle>
        </CmxDialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label>{t('fields.code')}</Label>
              <CmxInput
                {...form.register('rule_code')}
                disabled={isEdit}
                className="uppercase"
                placeholder="LOYALTY10"
              />
              {form.formState.errors.rule_code && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.rule_code.message}</p>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>{t('fields.name')}</Label>
              <CmxInput {...form.register('rule_name')} />
              {form.formState.errors.rule_name && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.rule_name.message}</p>
              )}
            </div>

            <div>
              <Label>{t('fields.ruleType')}</Label>
              <Controller
                control={form.control}
                name="rule_type"
                render={({ field }) => (
                  <CmxSelectDropdown value={field.value} onValueChange={field.onChange}>
                    <CmxSelectDropdownTrigger>
                      <CmxSelectDropdownValue />
                    </CmxSelectDropdownTrigger>
                    <CmxSelectDropdownContent>
                      <CmxSelectDropdownItem value="bulk_discount">{t('ruleTypes.bulk_discount')}</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="category_discount">{t('ruleTypes.category_discount')}</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="customer_tier">{t('ruleTypes.customer_tier')}</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="seasonal">{t('ruleTypes.seasonal')}</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="first_order">{t('ruleTypes.first_order')}</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="loyalty">{t('ruleTypes.loyalty')}</CmxSelectDropdownItem>
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                )}
              />
              {form.formState.errors.rule_type && (
                <p className="text-destructive text-xs mt-1">{form.formState.errors.rule_type.message}</p>
              )}
            </div>

            <div>
              <Label>{t('fields.discountType')}</Label>
              <Controller
                control={form.control}
                name="discount_type"
                render={({ field }) => (
                  <CmxSelectDropdown value={field.value} onValueChange={field.onChange}>
                    <CmxSelectDropdownTrigger>
                      <CmxSelectDropdownValue />
                    </CmxSelectDropdownTrigger>
                    <CmxSelectDropdownContent>
                      <CmxSelectDropdownItem value="percentage">%</CmxSelectDropdownItem>
                      <CmxSelectDropdownItem value="fixed_amount">Fixed</CmxSelectDropdownItem>
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                )}
              />
            </div>
            <div>
              <Label>{t('fields.discountValue')}</Label>
              <CmxInput type="number" step="0.01" {...form.register('discount_value', { valueAsNumber: true })} />
            </div>

            <div>
              <Label>{t('fields.priority')}</Label>
              <CmxInput type="number" step="1" {...form.register('priority', { valueAsNumber: true })} />
            </div>

            <div>
              <Label>{tCond('minOrder')}</Label>
              <CmxInput type="number" step="0.01" {...form.register('min_order_amount', { valueAsNumber: true })} />
            </div>

            <div>
              <Label>{tCond('minItems')}</Label>
              <CmxInput type="number" step="1" {...form.register('min_items', { valueAsNumber: true })} />
            </div>

            <div>
              <Label>{t('fields.validFrom')}</Label>
              <CmxInput type="datetime-local" {...form.register('valid_from')} />
            </div>
            <div>
              <Label>{t('fields.validTo')}</Label>
              <CmxInput type="datetime-local" {...form.register('valid_to')} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="can_stack_with_promo"
                render={({ field }) => (
                  <CmxSwitch checked={field.value} onCheckedChange={field.onChange} id="stack_promo" />
                )}
              />
              <Label htmlFor="stack_promo">{t('fields.stackWithPromo')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="can_stack_with_other_rules"
                render={({ field }) => (
                  <CmxSwitch checked={field.value} onCheckedChange={field.onChange} id="stack_rules" />
                )}
              />
              <Label htmlFor="stack_rules">{t('fields.stackWithRules')}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="is_enabled"
                render={({ field }) => (
                  <CmxSwitch checked={field.value} onCheckedChange={field.onChange} id="is_enabled_dr" />
                )}
              />
              <Label htmlFor="is_enabled_dr">{tCommon('enabled')}</Label>
            </div>
          </div>

          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('loading') : tCommon('save')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  );
}
