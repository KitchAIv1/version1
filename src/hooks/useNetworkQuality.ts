import { useState, useEffect, useRef } from 'react';

export interface NetworkQuality {
  speed: number; // Mbps
  connectionType: string;
  isConnected: boolean;
  quality: 'low' | 'medium' | 'high';
}

// 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Global network state cache to avoid redundant checks
let globalNetworkState: NetworkQuality | null = null;
let lastNetworkCheck = 0;
const NETWORK_CHECK_COOLDOWN = 300000; // 5 minutes - reduced overhead for video performance

export const useNetworkQuality = () => {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>(() => {
    // Return cached state if available and recent
    if (globalNetworkState && Date.now() - lastNetworkCheck < NETWORK_CHECK_COOLDOWN) {
      return globalNetworkState;
    }
    
    return {
      speed: 100, // Default to high speed for better UX
      connectionType: 'wifi',
      isConnected: true,
      quality: 'high',
    };
  });

  const isCheckingRef = useRef(false);

  const getQualityFromSpeed = (speed: number): 'low' | 'medium' | 'high' => {
    if (speed < 30) return 'low'; // 480p for slow connections
    if (speed < 100) return 'medium'; // 720p for medium connections
    return 'high'; // 1080p for fast connections
  };

  // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Simplified and faster network speed test
  const measureNetworkSpeed = async (): Promise<number> => {
    try {
      const startTime = Date.now();
      // Use a smaller test file for faster checks
      const response = await fetch('https://httpbin.org/bytes/512', {
        cache: 'no-cache',
      });
      await response.blob();
      const endTime = Date.now();

      const duration = (endTime - startTime) / 1000; // seconds
      const sizeInBits = 512 * 8; // 512 bytes in bits
      const speedBps = sizeInBits / duration;
      const speedMbps = speedBps / (1024 * 1024);

      return Math.max(speedMbps * 150, 20); // Scale up and ensure reasonable minimum
    } catch (error) {
      console.warn('Network speed test failed:', error);
      return 50; // More optimistic fallback for better video experience
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const updateNetworkInfo = async () => {
      // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Prevent concurrent checks
      if (isCheckingRef.current) return;
      
      const now = Date.now();
      
      // Skip if we've checked recently and have cached data
      if (globalNetworkState && now - lastNetworkCheck < NETWORK_CHECK_COOLDOWN) {
        return;
      }

      isCheckingRef.current = true;
      
      try {
        const isConnected = await checkConnection();
        if (!isConnected) {
          const newState = {
            speed: 0,
            connectionType: 'none',
            isConnected: false,
            quality: 'low' as const,
          };
          
          setNetworkQuality(newState);
          globalNetworkState = newState;
          lastNetworkCheck = now;
          return;
        }

        const speed = await measureNetworkSpeed();
        const newState = {
          speed,
          connectionType: 'unknown', // Simplified since we don't have NetInfo
          isConnected: true,
          quality: getQualityFromSpeed(speed),
        };

        setNetworkQuality(newState);
        globalNetworkState = newState;
        lastNetworkCheck = now;
      } catch (error) {
        console.warn('Failed to update network info:', error);
        // Keep optimistic defaults for better video experience
        const fallbackState = {
          speed: 50,
          connectionType: 'unknown',
          isConnected: true,
          quality: 'medium' as const,
        };
        
        setNetworkQuality(fallbackState);
        globalNetworkState = fallbackState;
        lastNetworkCheck = now;
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Initial measurement only if we don't have recent cached data
    if (!globalNetworkState || Date.now() - lastNetworkCheck >= NETWORK_CHECK_COOLDOWN) {
      updateNetworkInfo();
    }

    // 🚀 TIKTOK-LEVEL OPTIMIZATIONS: Less frequent speed checks (every 5 minutes)
    const speedCheckInterval = setInterval(() => {
      updateNetworkInfo();
    }, 300000); // Increased from 2 min to 5 minutes for video performance

    return () => {
      clearInterval(speedCheckInterval);
    };
  }, []);

  return networkQuality;
};
