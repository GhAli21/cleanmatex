'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditOrderController } from './edit-order-controller';

const EditOrderControllerContext = createContext<EditOrderController | null>(null);

/** Supplies the one Edit controller to the shared order workspace. Create does not read it. */
export function EditOrderControllerProvider({ controller, children }: { controller: EditOrderController; children: ReactNode }) {
  return <EditOrderControllerContext.Provider value={controller}>{children}</EditOrderControllerContext.Provider>;
}

export function useEditOrderControllerOptional(): EditOrderController | null {
  return useContext(EditOrderControllerContext);
}
