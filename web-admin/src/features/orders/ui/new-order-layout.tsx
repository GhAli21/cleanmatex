/**
 * New Order Layout
 * Layout wrapper for the new order screen
 */

'use client';

import { ReactNode } from 'react';
import { useRTL } from '@/lib/hooks/useRTL';

/**
 * New Order Layout Props
 */
interface NewOrderLayoutProps {
    children: ReactNode;
}

/**
 * New Order Layout Component
 */
export function NewOrderLayout({ children }: NewOrderLayoutProps) {
    const isRTL = useRTL();

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            <div className={`flex-1 min-h-0 overflow-hidden flex ${isRTL ? 'flex-row-reverse' : ''}`}>
                {children}
            </div>
        </div>
    );
}

