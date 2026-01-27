/**
 * use-ready-by-estimation Hook
 * Debounced estimation calls for ready-by date
 */

'use client';

import { useRef } from 'react';
import { useNewOrderStateWithDispatch } from './use-new-order-state';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Estimate ready-by date
 */
async function estimateReadyBy(params: {
    items: Array<{ serviceCategoryCode?: string; quantity: number }>;
    isQuickDrop: boolean;
    express: boolean;
}): Promise<string> {
    const res = await fetch('/api/v1/orders/estimate-ready-by', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    
    const json = await res.json();
    if (json.success && json.data?.readyByAt) {
        const readyByAt = json.data.readyByAt;
        // Ensure it's a valid date string (ISO format)
        const date = new Date(readyByAt);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date format returned from API');
        }
        return date.toISOString();
    }
    throw new Error(json.error || 'Failed to estimate ready-by');
}

/**
 * Hook to estimate ready-by date (manual calculation only)
 */
export function useReadyByEstimation() {
    const { state, setReadyByAt } = useNewOrderStateWithDispatch();
    const { currentTenant } = useAuth();

    // Store setReadyByAt in a ref to avoid infinite loops
    const setReadyByAtRef = useRef(setReadyByAt);
    setReadyByAtRef.current = setReadyByAt;

    /**
     * Manually calculate and set ready-by date
     */
    const calculateReadyBy = async () => {
        // Skip if no items or no tenant
        if (!currentTenant || state.items.length === 0) {
            console.warn('Cannot calculate ready-by: no items or tenant');
            return null;
        }

        try {
            const readyBy = await estimateReadyBy({
                items: state.items.map((item) => ({
                    serviceCategoryCode: item.serviceCategoryCode,
                    quantity: item.quantity,
                })),
                isQuickDrop: state.isQuickDrop,
                express: state.express,
            });
            
            if (readyBy) {
                console.log('Calculated ready-by:', readyBy);
                // Ensure the date is in ISO format
                const dateValue = readyBy instanceof Date ? readyBy.toISOString() : readyBy;
                setReadyByAtRef.current(dateValue);
                console.log('Set readyByAt to:', dateValue);
                return dateValue;
            } else {
                console.warn('No ready-by date returned from API');
                return null;
            }
        } catch (err) {
            console.error('Failed to calculate ready-by:', err);
            // Re-throw error so it can be handled by the caller
            throw err;
        }
    };

    return {
        readyByAt: state.readyByAt,
        calculateReadyBy,
    };
}

