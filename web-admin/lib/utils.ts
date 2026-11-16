/**
 * Utility Functions
 *
 * Common utility functions used across the application
 */

import { twMerge } from 'tailwind-merge';

/**
 * Combines class names into a single string
 * Handles conditional classes, arrays, and undefined/null values
 * 
 * @param inputs - Class names to combine (strings, arrays, objects, or undefined/null)
 * @returns Combined class name string
 * 
 * @example
 * cn('foo', 'bar') // 'foo bar'
 * cn('foo', condition && 'bar') // 'foo bar' or 'foo'
 * cn(['foo', 'bar']) // 'foo bar'
 * cn({ foo: true, bar: false }) // 'foo'
 * cn('px-2 text-sm', 'px-4') // 'text-sm px-4' (later conflicting class wins)
 */
export function cn(...inputs: (string | undefined | null | boolean | Record<string, boolean>)[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const key in input) {
        if (input[key]) {
          classes.push(key);
        }
      }
    }
  }

  // twMerge drops duplicates and lets the later of two conflicting utilities win.
  return twMerge(classes.join(' '));
}

