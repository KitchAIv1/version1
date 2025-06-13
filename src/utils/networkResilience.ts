// import NetInfo from '@react-native-community/netinfo'; // TODO: Install @react-native-community/netinfo

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Exponential backoff retry with network awareness
 * Video-safe: Skips retry for video URLs to avoid interfering with playback
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if we should retry this error
      if (!shouldRetry(lastError, attempt)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(backoffFactor, attempt),
        maxDelay
      );
      
      console.log(`[NetworkResilience] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms:`, lastError.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Default retry logic - determines which errors should be retried
 */
function defaultShouldRetry(error: Error, attempt: number): boolean {
  // Don't retry client errors (4xx), only server errors (5xx) and network errors
  const errorMessage = error.message.toLowerCase();
  
  // Network errors that should be retried
  const retryableErrors = [
    'network request failed',
    'timeout',
    'connection',
    'fetch',
    'etimedout',
    'econnreset',
    'enotfound',
    'econnrefused',
  ];
  
  // HTTP status codes that should be retried (server errors)
  const retryableStatuses = [500, 502, 503, 504];
  
  // Check for retryable network errors
  const hasRetryableError = retryableErrors.some(retryableError => 
    errorMessage.includes(retryableError)
  );
  
  // Check for retryable status codes
  const hasRetryableStatus = retryableStatuses.some(status => 
    errorMessage.includes(status.toString())
  );
  
  return hasRetryableError || hasRetryableStatus;
}

/**
 * Network-aware fetch wrapper that skips video URLs
 * Provides automatic retry for API calls while preserving video playback
 */
export async function networkAwareFetch(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  // VIDEO-SAFE: Skip retry logic for video URLs to avoid playback interference
  const isVideoUrl = isVideoOrStreamingUrl(url);
  
  if (isVideoUrl) {
    console.log('[NetworkResilience] Skipping retry for video URL:', url.substring(0, 50) + '...');
    return fetch(url, options);
  }
  
  // Apply retry logic for API calls
  return retryWithExponentialBackoff(
    () => fetch(url, options),
    retryOptions
  );
}

/**
 * Determines if a URL is for video content or streaming
 */
function isVideoOrStreamingUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  // Video file extensions
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  const hasVideoExtension = videoExtensions.some(ext => lowerUrl.includes(ext));
  
  // Streaming formats
  const streamingFormats = ['.m3u8', '.mpd', '.ts'];
  const hasStreamingFormat = streamingFormats.some(format => lowerUrl.includes(format));
  
  // Streaming domains
  const streamingDomains = ['stream.mux.com', 'vimeo.com', 'youtube.com', 'youtu.be'];
  const hasStreamingDomain = streamingDomains.some(domain => lowerUrl.includes(domain));
  
  // Supabase video storage
  const isSupabaseVideo = lowerUrl.includes('supabase.co/storage') && 
                         (lowerUrl.includes('/videos/') || hasVideoExtension);
  
  return hasVideoExtension || hasStreamingFormat || hasStreamingDomain || isSupabaseVideo;
}

/**
 * Network status monitoring hook
 */
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private listeners: ((state: NetworkState) => void)[] = [];
  private currentState: NetworkState = {
    isConnected: true,
    isInternetReachable: null,
    type: null,
  };
  
  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }
  
  private constructor() {
    this.startMonitoring();
  }
  
  private startMonitoring() {
    // TODO: Implement NetInfo monitoring when package is installed
    console.log('[NetworkMonitor] Network monitoring not yet implemented - requires @react-native-community/netinfo');
  }
  
  getCurrentState(): NetworkState {
    return this.currentState;
  }
  
  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  private notifyListeners(state: NetworkState) {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('[NetworkMonitor] Error in listener:', error);
      }
    });
  }
  
  async checkConnectivity(): Promise<NetworkState> {
    // TODO: Implement NetInfo.fetch when package is installed
    console.log('[NetworkMonitor] checkConnectivity not yet implemented - requires @react-native-community/netinfo');
    return this.currentState;
  }
}

/**
 * Enhanced Supabase client wrapper with network resilience
 */
export function createResilientSupabaseCall<T>(
  supabaseCall: () => Promise<T>,
  options?: {
    retryOptions?: RetryOptions;
    skipVideoUrls?: boolean;
  }
): Promise<T> {
  return retryWithExponentialBackoff(supabaseCall, options?.retryOptions);
}

/**
 * Utility to check if current network is suitable for video streaming
 */
export function isNetworkSuitableForVideo(networkState: NetworkState): boolean {
  if (!networkState.isConnected || networkState.isInternetReachable === false) {
    return false;
  }
  
  // Warn on cellular connections but don't block
  if (networkState.type === 'cellular') {
    console.warn('[NetworkResilience] Video streaming on cellular connection - user should be aware of data usage');
  }
  
  return true;
}

export default {
  retryWithExponentialBackoff,
  networkAwareFetch,
  NetworkMonitor,
  createResilientSupabaseCall,
  isNetworkSuitableForVideo,
}; 