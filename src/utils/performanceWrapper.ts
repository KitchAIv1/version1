import { useEffect, useRef, useCallback, useState } from 'react';
import { logMemoryUsage } from './memoryUtils';

interface PerformanceMetrics {
  screenName: string;
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  timestamp: number;
}

interface SearchMetrics {
  query: string;
  responseTime: number;
  resultCount: number;
  timestamp: number;
}

/**
 * Performance monitoring wrapper - non-intrusive performance tracking
 * VIDEO-SAFE: Pure monitoring that doesn't interfere with component lifecycle
 */
export class PerformanceWrapper {
  private static instance: PerformanceWrapper;
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private searchMetrics: SearchMetrics[] = [];
  
  static getInstance(): PerformanceWrapper {
    if (!PerformanceWrapper.instance) {
      PerformanceWrapper.instance = new PerformanceWrapper();
    }
    return PerformanceWrapper.instance;
  }
  
  private constructor() {
    if (__DEV__) {
      console.log('[PerformanceWrapper] Initialized for development monitoring');
    }
  }
  
  /**
   * Track screen load time - wrapper approach
   */
  trackScreenLoad(screenName: string, startTime?: number): void {
    if (!__DEV__) return;
    
    const loadTime = Date.now() - (startTime || Date.now());
    const metric: PerformanceMetrics = {
      screenName,
      loadTime,
      renderTime: 0,
      memoryUsage: 0,
      timestamp: Date.now(),
    };
    
    if (!this.metrics.has(screenName)) {
      this.metrics.set(screenName, []);
    }
    
    const screenMetrics = this.metrics.get(screenName)!;
    screenMetrics.push(metric);
    
    // Keep only last 50 metrics per screen
    if (screenMetrics.length > 50) {
      this.metrics.set(screenName, screenMetrics.slice(-25));
    }
    
    // Log with performance rating
    const rating = this.getPerformanceRating(loadTime, 'screenLoad');
    console.log(`[Performance] 📱 ${screenName}: ${loadTime}ms ${rating}`);
    
    // Log memory usage
    logMemoryUsage(`${screenName}_Load`);
  }
  
  /**
   * Track search performance - wrapper approach
   */
  trackSearch(query: string, resultCount: number, startTime?: number): void {
    if (!__DEV__) return;
    
    const responseTime = Date.now() - (startTime || Date.now());
    const searchMetric: SearchMetrics = {
      query,
      responseTime,
      resultCount,
      timestamp: Date.now(),
    };
    
    this.searchMetrics.push(searchMetric);
    
    // Keep only last 100 search metrics
    if (this.searchMetrics.length > 100) {
      this.searchMetrics = this.searchMetrics.slice(-50);
    }
    
    const rating = this.getPerformanceRating(responseTime, 'search');
    console.log(`[Performance] 🔍 Search "${query}": ${responseTime}ms (${resultCount} results) ${rating}`);
  }
  
  /**
   * Get performance rating based on US mobile app standards
   */
  private getPerformanceRating(time: number, type: 'screenLoad' | 'search'): string {
    const benchmarks = {
      screenLoad: { excellent: 500, good: 800, acceptable: 1200 },
      search: { excellent: 50, good: 100, acceptable: 200 },
    };
    
    const { excellent, good, acceptable } = benchmarks[type];
    
    if (time <= excellent) return '🟢 EXCELLENT';
    if (time <= good) return '🟡 GOOD';
    if (time <= acceptable) return '🟠 ACCEPTABLE';
    return '🔴 POOR';
  }
  
  /**
   * Get performance summary for debugging
   */
  getPerformanceSummary(): string {
    if (this.metrics.size === 0) {
      return '[PerformanceWrapper] No performance data collected yet';
    }
    
    let summary = '[PerformanceWrapper] Performance Summary:\n';
    
    this.metrics.forEach((metrics, screenName) => {
      if (metrics.length === 0) return;
      
      const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
      const maxLoadTime = Math.max(...metrics.map(m => m.loadTime));
      const recentLoadTime = metrics[metrics.length - 1]?.loadTime || 0;
      
      summary += `  📱 ${screenName}: Avg ${avgLoadTime.toFixed(0)}ms, Max ${maxLoadTime}ms, Recent ${recentLoadTime}ms\n`;
    });
    
    if (this.searchMetrics.length > 0) {
      const avgSearchTime = this.searchMetrics.reduce((sum, m) => sum + m.responseTime, 0) / this.searchMetrics.length;
      const recentSearch = this.searchMetrics[this.searchMetrics.length - 1];
      
      summary += `  🔍 Search: Avg ${avgSearchTime.toFixed(0)}ms, Recent "${recentSearch?.query}" ${recentSearch?.responseTime}ms\n`;
    }
    
    return summary;
  }
  
  /**
   * Clear all performance data
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.searchMetrics = [];
    console.log('[PerformanceWrapper] Cleared all performance metrics');
  }
}

/**
 * React hook for screen load tracking - wrapper approach
 * NON-INTRUSIVE: Just adds monitoring without changing component behavior
 */
export function usePerformanceTracking(screenName: string): {
  trackScreenLoad: () => void;
  trackSearch: (query: string, resultCount: number, startTime?: number) => void;
  getMetrics: () => string;
} {
  const performance = PerformanceWrapper.getInstance();
  const loadStartTime = useRef(Date.now());
  
  // Track screen load automatically on mount
  useEffect(() => {
    performance.trackScreenLoad(screenName, loadStartTime.current);
  }, [screenName, performance]);
  
  const trackScreenLoad = useCallback(() => {
    performance.trackScreenLoad(screenName, loadStartTime.current);
  }, [screenName, performance]);
  
  const trackSearch = useCallback((query: string, resultCount: number, startTime?: number) => {
    performance.trackSearch(query, resultCount, startTime);
  }, [performance]);
  
  const getMetrics = useCallback(() => {
    return performance.getPerformanceSummary();
  }, [performance]);
  
  return { trackScreenLoad, trackSearch, getMetrics };
}

/**
 * Search performance wrapper hook
 * Adds performance tracking to any search functionality
 */
export function useSearchPerformanceWrapper<T>(
  items: T[],
  searchFunction: (items: T[], query: string) => T[],
  debounceDelay: number = 150
): {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredItems: T[];
  isSearching: boolean;
  resultCount: number;
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  const searchStartTime = useRef(0);
  const performance = PerformanceWrapper.getInstance();
  
  // Debounced search with performance tracking
  useEffect(() => {
    if (searchQuery !== searchQuery.trim()) {
      setIsSearching(true);
      searchStartTime.current = Date.now();
    }
    
    const debounceTimer = setTimeout(() => {
      const results = searchFunction(items, searchQuery);
      setFilteredItems(results);
      setIsSearching(false);
      
      // Track search performance
      if (searchQuery.trim()) {
        performance.trackSearch(searchQuery, results.length, searchStartTime.current);
      }
    }, debounceDelay);
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, items, searchFunction, debounceDelay, performance]);
  
  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    isSearching,
    resultCount: filteredItems.length,
  };
}

/**
 * Simple loading state wrapper with performance tracking
 */
export function useLoadingPerformanceWrapper(operation: string): {
  isLoading: boolean;
  startLoading: () => void;
  endLoading: () => void;
} {
  const [isLoading, setIsLoading] = useState(false);
  const startTime = useRef(0);
  const performance = PerformanceWrapper.getInstance();
  
  const startLoading = useCallback(() => {
    setIsLoading(true);
    startTime.current = Date.now();
  }, []);
  
  const endLoading = useCallback(() => {
    setIsLoading(false);
    if (__DEV__ && startTime.current > 0) {
      const duration = Date.now() - startTime.current;
      console.log(`[Performance] ⏱️ ${operation}: ${duration}ms`);
      
      // Log memory after operation
      logMemoryUsage(`${operation}_Complete`);
    }
  }, [operation, performance]);
  
  return { isLoading, startLoading, endLoading };
}

export default {
  PerformanceWrapper,
  usePerformanceTracking,
  useSearchPerformanceWrapper,
  useLoadingPerformanceWrapper,
}; 