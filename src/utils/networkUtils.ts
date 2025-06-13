/**
 * Network Utilities - Simplified
 * Provides offline error detection for the global NetworkProvider.
 * Retry logic is now handled by React Query's built-in retry mechanism.
 */

/**
 * Enhanced error detection for offline scenarios
 */
export const isOfflineError = (error: any): boolean => {
  if (!error) return false;
  
  // Common offline error patterns
  const offlinePatterns = [
    'network request failed',
    'fetch failed',
    'no internet connection',
    'connection refused',
    'network error',
    'timeout',
    'unreachable',
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  return offlinePatterns.some(pattern => 
    errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
};
