import { useState, useEffect, useMemo } from 'react';

/**
 * Custom hook for debouncing values to improve performance
 * Used for search inputs and other frequently changing values
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export const useDebouncedValue = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Enhanced search hook with instant feedback and optimized filtering
 * Provides debounced search with loading states for better UX
 *
 * @param items - Array of items to search through
 * @param searchKey - Key to search in each item
 * @param debounceDelay - Debounce delay in milliseconds (default: 150ms)
 * @returns Search state and filtered results
 */
export const useOptimizedSearch = <T extends Record<string, any>>(
  items: T[],
  searchKey: keyof T,
  debounceDelay: number = 150,
) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, debounceDelay);

  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return items;

    const query = debouncedQuery.toLowerCase();
    return items.filter(item => {
      const searchValue = item[searchKey];
      if (typeof searchValue === 'string') {
        return searchValue.toLowerCase().includes(query);
      }
      return false;
    });
  }, [items, debouncedQuery, searchKey]);

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    isSearching: searchQuery !== debouncedQuery,
    hasResults: filteredItems.length > 0,
    resultCount: filteredItems.length,
  };
};

/**
 * Multi-field search hook for complex search scenarios
 * Searches across multiple fields with weighted relevance
 *
 * @param items - Array of items to search through
 * @param searchFields - Array of fields to search with optional weights
 * @param debounceDelay - Debounce delay in milliseconds
 * @returns Search state and filtered results with relevance scores
 */
export const useMultiFieldSearch = <T extends Record<string, any>>(
  items: T[],
  searchFields: Array<{ key: keyof T; weight?: number }>,
  debounceDelay: number = 150,
) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, debounceDelay);

  const filteredItems = useMemo(() => {
    if (!debouncedQuery.trim()) return items;

    const query = debouncedQuery.toLowerCase();

    return items
      .map(item => {
        let relevanceScore = 0;
        let hasMatch = false;

        searchFields.forEach(({ key, weight = 1 }) => {
          const fieldValue = item[key];
          if (typeof fieldValue === 'string') {
            const fieldLower = fieldValue.toLowerCase();
            if (fieldLower.includes(query)) {
              hasMatch = true;
              // Exact match gets higher score
              if (fieldLower === query) {
                relevanceScore += weight * 10;
              } else if (fieldLower.startsWith(query)) {
                relevanceScore += weight * 5;
              } else {
                relevanceScore += weight;
              }
            }
          }
        });

        return hasMatch ? { ...item, _relevanceScore: relevanceScore } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?._relevanceScore || 0) - (a?._relevanceScore || 0));
  }, [items, debouncedQuery, searchFields]);

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    isSearching: searchQuery !== debouncedQuery,
    hasResults: filteredItems.length > 0,
    resultCount: filteredItems.length,
  };
};
