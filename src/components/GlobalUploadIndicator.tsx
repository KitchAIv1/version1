import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundUploadService, { UploadQueueItem, UploadProgress } from '../services/BackgroundUploadService';
import UserAwareBackgroundUploadService, { UserAwareUploadQueueItem, UserAwareUploadProgress } from '../services/UserAwareBackgroundUploadService';
import { useAuth } from '../providers/AuthProvider';
import { UploadQueueModal } from './UploadQueueModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const INDICATOR_SIZE = 60;
const INDICATOR_MARGIN = 16;

// Development logging flag
const __DEV__ = process.env.NODE_ENV === 'development';

interface GlobalUploadIndicatorProps {
  visible: boolean;
}

// Unified upload types for display
type UnifiedUploadItem = UploadQueueItem | UserAwareUploadQueueItem;
type UnifiedUploadProgress = UploadProgress | UserAwareUploadProgress;

const formatProgress = (progress: number): string => {
  return `${Math.round(progress * 100)}%`;
};

const isUserAwareItem = (item: UnifiedUploadItem): item is UserAwareUploadQueueItem => {
  return 'userId' in item;
};

const isUserAwareProgress = (progress: UnifiedUploadProgress): progress is UserAwareUploadProgress => {
  return 'userId' in progress;
};

export const GlobalUploadIndicator: React.FC<GlobalUploadIndicatorProps> = ({ visible }) => {
  const [uploads, setUploads] = useState<UnifiedUploadItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<UnifiedUploadProgress | null>(null);
  const [lastProgress, setLastProgress] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { user } = useAuth();

  // PERFORMANCE FIX: Memoize upload service instances
  const uploadService = useMemo(() => BackgroundUploadService.getInstance(), []);
  const userAwareService = useMemo(() => 
    user?.id ? UserAwareBackgroundUploadService.getInstance(user.id) : null, 
    [user?.id]
  );
  const insets = useSafeAreaInsets();

  // PERFORMANCE FIX: Unified update functions for both services
  const updateQueue = useCallback((
    originalItems: UploadQueueItem[] = [], 
    userAwareItems: UserAwareUploadQueueItem[] = []
  ) => {
    // Combine uploads from both services
    const allUploads: UnifiedUploadItem[] = [...originalItems, ...userAwareItems];
    setUploads(allUploads);
    
    const hasActiveUploads = allUploads.some(item => 
      item.status === 'uploading' || item.status === 'pending'
    );
    setIsVisible(hasActiveUploads && visible);
    
    // Reset progress tracking when queue changes
    if (!hasActiveUploads) {
      setLastProgress(0);
      setCurrentProgress(null);
    }

    if (__DEV__ && allUploads.length > 0) {
      const originalCount = originalItems.length;
      const userAwareCount = userAwareItems.length;
      console.log(`🔄 GlobalUploadIndicator: ${originalCount} original + ${userAwareCount} secure uploads = ${allUploads.length} total`);
    }
  }, [visible]);

  // PERFORMANCE FIX: More responsive progress updates for both services
  const updateProgress = useCallback((progress: UnifiedUploadProgress) => {
    // 🔧 PERFORMANCE FIX: Improved throttling - only update on significant changes
    const progressChange = Math.abs(progress.progress - lastProgress);
    const shouldUpdate = (
      progressChange >= 0.05 || // 5% change threshold
      progress.progress >= 1.0 || // Always show completion
      progress.progress === 0 || // Always show start
      progress.stage === 'completed' // Always show final stage
    );
    
    if (shouldUpdate) {
      setCurrentProgress(progress);
      setLastProgress(progress.progress);
      
      if (__DEV__) {
        const serviceType = isUserAwareProgress(progress) ? '🔒 Secure' : '📁 Original';
        console.log(`🔄 GlobalUploadIndicator ${serviceType} progress: ${Math.round(progress.progress * 100)}% - ${progress.stage}`);
      }
    }
  }, [lastProgress]);

  const handleUploadSuccess = useCallback(() => {
    // Reset progress tracking
    setLastProgress(0);
    setCurrentProgress(null);
    
    // Show completion animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  const handleUploadFailed = useCallback(() => {
    // Reset progress tracking on failure
    setLastProgress(0);
    setCurrentProgress(null);
  }, []);

  // Subscribe to original upload service
  useEffect(() => {
    const handleOriginalQueueUpdate = (queueItems: UploadQueueItem[]) => {
      const userAwareItems = userAwareService?.getQueueStatus() || [];
      updateQueue(queueItems, userAwareItems);
    };

    uploadService.on('queueUpdated', handleOriginalQueueUpdate);
    uploadService.on('uploadProgress', updateProgress);
    uploadService.on('uploadSuccess', handleUploadSuccess);
    uploadService.on('uploadFailed', handleUploadFailed);

    // Initial load
    handleOriginalQueueUpdate(uploadService.getQueueStatus());

    return () => {
      uploadService.off('queueUpdated', handleOriginalQueueUpdate);
      uploadService.off('uploadProgress', updateProgress);
      uploadService.off('uploadSuccess', handleUploadSuccess);
      uploadService.off('uploadFailed', handleUploadFailed);
    };
  }, [uploadService, updateQueue, updateProgress, handleUploadSuccess, handleUploadFailed, userAwareService]);

  // Subscribe to user-aware upload service
  useEffect(() => {
    if (!userAwareService || !user?.id) return;

    const handleUserAwareQueueUpdate = (queueItems: UserAwareUploadQueueItem[]) => {
      const originalItems = uploadService.getQueueStatus();
      updateQueue(originalItems, queueItems);
    };

    userAwareService.on('queueUpdated', handleUserAwareQueueUpdate);
    userAwareService.on('uploadProgress', updateProgress);
    userAwareService.on('uploadSuccess', handleUploadSuccess);
    userAwareService.on('uploadFailed', handleUploadFailed);

    // Initial load
    handleUserAwareQueueUpdate(userAwareService.getQueueStatus());

    return () => {
      userAwareService.off('queueUpdated', handleUserAwareQueueUpdate);
      userAwareService.off('uploadProgress', updateProgress);
      userAwareService.off('uploadSuccess', handleUploadSuccess);
      userAwareService.off('uploadFailed', handleUploadFailed);
    };
  }, [userAwareService, user?.id, updateQueue, updateProgress, handleUploadSuccess, handleUploadFailed, uploadService]);

  // PERFORMANCE FIX: Reduced animation complexity and frequency
  useEffect(() => {
    if (isVisible) {
      // Fade in and scale animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // PERFORMANCE FIX: Only start animations if there's an active upload
      const activeUpload = uploads.find(upload => upload.status === 'uploading');
      if (activeUpload) {
        // Slower rotation for less CPU usage
        const rotationAnimation = Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 4000, // Slower rotation
            useNativeDriver: true,
          })
        );
        rotationAnimation.start();

        // Slower pulse animation
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05, // Smaller pulse
              duration: 1500, // Slower pulse
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
          ])
        );
        pulseAnimation.start();

        // Clean up animations when upload completes
        return () => {
          rotationAnimation.stop();
          pulseAnimation.stop();
        };
      }
    } else {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, fadeAnim, scaleAnim, rotateAnim, pulseAnim, uploads]);

  const handleIndicatorPress = useCallback(() => {
    setShowModal(true);
  }, []);

  // PERFORMANCE FIX: Memoize computed values for unified upload types
  const activeUpload = useMemo(() => 
    uploads.find(upload => upload.status === 'uploading'), 
    [uploads]
  );
  
  // CRITICAL FIX: Use currentProgress instead of activeUpload.progress for real-time updates
  const progress = useMemo(() => {
    if (currentProgress && currentProgress.progress !== undefined) {
      return currentProgress.progress;
    }
    return activeUpload?.progress || 0;
  }, [currentProgress, activeUpload]);

  // Enhanced upload info for display
  const uploadInfo = useMemo(() => {
    if (!activeUpload) return null;
    
    const isSecure = isUserAwareItem(activeUpload);
    return {
      isSecure,
      serviceType: isSecure ? '🔒 Secure Upload' : '📁 Standard Upload',
      count: uploads.length,
      activeCount: uploads.filter(u => u.status === 'uploading' || u.status === 'pending').length
    };
  }, [activeUpload, uploads]);

  if (!isVisible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            top: insets.top + 60, // Below status bar and header
            opacity: fadeAnim,
            transform: [
              { scale: Animated.multiply(scaleAnim, pulseAnim) },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.indicator}
          onPress={handleIndicatorPress}
          activeOpacity={0.8}
        >
          {/* Background circle with progress */}
          <View style={styles.progressBackground}>
            <View style={styles.progressCircle}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    transform: [
                      { 
                        rotate: spin
                      },
                      {
                        scale: progress > 0 ? 1 : 0
                      }
                    ],
                  },
                ]}
              />
            </View>
          </View>

          {/* Icon - Enhanced to show service type */}
          <View style={styles.iconContainer}>
            {activeUpload ? (
              uploadInfo?.isSecure ? (
                <Feather name="shield" size={24} color="#fff" />
              ) : (
                <Feather name="upload-cloud" size={24} color="#fff" />
              )
            ) : (
              <Feather name="check-circle" size={24} color="#fff" />
            )}
          </View>

          {/* Progress text - FIXED: Now shows real-time progress */}
          {activeUpload && (
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressPercentage}>
                {formatProgress(progress)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* FIXED: Use the proper UploadQueueModal component */}
      <UploadQueueModal
        visible={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: INDICATOR_MARGIN,
    zIndex: 9999,
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  progressBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_SIZE / 2,
  },
  progressCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTextContainer: {
    position: 'absolute',
    bottom: -24,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  progressPercentage: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default GlobalUploadIndicator; 