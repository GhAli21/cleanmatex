'use client';

/**
 * use-customer-form: create/update customer with API and feedback
 */

import { useState, useCallback } from 'react';
import {
  createCustomer,
  updateCustomer,
  deactivateCustomer,
} from '@/lib/api/customers';
import type {
  Customer,
  CustomerCreateRequest,
  CustomerUpdateRequest,
} from '@/lib/types/customer';

export interface UseCustomerFormOptions {
  onSuccess?: (customer: Customer) => void;
  onError?: (message: string) => void;
}

export function useCustomerForm(options: UseCustomerFormOptions = {}) {
  const { onSuccess, onError } = options;
  const [submitting, setSubmitting] = useState(false);

  const create = useCallback(
    async (request: CustomerCreateRequest): Promise<Customer | null> => {
      setSubmitting(true);
      try {
        const customer = await createCustomer(request);
        onSuccess?.(customer);
        return customer;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create customer';
        onError?.(message);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError]
  );

  const update = useCallback(
    async (customerId: string, updates: CustomerUpdateRequest): Promise<Customer | null> => {
      setSubmitting(true);
      try {
        const customer = await updateCustomer(customerId, updates);
        onSuccess?.(customer);
        return customer;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update customer';
        onError?.(message);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [onSuccess, onError]
  );

  const deactivate = useCallback(
    async (customerId: string): Promise<boolean> => {
      setSubmitting(true);
      try {
        await deactivateCustomer(customerId);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deactivate customer';
        onError?.(message);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onError]
  );

  return {
    submitting,
    create,
    update,
    deactivate,
  };
}
