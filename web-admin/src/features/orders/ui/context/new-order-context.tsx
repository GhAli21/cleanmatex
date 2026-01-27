/**
 * New Order Context
 * Provides state management for the new order feature
 */

'use client';

import { createContext, useContext, useReducer, ReactNode } from 'react';
import { newOrderReducer, initialState } from './new-order-reducer';
import type { NewOrderState, NewOrderAction } from '../../model/new-order-types';

/**
 * Context value type
 */
interface NewOrderContextValue {
  state: NewOrderState;
  dispatch: React.Dispatch<NewOrderAction>;
}

/**
 * New Order Context
 */
const NewOrderContext = createContext<NewOrderContextValue | undefined>(undefined);

/**
 * New Order Provider Props
 */
interface NewOrderProviderProps {
  children: ReactNode;
}

/**
 * New Order Provider
 * Wraps the new order feature with context
 */
export function NewOrderProvider({ children }: NewOrderProviderProps) {
  const [state, dispatch] = useReducer(newOrderReducer, initialState);

  return (
    <NewOrderContext.Provider value={{ state, dispatch }}>
      {children}
    </NewOrderContext.Provider>
  );
}

/**
 * Hook to use New Order Context
 * @throws Error if used outside NewOrderProvider
 */
export function useNewOrderContext(): NewOrderContextValue {
  const context = useContext(NewOrderContext);
  
  if (context === undefined) {
    throw new Error('useNewOrderContext must be used within NewOrderProvider');
  }
  
  return context;
}

/**
 * Hook to use New Order State
 */
export function useNewOrderState(): NewOrderState {
  const { state } = useNewOrderContext();
  return state;
}

/**
 * Hook to use New Order Dispatch
 */
export function useNewOrderDispatch(): React.Dispatch<NewOrderAction> {
  const { dispatch } = useNewOrderContext();
  return dispatch;
}

