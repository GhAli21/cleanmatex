/**
 * Validation Schemas for Payment CRUD Operations
 */

import { z } from 'zod';

/**
 * Schema for updating payment notes
 */
export const updatePaymentNotesSchema = z.object({
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters'),
});

/**
 * Schema for cancelling a payment (reason is required)
 */
export const cancelPaymentSchema = z.object({
  reason: z
    .string()
    .min(1, 'Cancel reason is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

/**
 * Schema for creating a standalone payment
 */
export const createStandalonePaymentSchema = z.object({
  payment_kind: z.enum(['invoice', 'deposit', 'advance', 'pos'], {
    required_error: 'Payment kind is required',
  }),
  payment_method_code: z.string().min(1, 'Payment method is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  customer_id: z.string().uuid('Invalid customer ID').optional().or(z.literal('')),
  order_id: z.string().uuid('Invalid order ID').optional().or(z.literal('')),
  invoice_id: z.string().uuid('Invalid invoice ID').optional().or(z.literal('')),
  currency_code: z.string().optional(),
  payment_type_code: z.string().optional(),
  notes: z.string().max(1000).optional(),
  trans_desc: z.string().max(500).optional(),
  check_number: z.string().optional(),
  check_bank: z.string().optional(),
  check_date: z.string().optional(),
});

/**
 * Schema for refunding a payment
 */
export const refundPaymentSchema = z.object({
  transaction_id: z.string().uuid('Invalid transaction ID'),
  amount: z.number().positive('Amount must be greater than zero'),
  reason: z
    .string()
    .min(1, 'Refund reason is required')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export type UpdatePaymentNotesInput = z.infer<typeof updatePaymentNotesSchema>;
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;
export type CreateStandalonePaymentFormInput = z.infer<typeof createStandalonePaymentSchema>;
export type RefundPaymentFormInput = z.infer<typeof refundPaymentSchema>;
