/**
 * Keyboard Navigation Hook
 * Provides keyboard navigation utilities for accessible components
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardNavigationOptions {
    /**
     * Whether keyboard navigation is enabled
     */
    enabled?: boolean;
    /**
     * Callback when Escape key is pressed
     */
    onEscape?: () => void;
    /**
     * Callback when Enter key is pressed
     */
    onEnter?: () => void;
    /**
     * Callback when Arrow keys are pressed
     */
    onArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
    /**
     * Callback for custom key handlers
     */
    onKey?: (key: string, event: KeyboardEvent) => void;
    /**
     * Additional keys to handle
     */
    keys?: Record<string, () => void>;
}

/**
 * Hook for keyboard navigation support
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
    const {
        enabled = true,
        onEscape,
        onEnter,
        onArrow,
        onKey,
        keys = {},
    } = options;

    const handlersRef = useRef(options);
    handlersRef.current = options;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const { onEscape, onEnter, onArrow, onKey, keys = {} } = handlersRef.current;

            // Prevent default for handled keys
            const preventDefault = () => {
                event.preventDefault();
                event.stopPropagation();
            };

            switch (event.key) {
                case 'Escape':
                    if (onEscape) {
                        preventDefault();
                        onEscape();
                    }
                    break;
                case 'Enter':
                    if (onEnter && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                        // Only handle Enter if not in a text input/textarea
                        const target = event.target as HTMLElement;
                        if (
                            target.tagName !== 'INPUT' &&
                            target.tagName !== 'TEXTAREA' &&
                            !target.isContentEditable
                        ) {
                            preventDefault();
                            onEnter();
                        }
                    }
                    break;
                case 'ArrowUp':
                    if (onArrow) {
                        preventDefault();
                        onArrow('up');
                    }
                    break;
                case 'ArrowDown':
                    if (onArrow) {
                        preventDefault();
                        onArrow('down');
                    }
                    break;
                case 'ArrowLeft':
                    if (onArrow) {
                        preventDefault();
                        onArrow('left');
                    }
                    break;
                case 'ArrowRight':
                    if (onArrow) {
                        preventDefault();
                        onArrow('right');
                    }
                    break;
                default:
                    // Handle custom keys
                    if (keys[event.key]) {
                        preventDefault();
                        keys[event.key]();
                    }
                    if (onKey) {
                        onKey(event.key, event);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enabled]);
}

/**
 * Hook for focus trap within a container
 */
export function useFocusTrap(
    containerRef: React.RefObject<HTMLElement>,
    enabled: boolean = true
) {
    useEffect(() => {
        if (!enabled || !containerRef.current) return;

        const container = containerRef.current;

        const getFocusableElements = (): HTMLElement[] => {
            const selector = [
                'button:not([disabled])',
                'a[href]',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"])',
            ].join(', ');

            return Array.from(container.querySelectorAll<HTMLElement>(selector));
        };

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleTab);
        return () => {
            container.removeEventListener('keydown', handleTab);
        };
    }, [enabled, containerRef]);
}

/**
 * Hook for arrow key navigation in lists
 */
export function useArrowKeyNavigation<T>(
    items: T[],
    onSelect: (item: T, index: number) => void,
    enabled: boolean = true
) {
    const selectedIndexRef = useRef<number>(-1);

    const handleArrow = useCallback(
        (direction: 'up' | 'down') => {
            if (!enabled || items.length === 0) return;

            let newIndex = selectedIndexRef.current;

            if (direction === 'down') {
                newIndex = newIndex < items.length - 1 ? newIndex + 1 : 0;
            } else {
                newIndex = newIndex > 0 ? newIndex - 1 : items.length - 1;
            }

            selectedIndexRef.current = newIndex;
            onSelect(items[newIndex], newIndex);
        },
        [enabled, items, onSelect]
    );

    useKeyboardNavigation({
        enabled,
        onArrow: (dir) => {
            if (dir === 'up' || dir === 'down') {
                handleArrow(dir);
            }
        },
    });

    return {
        selectedIndex: selectedIndexRef.current,
        resetSelection: () => {
            selectedIndexRef.current = -1;
        },
    };
}

