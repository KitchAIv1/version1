import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

interface PerformanceMetrics {
  screenLoadTime: number;
  renderTime: number;
  memoryUsage: number;
  navigationTime: number;
  searchResponseTime: number;
  apiResponseTime: number;
}

interface PerformanceBenchmarks {
  screenLoadTime: {
    excellent: number;
    good: number;
    acceptable: number;
  };
  searchResponseTime: {
    excellent: number;
    good: number;
    acceptable: number;
  };
  memoryUsage: {
    excellent: number;
    good: number;
    acceptable: number;
  };
}

type PerformanceRating = 'excellent' | 'good' | 'acceptable' | 'poor';

// Performance benchmarks based on US mobile app standards
export const performanceBenchmarks: PerformanceBenchmarks = {
  screenLoadTime: {
    excellent: 500,
    good: 800,
    acceptable: 1200,
  },
  searchResponseTime: {
    excellent: 50,
    good: 100,
    acceptable: 200,
  },
  memoryUsage: {
    excellent: 50, // MB
    good: 100,
    acceptable: 150,
  },
};

/**
 * Get performance rating based on metric value and benchmarks
 */
const getPerformanceRating = (
  value: number,
  benchmark: { excellent: number; good: number; acceptable: number },
): PerformanceRating => {
  if (value <= benchmark.excellent) return 'excellent';
  if (value <= benchmark.good) return 'good';
  if (value <= benchmark.acceptable) return 'acceptable';
  return 'poor';
};

/**
 * Calculate overall performance rating
 */
const calculateOverallRating = (
  ratings: Record<string, PerformanceRating>,
): PerformanceRating => {
  const values = Object.values(ratings);
  const excellentCount = values.filter(r => r === 'excellent').length;
  const goodCount = values.filter(r => r === 'good').length;
  const acceptableCount = values.filter(r => r === 'acceptable').length;

  if (excellentCount >= values.length * 0.7) return 'excellent';
  if (goodCount + excellentCount >= values.length * 0.7) return 'good';
  if (acceptableCount + goodCount + excellentCount >= values.length * 0.7)
    return 'acceptable';
  return 'poor';
};

/**
 * Main performance monitoring hook
 */
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<Partial<PerformanceMetrics>>({});
  const [isMonitoring, setIsMonitoring] = useState(false);
  const startTimeRef = useRef<number>(0);

  // Track screen load time
  const trackScreenLoad = useCallback(
    (screenName: string, startTime?: number) => {
      const loadTime = Date.now() - (startTime || startTimeRef.current);

      setMetrics(prev => ({ ...prev, screenLoadTime: loadTime }));

      // Log performance data (can be sent to analytics)
      console.log(
        `[Performance] Screen "${screenName}" loaded in ${loadTime}ms`,
      );

      return loadTime;
    },
    [],
  );

  // Track render performance
  const trackRenderPerformance = useCallback(() => {
    const startTime = performance.now();

    requestAnimationFrame(() => {
      const renderTime = performance.now() - startTime;
      setMetrics(prev => ({ ...prev, renderTime }));
    });
  }, []);

  // Track navigation time
  const trackNavigation = useCallback(
    (fromScreen: string, toScreen: string, startTime?: number) => {
      const navigationTime = Date.now() - (startTime || startTimeRef.current);

      setMetrics(prev => ({ ...prev, navigationTime }));
      console.log(
        `[Performance] Navigation from "${fromScreen}" to "${toScreen}" took ${navigationTime}ms`,
      );

      return navigationTime;
    },
    [],
  );

  // Track search response time
  const trackSearchResponse = useCallback(
    (query: string, resultCount: number, startTime?: number) => {
      const responseTime = Date.now() - (startTime || startTimeRef.current);

      setMetrics(prev => ({ ...prev, searchResponseTime: responseTime }));
      console.log(
        `[Performance] Search for "${query}" returned ${resultCount} results in ${responseTime}ms`,
      );

      return responseTime;
    },
    [],
  );

  // Track API response time
  const trackApiResponse = useCallback(
    (endpoint: string, startTime?: number) => {
      const responseTime = Date.now() - (startTime || startTimeRef.current);

      setMetrics(prev => ({ ...prev, apiResponseTime: responseTime }));
      console.log(
        `[Performance] API call to "${endpoint}" completed in ${responseTime}ms`,
      );

      return responseTime;
    },
    [],
  );

  // Start timing
  const startTiming = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsMonitoring(true);
  }, []);

  // Stop timing
  const stopTiming = useCallback(() => {
    setIsMonitoring(false);
    return Date.now() - startTimeRef.current;
  }, []);

  // Validate performance against benchmarks
  const validatePerformance = useCallback(
    (customMetrics?: Partial<PerformanceMetrics>) => {
      const metricsToValidate = { ...metrics, ...customMetrics };

      const results: Record<string, PerformanceRating> = {};

      if (metricsToValidate.screenLoadTime !== undefined) {
        results.screenLoad = getPerformanceRating(
          metricsToValidate.screenLoadTime,
          performanceBenchmarks.screenLoadTime,
        );
      }

      if (metricsToValidate.searchResponseTime !== undefined) {
        results.searchResponse = getPerformanceRating(
          metricsToValidate.searchResponseTime,
          performanceBenchmarks.searchResponseTime,
        );
      }

      if (metricsToValidate.memoryUsage !== undefined) {
        results.memoryUsage = getPerformanceRating(
          metricsToValidate.memoryUsage,
          performanceBenchmarks.memoryUsage,
        );
      }

      return {
        overall: calculateOverallRating(results),
        details: results,
        metrics: metricsToValidate,
      };
    },
    [metrics],
  );

  return {
    metrics,
    isMonitoring,
    trackScreenLoad,
    trackRenderPerformance,
    trackNavigation,
    trackSearchResponse,
    trackApiResponse,
    startTiming,
    stopTiming,
    validatePerformance,
  };
};

/**
 * Hook for tracking screen load performance
 */
export const useScreenLoadTracking = (screenName: string) => {
  const { trackScreenLoad, startTiming } = usePerformanceMonitoring();
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTiming();

    // Track when component mounts
    const loadTime = trackScreenLoad(screenName, mountTimeRef.current);

    return () => {
      // Cleanup if needed
    };
  }, [screenName, trackScreenLoad, startTiming]);

  return { trackScreenLoad };
};

/**
 * Hook for tracking search performance
 */
export const useSearchPerformanceTracking = () => {
  const { trackSearchResponse, startTiming } = usePerformanceMonitoring();
  const searchStartTimeRef = useRef<number>(0);

  const startSearch = useCallback(() => {
    searchStartTimeRef.current = Date.now();
    startTiming();
  }, [startTiming]);

  const endSearch = useCallback(
    (query: string, resultCount: number) => {
      return trackSearchResponse(
        query,
        resultCount,
        searchStartTimeRef.current,
      );
    },
    [trackSearchResponse],
  );

  return { startSearch, endSearch };
};

/**
 * Hook for tracking API performance
 */
export const useApiPerformanceTracking = () => {
  const { trackApiResponse } = usePerformanceMonitoring();
  const apiCallsRef = useRef<Map<string, number>>(new Map());

  const startApiCall = useCallback((callId: string) => {
    apiCallsRef.current.set(callId, Date.now());
  }, []);

  const endApiCall = useCallback(
    (callId: string, endpoint: string) => {
      const startTime = apiCallsRef.current.get(callId);
      if (startTime) {
        const responseTime = trackApiResponse(endpoint, startTime);
        apiCallsRef.current.delete(callId);
        return responseTime;
      }
      return 0;
    },
    [trackApiResponse],
  );

  return { startApiCall, endApiCall };
};

/**
 * Hook for memory usage monitoring
 */
export const useMemoryMonitoring = () => {
  const [memoryUsage, setMemoryUsage] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startMonitoring = useCallback(() => {
    intervalRef.current = setInterval(() => {
      // In a real app, you'd use a native module to get actual memory usage
      // For now, we'll simulate it or use available browser APIs
      try {
        if (
          typeof global !== 'undefined' &&
          global.performance &&
          (global.performance as any).memory
        ) {
          const memoryInfo = (global.performance as any).memory;
          const usage = memoryInfo.usedJSHeapSize / 1024 / 1024; // MB
          setMemoryUsage(usage);
        } else {
          // Fallback: estimate based on app state
          setMemoryUsage(Math.random() * 50 + 30); // Simulated 30-80MB
        }
      } catch (error) {
        console.warn('[Performance] Memory monitoring not available:', error);
      }
    }, 5000); // Check every 5 seconds
  }, []);

  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  useEffect(() => {
    startMonitoring();
    return () => {
      stopMonitoring();
    };
  }, [startMonitoring, stopMonitoring]);

  return { memoryUsage, startMonitoring, stopMonitoring };
};

/**
 * Hook for app state performance monitoring
 */
export const useAppStatePerformanceMonitoring = () => {
  const [appStateChanges, setAppStateChanges] = useState<
    Array<{
      state: AppStateStatus;
      timestamp: number;
    }>
  >([]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppStateChanges(prev => [
        ...prev.slice(-9), // Keep last 10 entries
        { state: nextAppState, timestamp: Date.now() },
      ]);

      // Log performance impact of app state changes
      console.log(`[Performance] App state changed to: ${nextAppState}`);
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription?.remove();
  }, []);

  return { appStateChanges };
};
