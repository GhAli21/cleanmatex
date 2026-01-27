/**
 * use-order-performance Hook
 * 
 * Performance monitoring and metrics collection for order creation flow.
 * Tracks key performance indicators and reports to analytics service.
 * 
 * @module use-order-performance
 */

'use client';

import { useCallback, useRef } from 'react';

/**
 * Performance metrics for order creation
 */
export interface OrderPerformanceMetrics {
    // Timing metrics
    pageLoadTime?: number;
    categoryLoadTime?: number;
    productLoadTime?: number;
    orderSubmissionTime?: number;

    // User interaction metrics
    customerSelectionTime?: number;
    itemAdditionCount?: number;
    modalOpenCount?: Record<string, number>;

    // Error metrics
    errorCount?: number;
    validationErrorCount?: number;
}

/**
 * Hook to track order creation performance
 * 
 * @returns Object with performance tracking functions
 * 
 * @example
 * ```tsx
 * const { trackPageLoad, trackOrderSubmission } = useOrderPerformance();
 * 
 * useEffect(() => {
 *   trackPageLoad();
 * }, []);
 * ```
 */
export function useOrderPerformance() {
    const metricsRef = useRef<OrderPerformanceMetrics>({
        itemAdditionCount: 0,
        modalOpenCount: {},
        errorCount: 0,
        validationErrorCount: 0,
    });

    const startTimeRef = useRef<number>(Date.now());

    // Track page load time
    const trackPageLoad = useCallback(() => {
        const loadTime = Date.now() - startTimeRef.current;
        metricsRef.current.pageLoadTime = loadTime;

        // Report to analytics (if configured)
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'page_load', {
                event_category: 'performance',
                event_label: 'new_order_page',
                value: loadTime,
            });
        }
    }, []);

    // Track category load
    const trackCategoryLoad = useCallback((loadTime: number) => {
        metricsRef.current.categoryLoadTime = loadTime;
    }, []);

    // Track product load
    const trackProductLoad = useCallback((loadTime: number) => {
        metricsRef.current.productLoadTime = loadTime;
    }, []);

    // Track item addition
    const trackItemAddition = useCallback(() => {
        metricsRef.current.itemAdditionCount = (metricsRef.current.itemAdditionCount || 0) + 1;
    }, []);

    // Track modal opens
    const trackModalOpen = useCallback((modalName: string) => {
        const count = metricsRef.current.modalOpenCount || {};
        count[modalName] = (count[modalName] || 0) + 1;
        metricsRef.current.modalOpenCount = count;
    }, []);

    // Track order submission
    const trackOrderSubmission = useCallback((success: boolean, submissionTime: number) => {
        metricsRef.current.orderSubmissionTime = submissionTime;

        // Report to analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', success ? 'order_created' : 'order_failed', {
                event_category: 'order',
                event_label: 'new_order',
                value: submissionTime,
            });
        }
    }, []);

    // Track errors
    const trackError = useCallback((errorType: 'validation' | 'api' | 'other', error: Error) => {
        if (errorType === 'validation') {
            metricsRef.current.validationErrorCount = (metricsRef.current.validationErrorCount || 0) + 1;
        } else {
            metricsRef.current.errorCount = (metricsRef.current.errorCount || 0) + 1;
        }

        // Report to error tracking service (if configured)
        if (typeof window !== 'undefined' && (window as any).Sentry) {
            (window as any).Sentry.captureException(error, {
                tags: {
                    errorType,
                    feature: 'new_order',
                },
            });
        }
    }, []);

    // Get current metrics
    const getMetrics = useCallback(() => {
        return { ...metricsRef.current };
    }, []);

    // Reset metrics
    const resetMetrics = useCallback(() => {
        metricsRef.current = {
            itemAdditionCount: 0,
            modalOpenCount: {},
            errorCount: 0,
            validationErrorCount: 0,
        };
        startTimeRef.current = Date.now();
    }, []);

    return {
        trackPageLoad,
        trackCategoryLoad,
        trackProductLoad,
        trackItemAddition,
        trackModalOpen,
        trackOrderSubmission,
        trackError,
        getMetrics,
        resetMetrics,
    };
}

