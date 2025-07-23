import { useState, useCallback, useRef, useEffect } from 'react';

interface PreloadedVideo {
  url: string;
  optimizedUrl: string;
  isLoaded: boolean;
  priority: 'high' | 'medium' | 'low';
  lastAccessed: number;
  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Track loading performance
  loadStartTime?: number;
}

interface VideoPreloaderConfig {
  maxCacheSize: number;
  preloadDistance: number; // How many videos ahead/behind to preload
  adaptivePreloading: boolean;
  maxConcurrentLoads: number;
}

export const useVideoPreloader = (
  config: VideoPreloaderConfig = {
    maxCacheSize: 8,
    preloadDistance: 3,
    adaptivePreloading: true,
    maxConcurrentLoads: 2,
  },
) => {
  const [preloadedVideos, setPreloadedVideos] = useState<
    Map<string, PreloadedVideo>
  >(new Map());
  const [loadingQueue, setLoadingQueue] = useState<string[]>([]);
  const [currentlyLoading, setCurrentlyLoading] = useState<Set<string>>(() => new Set());
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const getOptimizedVideoUrl = useCallback(
    (
      baseUrl: string,
      quality: 'low' | 'medium' | 'high' = 'medium',
      networkSpeed?: number,
    ): string => {
      if (!baseUrl) return baseUrl;

      if (config.adaptivePreloading && networkSpeed !== undefined) {
        if (networkSpeed < 30) quality = 'low';
        else if (networkSpeed < 100) quality = 'medium';
        else quality = 'high';
      }

      if (baseUrl.includes('supabase.co/storage')) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        const qualityParams = {
          low: 'w=480&h=720&q=60&f=mp4',
          medium: 'w=720&h=1280&q=75&f=mp4',
          high: 'w=1080&h=1920&q=85&f=mp4'
        };
        return `${baseUrl}${separator}${qualityParams[quality]}`;
      }

      if (baseUrl.includes('mux.com')) {
        return baseUrl;
      }

      return baseUrl;
    },
    [config.adaptivePreloading],
  );

  const cleanupOldVideos = useCallback(() => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    setPreloadedVideos(prev => {
      const updated = new Map(prev);
      const entries = Array.from(updated.entries());

      entries.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityWeight[a[1].priority];
        const bPriority = priorityWeight[b[1].priority];

        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }

        return b[1].lastAccessed - a[1].lastAccessed;
      });

      const toRemove = entries.slice(config.maxCacheSize);
      const tooOld = entries.filter(
        ([, video]) => now - video.lastAccessed > maxAge,
      );

      [...toRemove, ...tooOld].forEach(([url, video]) => {
        // Clean up video references
        updated.delete(url);
      });

      return updated;
    });
  }, [config.maxCacheSize]);

  const preloadVideo = useCallback(
    (
      videoUrl: string,
      priority: 'high' | 'medium' | 'low' = 'medium',
      quality: 'low' | 'medium' | 'high' = 'medium',
      networkSpeed?: number,
    ): string => {
      if (!videoUrl) return videoUrl;

      if (preloadedVideos.has(videoUrl)) {
        const existing = preloadedVideos.get(videoUrl)!;
        existing.lastAccessed = Date.now();
        return existing.optimizedUrl;
      }

      if (currentlyLoading.size >= config.maxConcurrentLoads && priority !== 'high') {
        setLoadingQueue(prev => {
          if (!prev.includes(videoUrl)) {
            return [...prev, videoUrl];
          }
          return prev;
        });
        return getOptimizedVideoUrl(videoUrl, quality, networkSpeed);
      }

      if (preloadedVideos.size >= config.maxCacheSize) {
        cleanupOldVideos();
      }

      const optimizedUrl = getOptimizedVideoUrl(videoUrl, quality, networkSpeed);

      const preloadedVideo: PreloadedVideo = {
        url: videoUrl,
        optimizedUrl,
        isLoaded: false,
        priority,
        lastAccessed: Date.now(),
        loadStartTime: Date.now(),
      };

      // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: React Native compatible preloading
      // Use fetch to preload video metadata without creating DOM elements
      fetch(optimizedUrl, { 
        method: 'HEAD',
        cache: 'force-cache',
      })
        .then(() => {
          setPreloadedVideos(prev => {
            const updated = new Map(prev);
            const videoData = updated.get(videoUrl);
            if (videoData) {
              videoData.isLoaded = true;
              videoData.lastAccessed = Date.now();
            }
            return updated;
          });
          
          setCurrentlyLoading(prev => {
            const updated = new Set(prev);
            updated.delete(videoUrl);
            return updated;
          });
          
          setTimeout(() => {
            setLoadingQueue(prev => {
              if (prev.length > 0) {
                const nextUrl = prev[0];
                const remaining = prev.slice(1);
                if (nextUrl) {
                  preloadVideo(nextUrl, 'medium', quality, networkSpeed);
                }
                return remaining;
              }
              return prev;
            });
          }, 100);
          
          console.log(`🎬 Video preloaded: ${videoUrl.substring(0, 50)}...`);
        })
        .catch(() => {
          console.warn(`🎬 Video preload failed: ${videoUrl.substring(0, 50)}...`);
          setCurrentlyLoading(prev => {
            const updated = new Set(prev);
            updated.delete(videoUrl);
            return updated;
          });
          
          setPreloadedVideos(prev => {
            const updated = new Map(prev);
            updated.delete(videoUrl);
            return updated;
          });
        });

      setPreloadedVideos(prev => new Map(prev).set(videoUrl, preloadedVideo));
      setCurrentlyLoading(prev => new Set(prev).add(videoUrl));

      return optimizedUrl;
    },
    [
      preloadedVideos,
      currentlyLoading,
      config.maxCacheSize,
      config.maxConcurrentLoads,
      getOptimizedVideoUrl,
      cleanupOldVideos,
    ],
  );

  const getOptimizedUrl = useCallback(
    (videoUrl: string): string => {
      const preloaded = preloadedVideos.get(videoUrl);
      if (preloaded) {
        preloaded.lastAccessed = Date.now();
        return preloaded.optimizedUrl;
      }
      return videoUrl;
    },
    [preloadedVideos],
  );

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

    setLoadingQueue(prev => prev.filter(url => url !== videoUrl));
    setCurrentlyLoading(prev => {
      const updated = new Set(prev);
      updated.delete(videoUrl);
      return updated;
    });
  }, []);

  const preloadVideoSequence = useCallback(
    (
      videoUrls: string[],
      currentIndex: number,
      quality: 'low' | 'medium' | 'high' = 'medium',
      networkSpeed?: number,
    ) => {
      const { preloadDistance } = config;

      if (videoUrls[currentIndex]) {
        preloadVideo(videoUrls[currentIndex], 'high', quality, networkSpeed);
      }

      for (let i = 1; i <= preloadDistance; i++) {
        const nextIndex = currentIndex + i;
        if (nextIndex < videoUrls.length) {
          setTimeout(() => {
            preloadVideo(videoUrls[nextIndex], 'medium', quality, networkSpeed);
          }, i * 200);
        }
      }

      for (let i = 1; i <= Math.min(preloadDistance, 2); i++) {
        const prevIndex = currentIndex - i;
        if (prevIndex >= 0) {
          setTimeout(() => {
            preloadVideo(videoUrls[prevIndex], 'low', quality, networkSpeed);
          }, (preloadDistance + i) * 200);
        }
      }
    },
    [config.preloadDistance, preloadVideo],
  );

  const clearCache = useCallback(() => {
    // Clean up video cache
    setPreloadedVideos(new Map());
    setLoadingQueue([]);
    setCurrentlyLoading(new Set());
  }, []);

  useEffect(() => {
    const scheduleCleanup = () => {
      cleanupTimeoutRef.current = setTimeout(() => {
        cleanupOldVideos();
        scheduleCleanup();
      }, 30000);
    };

    scheduleCleanup();

    return () => {
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [cleanupOldVideos]);

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
    currentlyLoading: Array.from(currentlyLoading),
    cacheSize: preloadedVideos.size,
    stats: {
      cacheHitRate: preloadedVideos.size > 0 ? 
        Array.from(preloadedVideos.values()).filter(v => v.isLoaded).length / preloadedVideos.size : 0,
      averageLoadTime: preloadedVideos.size > 0 ?
        Array.from(preloadedVideos.values())
          .filter(v => v.isLoaded && v.loadStartTime)
          .reduce((acc, v) => acc + (Date.now() - v.loadStartTime!), 0) / 
        Array.from(preloadedVideos.values()).filter(v => v.isLoaded).length : 0,
    },
  };
};
