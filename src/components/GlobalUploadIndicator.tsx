import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
  FlatList,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackgroundUploadService, { UploadQueueItem, UploadProgress } from '../services/BackgroundUploadService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const INDICATOR_SIZE = 60;
const INDICATOR_MARGIN = 16;

interface GlobalUploadIndicatorProps {
  visible: boolean;
}

const formatProgress = (progress: number): string => {
  return `${Math.round(progress * 100)}%`;
};

const formatUploadStage = (stage: string): string => {
  switch (stage) {
    case 'thumbnail': return 'Processing thumbnail...';
    case 'video': return 'Uploading video...';
    case 'processing': return 'Processing video...';
    case 'completed': return 'Complete!';
    default: return 'Uploading...';
  }
};

const UploadQueueModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  uploads: UploadQueueItem[];
  onCancel: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
}> = ({ visible, onClose, uploads, onCancel, onRetry }) => {
  const insets = useSafeAreaInsets();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading': return '#10b981';
      case 'completed': return '#22c55e';
      case 'failed': return '#ef4444';
      case 'paused': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading': return 'upload-cloud';
      case 'completed': return 'check-circle';
      case 'failed': return 'x-circle';
      case 'paused': return 'pause-circle';
      default: return 'clock';
    }
  };

  const renderUploadItem = ({ item }: { item: UploadQueueItem }) => (
    <View style={styles.uploadItem}>
      <View style={styles.uploadItemHeader}>
        <View style={[styles.statusIcon, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
          <Feather name={getStatusIcon(item.status) as any} size={16} color={getStatusColor(item.status)} />
        </View>
        <View style={styles.uploadItemContent}>
          <Text style={styles.uploadTitle} numberOfLines={1}>
            {item.metadata.title}
          </Text>
          <Text style={styles.uploadStatus}>
            {item.status === 'uploading' 
              ? `${formatProgress(item.progress)} - Uploading...`
              : item.status.charAt(0).toUpperCase() + item.status.slice(1)
            }
          </Text>
          {item.error && (
            <Text style={styles.uploadError} numberOfLines={2}>
              Error: {item.error}
            </Text>
          )}
        </View>
        <View style={styles.uploadItemActions}>
          {item.status === 'failed' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onRetry(item.id)}
            >
              <Feather name="refresh-cw" size={18} color="#10b981" />
            </TouchableOpacity>
          )}
          {(item.status === 'pending' || item.status === 'uploading' || item.status === 'failed') && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onCancel(item.id)}
            >
              <Feather name="x" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {item.status === 'uploading' && (
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${item.progress * 100}%` }]} />
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Upload Queue</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={uploads}
          renderItem={renderUploadItem}
          keyExtractor={item => item.id}
          style={styles.uploadList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="upload-cloud" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No uploads in queue</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
};

export const GlobalUploadIndicator: React.FC<GlobalUploadIndicatorProps> = ({ visible }) => {
  const [uploads, setUploads] = useState<UploadQueueItem[]>([]);
  const [currentProgress, setCurrentProgress] = useState<UploadProgress | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [lastProgress, setLastProgress] = useState<number>(0); // Track last progress to prevent jumps
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const uploadService = BackgroundUploadService.getInstance();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const updateQueue = (queueItems: UploadQueueItem[]) => {
      setUploads(queueItems);
      const hasActiveUploads = queueItems.some(item => 
        item.status === 'uploading' || item.status === 'pending'
      );
      setIsVisible(hasActiveUploads && visible);
      
      // Reset progress tracking when queue changes
      if (!hasActiveUploads) {
        setLastProgress(0);
      }
    };

    const updateProgress = (progress: UploadProgress) => {
      console.log(`🔄 GlobalUploadIndicator received progress: ${Math.round(progress.progress * 100)}% - ${progress.stage} for upload ${progress.uploadId}`);
      setCurrentProgress(progress);
    };

    const handleUploadSuccess = () => {
      // Reset progress tracking
      setLastProgress(0);
      
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
    };

    const handleUploadFailed = () => {
      // Reset progress tracking on failure
      setLastProgress(0);
    };

    // Subscribe to upload service events with correct event names
    uploadService.on('queueUpdated', updateQueue);
    uploadService.on('uploadProgress', updateProgress);
    uploadService.on('uploadSuccess', handleUploadSuccess); // Fixed event name
    uploadService.on('uploadFailed', handleUploadFailed);

    // Initial load
    updateQueue(uploadService.getQueueStatus());

    return () => {
      uploadService.off('queueUpdated', updateQueue);
      uploadService.off('uploadProgress', updateProgress);
      uploadService.off('uploadSuccess', handleUploadSuccess); // Fixed event name
      uploadService.off('uploadFailed', handleUploadFailed);
    };
  }, [visible, scaleAnim, lastProgress]); // Added lastProgress dependency

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

      // Start rotation and pulse only if there's an active upload
      const activeUpload = uploads.find(upload => upload.status === 'uploading');
      if (activeUpload) {
        // Continuous rotation for uploading state
        const rotationAnimation = Animated.loop(
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          })
        );
        rotationAnimation.start();

        // Pulse animation
        const pulseAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
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
  }, [isVisible, fadeAnim, scaleAnim, rotateAnim, pulseAnim]); // Removed uploads dependency

  const handleIndicatorPress = () => {
    setShowModal(true);
  };

  const handleCancelUpload = async (uploadId: string) => {
    await uploadService.cancelUpload(uploadId);
  };

  const handleRetryUpload = async (uploadId: string) => {
    await uploadService.resumeUpload(uploadId);
  };

  const activeUpload = uploads.find(upload => upload.status === 'uploading');
  const progress = activeUpload?.progress || 0;
  const totalUploads = uploads.length;
  const completedUploads = uploads.filter(upload => upload.status === 'completed').length;

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

          {/* Icon */}
          <View style={styles.iconContainer}>
            {activeUpload ? (
              <Feather name="upload-cloud" size={24} color="#fff" />
            ) : (
              <Feather name="check" size={24} color="#fff" />
            )}
          </View>

          {/* Progress text */}
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressText}>
              {activeUpload ? formatProgress(progress) : `${completedUploads}/${totalUploads}`}
            </Text>
          </View>

          {/* Upload count badge */}
          {totalUploads > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalUploads}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

      <UploadQueueModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        uploads={uploads}
        onCancel={handleCancelUpload}
        onRetry={handleRetryUpload}
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
  progressText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  uploadList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  uploadItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  uploadItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  uploadItemContent: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  uploadStatus: {
    fontSize: 14,
    color: '#6b7280',
  },
  uploadError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  uploadItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: '#e5e7eb',
    borderRadius: 1.5,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 1.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
});

export default GlobalUploadIndicator; 