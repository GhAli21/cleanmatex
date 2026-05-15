import { z } from 'zod';
import { TERMINAL_TYPES } from '@/lib/constants/payment';

export const createTerminalSchema = z.object({
  terminal_code: z.string().min(1).max(50),
  terminal_name: z.string().min(1).max(250),
  terminal_name2: z.string().max(250).optional(),
  terminal_type: z.enum([
    TERMINAL_TYPES.POS_CARD_TERMINAL,
    TERMINAL_TYPES.CASH_DRAWER,
    TERMINAL_TYPES.ONLINE_GATEWAY,
    TERMINAL_TYPES.BANK_DEVICE,
    TERMINAL_TYPES.OTHER,
  ]),
  gateway_code: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  serial_no: z.string().optional(),
  merchant_id: z.string().optional(),
  terminal_external_id: z.string().optional(),
});

export const updateTerminalSchema = createTerminalSchema.partial().omit({ terminal_code: true });

export type CreateTerminalFormValues = z.infer<typeof createTerminalSchema>;
export type UpdateTerminalFormValues = z.infer<typeof updateTerminalSchema>;
