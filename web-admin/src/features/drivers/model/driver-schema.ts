import { z } from 'zod';

export const createDriverSchema = z.object({
  name: z.string().trim().min(1).max(200),
  name2: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  vehicle_type: z.string().trim().max(100).optional(),
  vehicle_plate_no: z.string().trim().max(50).optional(),
  license_no: z.string().trim().max(100).optional(),
  branch_id: z.string().uuid().optional(),
});

export const updateDriverSchema = createDriverSchema.partial();

export type CreateDriverFormValues = z.infer<typeof createDriverSchema>;
export type UpdateDriverFormValues = z.infer<typeof updateDriverSchema>;
