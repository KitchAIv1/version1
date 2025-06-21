import { useState, useEffect } from 'react';

export interface NetworkQuality {
  speed: number; // Mbps
  connectionType: string;
  isConnected: boolean;
  quality: 'low' | 'medium' | 'high';
}

export const useNetworkQuality = () => {
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>({
    speed: 100, // Default to high speed
    connectionType: 'wifi',
    isConnected: true,
    quality: 'high',
  });

  const getQualityFromSpeed = (speed: number): 'low' | 'medium' | 'high' => {
    if (speed < 30) return 'low'; // 480p for slow connections
    if (speed < 100) return 'medium'; // 720p for medium connections
    return 'high'; // 1080p for fast connections
  };

  const measureNetworkSpeed = async (): Promise<number> => {
    try {
      const startTime = Date.now();
      // Use a small test image from a reliable source
      const response = await fetch('https://httpbin.org/bytes/1024', {
        cache: 'no-cache',
      });
      await response.blob();
      const endTime = Date.now();

      const duration = (endTime - startTime) / 1000; // seconds
      const sizeInBits = 1024 * 8; // 1KB in bits
      const speedBps = sizeInBits / duration;
      const speedMbps = speedBps / (1024 * 1024);

      return Math.max(speedMbps * 100, 10); // Scale up and ensure minimum
    } catch (error) {
      console.warn('Network speed test failed:', error);
      return 30; // Conservative fallback
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const updateNetworkInfo = async () => {
      try {
        const isConnected = await checkConnection();
        if (!isConnected) {
          setNetworkQuality(prev => ({
            ...prev,
            isConnected: false,
            speed: 0,
            quality: 'low',
          }));
          return;
        }

        const speed = await measureNetworkSpeed();

        setNetworkQuality({
          speed,
          connectionType: 'unknown', // Simplified since we don't have NetInfo
          isConnected: true,
          quality: getQualityFromSpeed(speed),
        });
      } catch (error) {
        console.warn('Failed to update network info:', error);
        // Keep previous state or set conservative defaults
        setNetworkQuality(prev => ({
          ...prev,
          speed: 30,
          quality: 'low',
        }));
      }
    };

    // Initial measurement
    updateNetworkInfo();

    // Periodic speed checks (every 30 seconds)
    const speedCheckInterval = setInterval(() => {
      updateNetworkInfo();
    }, 30000);

    return () => {
      clearInterval(speedCheckInterval);
    };
  }, []);

  return networkQuality;
};
