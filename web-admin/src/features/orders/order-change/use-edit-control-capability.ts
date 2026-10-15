'use client';

import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import { resolveEditControlGroup, type EditControlCapability } from './edit-control-capability';
import { useOrderWorkspaceSessionOptional } from './order-workspace-session';

/** Reads the policy loaded with the Edit session. It does not call Preview or Apply. */
export function useEditControlGroup(codes: readonly OrderChangeOperationCode[]): EditControlCapability {
  const session = useOrderWorkspaceSessionOptional();
  return resolveEditControlGroup(session?.editPolicy ?? null, codes);
}
