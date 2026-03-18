/**
 * React hook for responsive breakpoint detection
 * Uses window.matchMedia for SSR-safe, performant detection.
 * Aligns with Tailwind defaults: sm 640, md 768, lg 1024, xl 1280.
 */

'use client';

import { useState, useEffect } from 'react';

/** Tailwind defaults: sm 640, md 768, lg 1024, xl 1280 */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export interface UseBreakpointResult {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'lg';
  const w = window.innerWidth;
  if (w >= BREAKPOINTS.xl) return 'xl';
  if (w >= BREAKPOINTS.lg) return 'lg';
  if (w >= BREAKPOINTS.md) return 'md';
  if (w >= BREAKPOINTS.sm) return 'sm';
  return 'sm';
}

/**
 * Hook that returns current breakpoint and convenience flags.
 * - breakpoint: 'sm' | 'md' | 'lg' | 'xl' (Tailwind defaults)
 * - isMobile: lt 768px
 * - isTablet: 768–1023px
 * - isDesktop: gte 1024px
 */
export function useBreakpoint(): UseBreakpointResult {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => getBreakpoint());

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint());

    const mqSm = window.matchMedia('(min-width: 640px)');
    const mqMd = window.matchMedia('(min-width: 768px)');
    const mqLg = window.matchMedia('(min-width: 1024px)');
    const mqXl = window.matchMedia('(min-width: 1280px)');

    const handler = () => update();

    mqSm.addEventListener('change', handler);
    mqMd.addEventListener('change', handler);
    mqLg.addEventListener('change', handler);
    mqXl.addEventListener('change', handler);

    update();

    return () => {
      mqSm.removeEventListener('change', handler);
      mqMd.removeEventListener('change', handler);
      mqLg.removeEventListener('change', handler);
      mqXl.removeEventListener('change', handler);
    };
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: breakpoint === 'lg' || breakpoint === 'xl',
  };
}
