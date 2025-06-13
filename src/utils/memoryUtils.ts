/**
 * Memory Monitoring Utilities
 * Provides tools to monitor and debug memory usage in React Native components
 */

import { useEffect, useRef } from 'react';

export interface MemoryInfo {
  usedMemory: number;
  totalMemory: number;
  freeMemory: number;
  timestamp: number;
}

export interface MemoryStats {
  component: string;
  measurements: MemoryInfo[];
  averageUsage: number;
  peakUsage: number;
}

/**
 * Memory monitoring utility for development and debugging
 * NON-INTRUSIVE: Only logs data, doesn't interfere with app functionality
 */
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private stats: Map<string, MemoryStats> = new Map();
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  private constructor() {
    if (__DEV__) {
      console.log('[MemoryMonitor] Initialized for development mode');
    }
  }
  
  /**
   * Log memory usage for a specific component or screen
   * VIDEO-SAFE: Pure logging function that doesn't affect component lifecycle
   */
  logMemoryUsage(componentName: string): void {
    if (!__DEV__) return; // Only monitor in development
    
    try {
      // Get memory info if available (React Native specific)
      const memoryInfo = this.getCurrentMemoryInfo();
      
      if (!this.stats.has(componentName)) {
        this.stats.set(componentName, {
          component: componentName,
          measurements: [],
          averageUsage: 0,
          peakUsage: 0,
        });
      }
      
      const componentStats = this.stats.get(componentName)!;
      componentStats.measurements.push(memoryInfo);
      
      // Keep only last 100 measurements to prevent memory leaks in the monitor itself
      if (componentStats.measurements.length > 100) {
        componentStats.measurements = componentStats.measurements.slice(-50);
      }
      
      // Update statistics
      this.updateComponentStats(componentStats);
      
      // Log to console with useful formatting
      const usageMB = (memoryInfo.usedMemory / 1024 / 1024).toFixed(1);
      console.log(`[Memory] ${componentName}: ${usageMB}MB used`);
      
    } catch (error) {
      // Silent fail - memory monitoring should never crash the app
      console.warn('[MemoryMonitor] Error logging memory usage:', error);
    }
  }
  
  /**
   * Start continuous memory monitoring for a component
   * Useful for tracking memory leaks during development
   */
  startMonitoring(componentName: string, intervalMs = 5000): () => void {
    if (!__DEV__ || this.isMonitoring) return () => {};
    
    console.log(`[MemoryMonitor] Starting continuous monitoring for ${componentName} every ${intervalMs}ms`);
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.logMemoryUsage(componentName);
    }, intervalMs);
    
    // Return cleanup function
    return () => {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
        this.isMonitoring = false;
        console.log(`[MemoryMonitor] Stopped monitoring ${componentName}`);
      }
    };
  }
  
  /**
   * Get current memory statistics for all monitored components
   */
  getMemoryStats(): MemoryStats[] {
    return Array.from(this.stats.values());
  }
  
  /**
   * Clear all memory statistics
   */
  clearStats(): void {
    this.stats.clear();
    console.log('[MemoryMonitor] Cleared all memory statistics');
  }
  
  /**
   * Get memory summary report
   */
  getMemoryReport(): string {
    if (this.stats.size === 0) {
      return '[MemoryMonitor] No memory data collected yet';
    }
    
    let report = '[MemoryMonitor] Memory Usage Report:\\n';
    
    this.stats.forEach((stats, componentName) => {
      const avgMB = (stats.averageUsage / 1024 / 1024).toFixed(1);
      const peakMB = (stats.peakUsage / 1024 / 1024).toFixed(1);
      const measurements = stats.measurements.length;
      
      report += `  ${componentName}: Avg ${avgMB}MB, Peak ${peakMB}MB (${measurements} measurements)\\n`;
    });
    
    return report;
  }
  
  private getCurrentMemoryInfo(): MemoryInfo {
    // Default fallback values
    const defaultInfo: MemoryInfo = {
      usedMemory: 0,
      totalMemory: 0,
      freeMemory: 0,
      timestamp: Date.now(),
    };
    
    try {
      // Try to get actual memory info if available
      // Note: This is a placeholder - actual implementation would use platform-specific APIs
      if (global.performance && (global.performance as any).memory) {
        const memory = (global.performance as any).memory;
        return {
          usedMemory: memory.usedJSHeapSize || 0,
          totalMemory: memory.totalJSHeapSize || 0,
          freeMemory: (memory.totalJSHeapSize || 0) - (memory.usedJSHeapSize || 0),
          timestamp: Date.now(),
        };
      }
      
      return defaultInfo;
    } catch (error) {
      return defaultInfo;
    }
  }
  
  private updateComponentStats(stats: MemoryStats): void {
    if (stats.measurements.length === 0) return;
    
    const usageValues = stats.measurements.map(m => m.usedMemory);
    stats.averageUsage = usageValues.reduce((sum, usage) => sum + usage, 0) / usageValues.length;
    stats.peakUsage = Math.max(...usageValues);
  }
}

/**
 * React hook for memory monitoring
 * VIDEO-SAFE: Non-intrusive monitoring that doesn't affect component lifecycle
 */
export function useMemoryMonitor(
  componentName: string,
  intervalMs?: number
): {
  logMemory: () => void;
  getStats: () => MemoryStats | undefined;
} {
  const monitor = MemoryMonitor.getInstance();
  const cleanupRef = useRef<(() => void) | null>(null);
  
  useEffect(() => {
    if (intervalMs) {
      cleanupRef.current = monitor.startMonitoring(componentName, intervalMs);
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [componentName, intervalMs, monitor]);
  
  const logMemory = () => {
    monitor.logMemoryUsage(componentName);
  };
  
  const getStats = () => {
    return monitor.getMemoryStats().find(s => s.component === componentName);
  };
  
  return { logMemory, getStats };
}

/**
 * Simple memory logging function for quick use
 * VIDEO-SAFE: Pure logging function
 */
export function logMemoryUsage(componentName: string): void {
  MemoryMonitor.getInstance().logMemoryUsage(componentName);
}

/**
 * Safe cleanup utility for managing component state
 * Prevents memory leaks without interfering with video components
 */
export class SafeCleanupManager {
  private timers: Set<NodeJS.Timeout> = new Set();
  private listeners: Set<() => void> = new Set();
  
  /**
   * Register a timer for cleanup
   */
  addTimer(timer: NodeJS.Timeout): void {
    this.timers.add(timer);
  }
  
  /**
   * Register a listener cleanup function
   */
  addListener(cleanup: () => void): void {
    this.listeners.add(cleanup);
  }
  
  /**
   * Clean up all registered timers and listeners
   */
  cleanup(): void {
    // Clear all timers
    this.timers.forEach(timer => {
      try {
        clearTimeout(timer);
        clearInterval(timer);
      } catch (error) {
        console.warn('[SafeCleanupManager] Error clearing timer:', error);
      }
    });
    this.timers.clear();
    
    // Call all cleanup functions
    this.listeners.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[SafeCleanupManager] Error in cleanup function:', error);
      }
    });
    this.listeners.clear();
  }
}

/**
 * React hook for safe cleanup management
 */
export function useSafeCleanup(): SafeCleanupManager {
  const cleanupManager = useRef(new SafeCleanupManager());
  
  useEffect(() => {
    return () => {
      cleanupManager.current.cleanup();
    };
  }, []);
  
  return cleanupManager.current;
}

/**
 * Memory-efficient view logger that prevents unbounded growth
 * Replaces the problematic Set-based approach in FeedScreen
 */
export class SafeViewLogger {
  private viewedItems: Map<string, number> = new Map();
  private maxItems: number;
  
  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }
  
  /**
   * Check if an item has been logged
   */
  hasLogged(itemId: string): boolean {
    return this.viewedItems.has(itemId);
  }
  
  /**
   * Mark an item as logged
   */
  markAsLogged(itemId: string): void {
    // Clean up old entries if we're at the limit
    if (this.viewedItems.size >= this.maxItems) {
      this.cleanup();
    }
    
    this.viewedItems.set(itemId, Date.now());
  }
  
  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup(): void {
    const entries = Array.from(this.viewedItems.entries());
    
    // Sort by timestamp and keep only the newest half
    entries.sort((a, b) => b[1] - a[1]);
    const toKeep = entries.slice(0, Math.floor(this.maxItems / 2));
    
    this.viewedItems.clear();
    toKeep.forEach(([id, timestamp]) => {
      this.viewedItems.set(id, timestamp);
    });
    
    console.log(`[SafeViewLogger] Cleaned up logged views, kept ${toKeep.length} recent entries`);
  }
  
  /**
   * Get the number of logged items
   */
  getSize(): number {
    return this.viewedItems.size;
  }
  
  /**
   * Clear all logged items
   */
  clear(): void {
    this.viewedItems.clear();
  }
}

export default {
  MemoryMonitor,
  useMemoryMonitor,
  logMemoryUsage,
  SafeCleanupManager,
  useSafeCleanup,
  SafeViewLogger,
}; 