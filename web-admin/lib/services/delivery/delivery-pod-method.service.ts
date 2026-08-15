import 'server-only';

import { prisma } from '@/lib/db/prisma';

/** A configured proof method that can be selected by a staff delivery client. */
export interface DeliveryPodMethod {
  code: string;
  name: string;
  name2: string | null;
  description: string | null;
  description2: string | null;
  requiresVerification: boolean;
}

/**
 * Lists active, staff-supported proof methods.
 *
 * OTP is intentionally excluded until its expiry, resend, retry, and audit
 * controls are released as a complete capability.
 */
export async function listDeliveryPodMethods(): Promise<DeliveryPodMethod[]> {
  const methods = await prisma.sys_dlv_pod_method_cd.findMany({
    where: {
      is_active: true,
      rec_status: 1,
      code: { not: 'OTP' },
    },
    orderBy: [{ rec_order: 'asc' }, { code: 'asc' }],
    select: {
      code: true,
      name: true,
      name2: true,
      description: true,
      description2: true,
      requires_verification: true,
    },
  });

  return methods.map((method) => ({
    code: method.code,
    name: method.name,
    name2: method.name2 ?? null,
    description: method.description ?? null,
    description2: method.description2 ?? null,
    requiresVerification: method.requires_verification ?? true,
  }));
}
