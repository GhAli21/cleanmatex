/**
 * New Order Layout
 * Layout wrapper for the new order screen
 */

'use client';

import { ReactNode } from 'react';

/**
 * New Order Layout Props
 */
interface NewOrderLayoutProps {
    children: ReactNode;
}

/**
 * New Order Layout Component
 * @param root0
 * @param root0.children
 */
export function NewOrderLayout({ children }: NewOrderLayoutProps) {

    return (
        <div className="flex flex-col h-[calc(100dvh-7.5rem)] min-h-0 bg-muted">
            <div className="flex-1 min-h-0 overflow-hidden flex">
                {children}
            </div>
        </div>
    );
}

