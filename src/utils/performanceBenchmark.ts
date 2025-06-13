/**
 * Performance benchmarking utilities for KitchAI v2
 * VIDEO-SAFE: Pure development monitoring that doesn't affect component lifecycle
 * DEPLOYMENT-READY: Only runs in development, zero production impact
 */

interface BenchmarkEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceBenchmark {
  private static instance: PerformanceBenchmark;
  private benchmarks: Map<string, BenchmarkEntry> = new Map();
  private completed: BenchmarkEntry[] = [];
  
  static getInstance(): PerformanceBenchmark {
    if (!PerformanceBenchmark.instance) {
      PerformanceBenchmark.instance = new PerformanceBenchmark();
    }
    return PerformanceBenchmark.instance;
  }
  
  private constructor() {
    if (__DEV__) {
      console.log('[PerformanceBenchmark] 📊 Development monitoring enabled');
    }
  }
  
  /**
   * Start timing an operation
   */
  start(name: string, metadata?: Record<string, any>): void {
    if (!__DEV__) return;
    
    const entry: BenchmarkEntry = {
      name,
      startTime: performance.now(),
      metadata,
    };
    
    this.benchmarks.set(name, entry);
    console.log(`[Benchmark] ⏱️ Started: ${name}`);
  }
  
  /**
   * End timing an operation
   */
  end(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!__DEV__) return null;
    
    const entry = this.benchmarks.get(name);
    if (!entry) {
      console.warn(`[Benchmark] ⚠️ No start time found for: ${name}`);
      return null;
    }
    
    const endTime = performance.now();
    const duration = endTime - entry.startTime;
    
    const completedEntry: BenchmarkEntry = {
      ...entry,
      endTime,
      duration,
      metadata: { ...entry.metadata, ...additionalMetadata },
    };
    
    this.completed.push(completedEntry);
    this.benchmarks.delete(name);
    
    // Keep only last 100 completed benchmarks
    if (this.completed.length > 100) {
      this.completed = this.completed.slice(-50);
    }
    
    const rating = this.getPerformanceRating(duration, name);
    console.log(`[Benchmark] ✅ Completed: ${name} - ${duration.toFixed(2)}ms ${rating}`);
    
    return duration;
  }
  
  /**
   * Get performance rating with context-aware benchmarks
   */
  private getPerformanceRating(duration: number, operationName: string): string {
    const benchmarks = this.getBenchmarkThresholds(operationName);
    
    if (duration <= benchmarks.excellent) return '🟢 EXCELLENT';
    if (duration <= benchmarks.good) return '🟡 GOOD';
    if (duration <= benchmarks.acceptable) return '🟠 ACCEPTABLE';
    return '🔴 NEEDS OPTIMIZATION';
  }
  
  /**
   * Context-aware performance thresholds
   */
  private getBenchmarkThresholds(operationName: string): {
    excellent: number;
    good: number;
    acceptable: number;
  } {
    const lowerName = operationName.toLowerCase();
    
    // Screen loading benchmarks
    if (lowerName.includes('screen') || lowerName.includes('load')) {
      return { excellent: 500, good: 800, acceptable: 1200 };
    }
    
    // Search operation benchmarks
    if (lowerName.includes('search') || lowerName.includes('filter')) {
      return { excellent: 50, good: 100, acceptable: 200 };
    }
    
    // API call benchmarks
    if (lowerName.includes('api') || lowerName.includes('fetch') || lowerName.includes('request')) {
      return { excellent: 300, good: 500, acceptable: 1000 };
    }
    
    // Database operation benchmarks
    if (lowerName.includes('db') || lowerName.includes('query') || lowerName.includes('supabase')) {
      return { excellent: 200, good: 400, acceptable: 800 };
    }
    
    // Default benchmarks
    return { excellent: 100, good: 200, acceptable: 500 };
  }
  
  /**
   * Get performance summary for specific operations
   */
  getSummary(operationPrefix?: string): string {
    if (!__DEV__ || this.completed.length === 0) {
      return '[PerformanceBenchmark] No performance data available';
    }
    
    const filtered = operationPrefix
      ? this.completed.filter(entry => entry.name.toLowerCase().includes(operationPrefix.toLowerCase()))
      : this.completed;
    
    if (filtered.length === 0) {
      return `[PerformanceBenchmark] No data for operations matching: ${operationPrefix}`;
    }
    
    const stats = this.calculateStats(filtered);
    
    let summary = `[PerformanceBenchmark] Performance Summary${operationPrefix ? ` (${operationPrefix})` : ''}:\n`;
    summary += `  📊 Operations: ${stats.count}\n`;
    summary += `  ⚡ Average: ${stats.average.toFixed(1)}ms\n`;
    summary += `  🏆 Best: ${stats.min.toFixed(1)}ms\n`;
    summary += `  🐌 Worst: ${stats.max.toFixed(1)}ms\n`;
    summary += `  📈 P95: ${stats.p95.toFixed(1)}ms\n`;
    
    // Recent operations
    const recent = filtered.slice(-3);
    summary += `  🕐 Recent Operations:\n`;
    recent.forEach(entry => {
      const rating = this.getPerformanceRating(entry.duration!, entry.name);
      summary += `    - ${entry.name}: ${entry.duration!.toFixed(1)}ms ${rating}\n`;
    });
    
    return summary;
  }
  
  /**
   * Calculate performance statistics
   */
  private calculateStats(entries: BenchmarkEntry[]): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } {
    const durations = entries
      .filter(entry => entry.duration !== undefined)
      .map(entry => entry.duration!);
    
    if (durations.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, p95: 0 };
    }
    
    const sorted = durations.sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    
    return {
      count: durations.length,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[p95Index] || sorted[sorted.length - 1],
    };
  }
  
  /**
   * Clear all benchmark data
   */
  clear(): void {
    if (!__DEV__) return;
    
    this.benchmarks.clear();
    this.completed = [];
    console.log('[PerformanceBenchmark] 🧹 Cleared all benchmark data');
  }
  
  /**
   * Log slow operations (development only)
   */
  logSlowOperations(thresholdMs: number = 1000): void {
    if (!__DEV__) return;
    
    const slowOps = this.completed.filter(entry => 
      entry.duration && entry.duration > thresholdMs
    );
    
    if (slowOps.length === 0) {
      console.log(`[PerformanceBenchmark] ✅ No operations slower than ${thresholdMs}ms`);
      return;
    }
    
    console.log(`[PerformanceBenchmark] 🐌 Found ${slowOps.length} slow operations (>${thresholdMs}ms):`);
    slowOps.forEach(entry => {
      console.log(`  - ${entry.name}: ${entry.duration!.toFixed(1)}ms`);
    });
  }
}

/**
 * Simple React hook for component performance tracking
 */
export function useComponentBenchmark(componentName: string): {
  startBenchmark: (operation: string) => void;
  endBenchmark: (operation: string) => void;
  benchmarkAsync: <T>(operation: string, asyncFn: () => Promise<T>) => Promise<T>;
} {
  const benchmark = PerformanceBenchmark.getInstance();
  
  const startBenchmark = (operation: string) => {
    benchmark.start(`${componentName}_${operation}`);
  };
  
  const endBenchmark = (operation: string) => {
    benchmark.end(`${componentName}_${operation}`);
  };
  
  const benchmarkAsync = async <T>(operation: string, asyncFn: () => Promise<T>): Promise<T> => {
    const operationName = `${componentName}_${operation}`;
    benchmark.start(operationName);
    
    try {
      const result = await asyncFn();
      benchmark.end(operationName, { success: true });
      return result;
    } catch (error) {
      benchmark.end(operationName, { success: false, error: String(error) });
      throw error;
    }
  };
  
  return { startBenchmark, endBenchmark, benchmarkAsync };
}

/**
 * Global performance utilities
 */
export const performanceBenchmark = {
  start: (name: string, metadata?: Record<string, any>) => 
    PerformanceBenchmark.getInstance().start(name, metadata),
  
  end: (name: string, metadata?: Record<string, any>) => 
    PerformanceBenchmark.getInstance().end(name, metadata),
  
  getSummary: (operationPrefix?: string) => 
    PerformanceBenchmark.getInstance().getSummary(operationPrefix),
  
  logSlowOps: (thresholdMs?: number) => 
    PerformanceBenchmark.getInstance().logSlowOperations(thresholdMs),
  
  clear: () => PerformanceBenchmark.getInstance().clear(),
};

export default performanceBenchmark; 