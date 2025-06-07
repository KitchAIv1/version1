import { useState, useCallback, useRef, useEffect } from 'react';

interface PreloadedVideo {
  url: string;
  optimizedUrl: string;
  isLoaded: boolean;
  priority: 'high' | 'medium' | 'low';
  lastAccessed: number;
}

interface VideoPreloaderConfig {
  maxCacheSize: number;
  preloadDistance: number; // How many videos ahead/behind to preload
}

export const useVideoPreloader = (config: VideoPreloaderConfig = {
  maxCacheSize: 5,
  preloadDistance: 2,
}) => {
  const [preloadedVideos, setPreloadedVideos] = useState<Map<string, PreloadedVideo>>(new Map());
  const [loadingQueue, setLoadingQueue] = useState<string[]>([]);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const getOptimizedVideoUrl = useCallback((baseUrl: string, quality: 'low' | 'medium' | 'high' = 'medium'): string => {
    if (!baseUrl) return baseUrl;

    // For Supabase storage videos, we can add quality parameters if supported
    if (baseUrl.includes('supabase.co')) {
      // Add quality parameter for future CDN optimization
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}quality=${quality}`;
    }

    // For MUX videos, they already handle adaptive streaming
    if (baseUrl.includes('mux.com')) {
      return baseUrl;
    }

    return baseUrl;
  }, []);

  const cleanupOldVideos = useCallback(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    setPreloadedVideos(prev => {
      const updated = new Map(prev);
      const entries = Array.from(updated.entries());
      
      // Sort by last accessed time and priority
      entries.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityWeight[a[1].priority];
        const bPriority = priorityWeight[b[1].priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        return b[1].lastAccessed - a[1].lastAccessed; // More recent first
      });

      // Remove oldest entries beyond cache size or too old
      const toRemove = entries.slice(config.maxCacheSize);
      const tooOld = entries.filter(([, video]) => now - video.lastAccessed > maxAge);

      [...toRemove, ...tooOld].forEach(([url]) => {
        updated.delete(url);
      });

      return updated;
    });
  }, [config.maxCacheSize]);

  const preloadVideo = useCallback((
    videoUrl: string, 
    priority: 'high' | 'medium' | 'low' = 'medium',
    quality: 'low' | 'medium' | 'high' = 'medium'
  ): string => {
    if (!videoUrl) return videoUrl;

    // Check cache size and cleanup if needed
    if (preloadedVideos.size >= config.maxCacheSize) {
      cleanupOldVideos();
    }

    const optimizedUrl = getOptimizedVideoUrl(videoUrl, quality);

    if (preloadedVideos.has(videoUrl)) {
      const existing = preloadedVideos.get(videoUrl)!;
      existing.lastAccessed = Date.now();
      return existing.optimizedUrl;
    }

    const preloadedVideo: PreloadedVideo = {
      url: videoUrl,
      optimizedUrl,
      isLoaded: false,
      priority,
      lastAccessed: Date.now(),
    };

    setPreloadedVideos(prev => new Map(prev).set(videoUrl, preloadedVideo));
    
    // Add to loading queue if not already loading
    setLoadingQueue(prev => {
      if (!prev.includes(videoUrl)) {
        return [...prev, videoUrl];
      }
      return prev;
    });

    return optimizedUrl;
  }, [preloadedVideos, config.maxCacheSize, getOptimizedVideoUrl, cleanupOldVideos]);

  const getOptimizedUrl = useCallback((videoUrl: string): string => {
    const preloaded = preloadedVideos.get(videoUrl);
    if (preloaded) {
      // Update last accessed time
      preloaded.lastAccessed = Date.now();
      return preloaded.optimizedUrl;
    }
    return videoUrl;
  }, [preloadedVideos]);

  const markVideoAsLoaded = useCallback((videoUrl: string) => {
    setPreloadedVideos(prev => {
      const updated = new Map(prev);
      const video = updated.get(videoUrl);
      if (video) {
        video.isLoaded = true;
        video.lastAccessed = Date.now();
      }
      return updated;
    });

    // Remove from loading queue
    setLoadingQueue(prev => prev.filter(url => url !== videoUrl));
  }, []);

  const preloadVideoSequence = useCallback((
    videoUrls: string[], 
    currentIndex: number,
    quality: 'low' | 'medium' | 'high' = 'medium'
  ) => {
    const { preloadDistance } = config;
    
    // Preload current video with high priority
    if (videoUrls[currentIndex]) {
      preloadVideo(videoUrls[currentIndex], 'high', quality);
    }

    // Preload next videos with medium priority
    for (let i = 1; i <= preloadDistance; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < videoUrls.length) {
        preloadVideo(videoUrls[nextIndex], 'medium', quality);
      }
    }

    // Preload previous videos with low priority
    for (let i = 1; i <= preloadDistance; i++) {
      const prevIndex = currentIndex - i;
      if (prevIndex >= 0) {
        preloadVideo(videoUrls[prevIndex], 'low', quality);
      }
    }
  }, [config.preloadDistance, preloadVideo]);

  const clearCache = useCallback(() => {
    setPreloadedVideos(new Map());
    setLoadingQueue([]);
  }, []);

  // Periodic cleanup
  useEffect(() => {
    const scheduleCleanup = () => {
      cleanupTimeoutRef.current = setTimeout(() => {
        cleanupOldVideos();
        scheduleCleanup();
      }, 60000); // Cleanup every minute
    };

    scheduleCleanup();

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [cleanupOldVideos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCache();
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [clearCache]);

  return {
    preloadVideo,
    getOptimizedUrl,
    markVideoAsLoaded,
    preloadVideoSequence,
    clearCache,
    preloadedVideos: Array.from(preloadedVideos.entries()),
    loadingQueue,
    cacheSize: preloadedVideos.size,
  };
}; 