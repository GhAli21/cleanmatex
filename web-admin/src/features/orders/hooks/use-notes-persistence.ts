/**
 * use-notes-persistence Hook
 * Auto-saves order notes to localStorage and restores on page load
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 * LocalStorage key for order notes
 */
const NOTES_STORAGE_KEY = 'cleanmatex:new-order:notes';

/**
 * Hook to persist notes to localStorage
 * @param notes - Current notes value
 * @param onLoad - Callback to load saved notes
 */
export function useNotesPersistence(
  notes: string,
  onLoad: (savedNotes: string) => void
) {
  // Debounce notes to avoid excessive localStorage writes
  const debouncedNotes = useDebounce(notes, ORDER_DEFAULTS.DEBOUNCE_MS.SEARCH);
  
  // Use ref to store the latest onLoad callback
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  
  // Track if we've already loaded notes to prevent infinite loops
  const hasLoadedRef = useRef(false);

  // Load saved notes on mount only
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasLoadedRef.current) return; // Only load once
    
    try {
      const savedNotes = localStorage.getItem(NOTES_STORAGE_KEY);
      if (savedNotes && savedNotes.trim().length > 0) {
        hasLoadedRef.current = true;
        onLoadRef.current(savedNotes);
      } else {
        hasLoadedRef.current = true; // Mark as loaded even if no saved notes
      }
    } catch (error) {
      console.warn('Failed to load saved notes from localStorage:', error);
      hasLoadedRef.current = true; // Mark as loaded even on error
    }
  }, []); // Empty dependency array - only run on mount

  // Save notes to localStorage when they change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!debouncedNotes || debouncedNotes.trim().length === 0) {
      // Clear storage if notes are empty
      try {
        localStorage.removeItem(NOTES_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear notes from localStorage:', error);
      }
      return;
    }

    try {
      localStorage.setItem(NOTES_STORAGE_KEY, debouncedNotes);
    } catch (error) {
      console.warn('Failed to save notes to localStorage:', error);
    }
  }, [debouncedNotes]);

  // Clear saved notes
  const clearSavedNotes = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(NOTES_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear notes from localStorage:', error);
    }
  }, []);

  return {
    clearSavedNotes,
  };
}

