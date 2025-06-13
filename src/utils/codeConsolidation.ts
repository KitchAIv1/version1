/**
 * Phase 3: Code Quality & Consolidation Utilities
 * Standardizes patterns across FeedScreen, RecipeDetailScreen, PantryScreen
 * VIDEO-SAFE: Non-intrusive wrappers that preserve existing functionality
 */

import { useCallback, useEffect, useRef } from 'react';
import { performanceBenchmark } from './performanceBenchmark';
import { usePerformanceTracking } from './performanceWrapper';
import { logMemoryUsage } from './memoryUtils';

// Standardized performance thresholds across screens
export const PERFORMANCE_THRESHOLDS = {
  SCREEN_LOAD: { excellent: 500, good: 800, acceptable: 1200 },
  VIDEO_OPERATION: { excellent: 100, good: 200, acceptable: 500 },
  TAB_SWITCH: { excellent: 50, good: 100, acceptable: 200 },
  API_CALL: { excellent: 300, good: 500, acceptable: 1000 },
  SEARCH_FILTER: { excellent: 50, good: 100, acceptable: 200 },
  LIST_SCROLL: { excellent: 16, good: 33, acceptable: 50 }, // 60fps, 30fps, 20fps
} as const;

/**
 * Standardized screen-level performance monitoring
 * Consolidates patterns from FeedScreen, RecipeDetailScreen, PantryScreen
 */
export function useStandardizedScreenPerformance(screenName: string): {
  trackVideoOperation: (operation: string, asyncFn: () => Promise<void>) => Promise<void>;
  trackTabSwitch: (tabName: string, switchFn: () => void) => void;
  trackApiCall: (callName: string, asyncFn: () => Promise<any>) => Promise<any>;
  trackScrollOperation: (operation: string, scrollFn: () => void) => void;
  logMemoryPeriodically: () => void;
} {
  const { trackSearch } = usePerformanceTracking(screenName);
  const memoryLogInterval = useRef<NodeJS.Timeout | null>(null);

  // Track video operations (play, pause, seek, load)
  const trackVideoOperation = useCallback(async (operation: string, asyncFn: () => Promise<void>) => {
    const operationName = `${screenName}_video_${operation}`;
    performanceBenchmark.start(operationName, { 
      screen: screenName, 
      operationType: 'video',
      operation 
    });
    
    try {
      await asyncFn();
      performanceBenchmark.end(operationName, { success: true });
    } catch (error) {
      performanceBenchmark.end(operationName, { 
        success: false, 
        error: String(error) 
      });
      throw error;
    }
  }, [screenName]);

  // Track tab switching with performance feedback
  const trackTabSwitch = useCallback((tabName: string, switchFn: () => void) => {
    const startTime = performance.now();
    
    switchFn();
    
    // Non-intrusive performance logging
    if (__DEV__) {
      const duration = performance.now() - startTime;
      const threshold = PERFORMANCE_THRESHOLDS.TAB_SWITCH;
      
      if (duration > threshold.acceptable) {
        console.log(`[Performance] 🔴 Tab switch to ${tabName}: ${duration.toFixed(1)}ms (SLOW)`);
      } else if (duration > threshold.good) {
        console.log(`[Performance] 🟠 Tab switch to ${tabName}: ${duration.toFixed(1)}ms`);
      } else if (duration > threshold.excellent) {
        console.log(`[Performance] 🟡 Tab switch to ${tabName}: ${duration.toFixed(1)}ms`);
      }
      // Don't log excellent performance to reduce noise
    }
  }, []);

  // Track API calls with automatic retry logic awareness
  const trackApiCall = useCallback(async <T>(callName: string, asyncFn: () => Promise<T>): Promise<T> => {
    const operationName = `${screenName}_api_${callName}`;
    performanceBenchmark.start(operationName, { 
      screen: screenName, 
      operationType: 'api',
      callName 
    });
    
    try {
      const result = await asyncFn();
      performanceBenchmark.end(operationName, { success: true });
      return result;
    } catch (error) {
      performanceBenchmark.end(operationName, { 
        success: false, 
        error: String(error) 
      });
      throw error;
    }
  }, [screenName]);

  // Track scroll operations (for FlashList, FlatList, ScrollView)
  const trackScrollOperation = useCallback((operation: string, scrollFn: () => void) => {
    const startTime = performance.now();
    
    scrollFn();
    
    // Track scroll performance for smooth 60fps target
    if (__DEV__) {
      const duration = performance.now() - startTime;
      const threshold = PERFORMANCE_THRESHOLDS.LIST_SCROLL;
      
      if (duration > threshold.acceptable) {
        console.log(`[Performance] 🔴 Scroll ${operation}: ${duration.toFixed(1)}ms (CHOPPY)`);
      }
      // Only log poor scroll performance to avoid noise
    }
  }, []);

  // Periodic memory logging
  const logMemoryPeriodically = useCallback(() => {
    if (__DEV__ && !memoryLogInterval.current) {
      memoryLogInterval.current = setInterval(() => {
        logMemoryUsage(`${screenName}_periodic`);
      }, 60000); // Every minute
    }
  }, [screenName]);

  // Cleanup memory logging on unmount
  useEffect(() => {
    return () => {
      if (memoryLogInterval.current) {
        clearInterval(memoryLogInterval.current);
        memoryLogInterval.current = null;
      }
    };
  }, []);

  return {
    trackVideoOperation,
    trackTabSwitch,
    trackApiCall,
    trackScrollOperation,
    logMemoryPeriodically,
  };
}

/**
 * Standardized loading state enhancement
 * Consolidates loading patterns across all screens
 */
export function getStandardizedLoadingConfig(screenType: 'feed' | 'detail' | 'pantry' | 'generic'): {
  loadingText: string;
  skeletonCount: number;
  showProgress: boolean;
} {
  const configs = {
    feed: {
      loadingText: 'Loading your video feed...',
      skeletonCount: 3,
      showProgress: true,
    },
    detail: {
      loadingText: 'Loading recipe details...',
      skeletonCount: 4,
      showProgress: true,
    },
    pantry: {
      loadingText: 'Loading your pantry...',
      skeletonCount: 6,
      showProgress: true,
    },
    generic: {
      loadingText: 'Loading...',
      skeletonCount: 3,
      showProgress: false,
    },
  };

  return configs[screenType];
}

/**
 * Standardized error boundary patterns
 * Consolidates error handling across screens
 */
export function getStandardizedErrorBoundaryConfig(screenName: string): {
  componentName: string;
  fallbackUI?: React.ComponentType<any>;
  onError?: (error: Error, errorInfo: any) => void;
} {
  return {
    componentName: screenName,
    onError: (error: Error, errorInfo: any) => {
      if (__DEV__) {
        console.error(`[${screenName}] Error boundary caught:`, error);
        console.error(`[${screenName}] Error info:`, errorInfo);
        
        // Log memory usage when errors occur
        logMemoryUsage(`${screenName}_error`);
      }
    },
  };
}

/**
 * Standardized video-safe optimization patterns
 * Consolidates patterns that work well with video playback
 */
export const VIDEO_SAFE_OPTIMIZATIONS = {
  // FlashList settings that don't interfere with video
  flashList: {
    // removeClippedSubviews: false, // Don't use - causes video unmount/remount
    // drawDistance: undefined, // Don't limit - causes video state loss
    // getItemType: undefined, // Don't use aggressive recycling with videos
    maxToRenderPerBatch: 3, // Reasonable batch size
    windowSize: 5, // Conservative window size
    initialNumToRender: 2, // Start small
    updateCellsBatchingPeriod: 100, // Smooth updates
  },
  
  // Video component settings
  video: {
    shouldPlay: (isActive: boolean, isScreenFocused: boolean) => isActive && isScreenFocused,
    isLooping: true,
    isMuted: false, // Let user control
    resizeMode: 'cover' as const,
    progressUpdateIntervalMillis: 500, // Not too frequent
  },
  
  // Memory management that doesn't affect video
  memory: {
    viewLoggerMaxSize: 1000, // Reasonable limit
    memoryLogInterval: 60000, // Every minute
    performanceLogThreshold: 100, // Only log slow operations
  },
} as const;

/**
 * Phase 3 performance summary utility
 * Provides consolidated performance insights across all screens
 */
export function getConsolidatedPerformanceSummary(): string {
  let summary = '[Phase 3] 📊 Consolidated Performance Summary:\n\n';
  
  // Get summaries for each screen type
  const screenTypes = ['FeedScreen', 'RecipeDetailScreen', 'PantryScreen'];
  
  screenTypes.forEach(screen => {
    const screenSummary = performanceBenchmark.getSummary(screen);
    if (!screenSummary.includes('No performance data')) {
      summary += `${screenSummary}\n`;
    }
  });
  
  // Get overall slow operations
  summary += '\n🐌 Overall Slow Operations:\n';
  performanceBenchmark.logSlowOps(500); // Operations slower than 500ms
  
  // Get video-specific performance
  const videoSummary = performanceBenchmark.getSummary('video');
  if (!videoSummary.includes('No performance data')) {
    summary += `\n🎬 Video Performance:\n${videoSummary}`;
  }
  
  return summary;
}

/**
 * Development-only performance monitoring setup
 * Enables global performance insights
 */
export function initializePhase3Monitoring(): void {
  if (!__DEV__) return;
  
  console.log('[Phase 3] 🚀 Initializing consolidated performance monitoring');
  
  // Global performance summary every 5 minutes in development
  setInterval(() => {
    const summary = getConsolidatedPerformanceSummary();
    if (summary.length > 200) { // Only log if there's meaningful data
      console.log(summary);
    }
  }, 300000); // 5 minutes
  
  // Memory pressure monitoring
  if (global.gc) {
    setInterval(() => {
      if (global.gc) {
        global.gc();
        logMemoryUsage('global_gc_cycle');
      }
    }, 600000); // 10 minutes
  }
}

export default {
  useStandardizedScreenPerformance,
  getStandardizedLoadingConfig,
  getStandardizedErrorBoundaryConfig,
  VIDEO_SAFE_OPTIMIZATIONS,
  PERFORMANCE_THRESHOLDS,
  getConsolidatedPerformanceSummary,
  initializePhase3Monitoring,
}; 