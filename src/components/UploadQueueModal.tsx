import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BackgroundUploadService, { UploadQueueItem } from '../services/BackgroundUploadService';
import { MainStackParamList } from '../navigation/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface UploadQueueModalProps {
  visible: boolean;
  onClose: () => void;
}

export const UploadQueueModal: React.FC<UploadQueueModalProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<NavigationProp>();
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const uploadService = useMemo(() => BackgroundUploadService.getInstance(), []);
  const insets = useSafeAreaInsets();

  // Memoized filter function for performance
  const filterRelevantItems = useCallback((items: UploadQueueItem[]): UploadQueueItem[] => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    return items.filter(item => 
      item.status === 'failed' || 
      item.status === 'pending' || 
      item.status === 'uploading' ||
      (item.status === 'completed' && item.completedAt && item.completedAt > oneDayAgo)
    );
  }, []);

  const loadQueueData = useCallback(() => {
    try {
      const allItems = uploadService.getQueueStatus();
      const relevantItems = filterRelevantItems(allItems);
      setQueueItems(relevantItems);
    } catch (error) {
      console.error('[UploadQueueModal] Error loading queue data:', error);
      // Show user-friendly error
      Alert.alert('Error', 'Failed to load upload queue. Please try again.');
    }
  }, [uploadService, filterRelevantItems]);

  useEffect(() => {
    if (!visible) return;

    // Load initial data
    loadQueueData();
    
    const handleQueueUpdate = (updatedQueue: UploadQueueItem[]) => {
      const relevantItems = filterRelevantItems(updatedQueue);
      setQueueItems(relevantItems);
    };

    const handleUploadRetried = () => loadQueueData();
    const handleUploadCancelled = () => loadQueueData();

    // Subscribe to events
    uploadService.on('queueUpdated', handleQueueUpdate);
    uploadService.on('uploadRetried', handleUploadRetried);
    uploadService.on('uploadCancelled', handleUploadCancelled);

    // Cleanup function
    return () => {
      uploadService.off('queueUpdated', handleQueueUpdate);
      uploadService.off('uploadRetried', handleUploadRetried);
      uploadService.off('uploadCancelled', handleUploadCancelled);
    };
  }, [visible, loadQueueData, uploadService, filterRelevantItems]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      loadQueueData();
    } catch (error) {
      console.error('[UploadQueueModal] Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadQueueData]);

  const handleRetry = useCallback(async (uploadId: string) => {
    try {
      const success = await uploadService.retryFailedUpload(uploadId);
      if (success) {
        Alert.alert('Upload Retried', 'Your recipe upload has been added back to the queue.');
      } else {
        Alert.alert('Retry Failed', 'Unable to retry this upload. Please try again.');
      }
    } catch (error) {
      console.error('[UploadQueueModal] Error retrying upload:', error);
      Alert.alert('Error', 'Failed to retry upload. Please try again.');
    }
  }, [uploadService]);

  const handleEdit = useCallback((item: UploadQueueItem) => {
    Alert.alert(
      'Edit Recipe', 
      `Create a new recipe based on "${item.metadata.title}"? The failed upload will be removed from the queue.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create New',
          onPress: async () => {
            try {
              onClose(); // Close modal first
              // Remove the failed upload from queue since user is starting fresh
              await uploadService.cancelUpload(item.id);
            } catch (error) {
              console.error('[UploadQueueModal] Error cancelling upload for edit:', error);
            }
          }
        }
      ]
    );
  }, [uploadService, onClose]);

  const handleDelete = useCallback((uploadId: string, title: string) => {
    Alert.alert(
      'Delete Upload',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await uploadService.cancelUpload(uploadId);
            } catch (error) {
              console.error('[UploadQueueModal] Error deleting upload:', error);
              Alert.alert('Error', 'Failed to delete upload. Please try again.');
            }
          },
        },
      ]
    );
  }, [uploadService]);

  const handleClearCompleted = useCallback(() => {
    const completedCount = queueItems.filter(item => item.status === 'completed').length;
    if (completedCount === 0) return;

    Alert.alert(
      'Clear Completed',
      `Remove ${completedCount} completed upload${completedCount > 1 ? 's' : ''} from the queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              await uploadService.clearCompletedUploads();
            } catch (error) {
              console.error('[UploadQueueModal] Error clearing completed uploads:', error);
              Alert.alert('Error', 'Failed to clear completed uploads. Please try again.');
            }
          },
        },
      ]
    );
  }, [queueItems, uploadService]);

  // Memoized utility functions for performance
  const getStatusColor = useCallback((status: UploadQueueItem['status']) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'failed': return '#ef4444';
      case 'uploading': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  }, []);

  const getStatusIcon = useCallback((status: UploadQueueItem['status']) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'failed': return 'x-circle';
      case 'uploading': return 'upload-cloud';
      case 'pending': return 'clock';
      default: return 'help-circle';
    }
  }, []);

  const getStatusText = useCallback((status: UploadQueueItem['status']) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'uploading': return 'Uploading';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  }, []);

  const formatTimeAgo = useCallback((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }, []);

  // Memoized render function for performance
  const renderQueueItem = useCallback(({ item }: { item: UploadQueueItem }) => (
    <View style={styles.queueItem}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {item.thumbnailUri ? (
          <Image 
            source={{ uri: item.thumbnailUri }} 
            style={styles.thumbnail}
            onError={(error) => {
              console.warn('[UploadQueueModal] Failed to load thumbnail:', error);
            }}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
            <Feather name="video" size={16} color="#6b7280" />
          </View>
        )}
        
        {/* Status indicator overlay */}
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
          <Feather name={getStatusIcon(item.status)} size={10} color="white" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.metadata.title || 'Untitled Recipe'}
        </Text>
        
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
          <Text style={styles.timeText}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>

        {item.status === 'uploading' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, item.progress * 100))}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
          </View>
        )}

        {item.error && (
          <Text style={styles.errorText} numberOfLines={1}>
            {item.error}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {item.status === 'failed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.retryButton]}
            onPress={() => handleRetry(item.id)}
            accessibilityLabel="Retry upload"
            accessibilityRole="button"
          >
            <Feather name="refresh-cw" size={14} color="white" />
          </TouchableOpacity>
        )}
        {item.status === 'failed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
            accessibilityLabel="Edit recipe"
            accessibilityRole="button"
          >
            <Feather name="edit-2" size={14} color="white" />
          </TouchableOpacity>
        )}
        {(item.status === 'pending' || item.status === 'uploading' || item.status === 'failed') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item.id, item.metadata.title || 'Untitled Recipe')}
            accessibilityLabel="Delete upload"
            accessibilityRole="button"
          >
            <Feather name="x" size={14} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [getStatusColor, getStatusIcon, getStatusText, formatTimeAgo, handleRetry, handleEdit, handleDelete]);

  const EmptyState = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Feather name="upload-cloud" size={48} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No uploads in queue</Text>
      <Text style={styles.emptySubtitle}>
        Your recipe uploads will appear here
      </Text>
    </View>
  ), []);

  // Memoized stats calculation
  const stats = useMemo(() => {
    const completedCount = queueItems.filter(item => item.status === 'completed').length;
    const failedCount = queueItems.filter(item => item.status === 'failed').length;
    const activeCount = queueItems.filter(item => item.status === 'pending' || item.status === 'uploading').length;
    
    return { completedCount, failedCount, activeCount };
  }, [queueItems]);

  // Memoized key extractor for FlatList performance
  const keyExtractor = useCallback((item: UploadQueueItem) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Upload Queue</Text>
            <View style={styles.statsContainer}>
              {stats.activeCount > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#3b82f6' }]} />
                  <Text style={styles.statText}>{stats.activeCount} active</Text>
                </View>
              )}
              {stats.failedCount > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
                  <Text style={styles.statText}>{stats.failedCount} failed</Text>
                </View>
              )}
              {stats.completedCount > 0 && (
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
                  <Text style={styles.statText}>{stats.completedCount} completed</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.headerRight}>
            {stats.completedCount > 0 && (
              <TouchableOpacity 
                style={styles.clearButton} 
                onPress={handleClearCompleted}
                accessibilityLabel="Clear completed uploads"
                accessibilityRole="button"
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              accessibilityLabel="Close upload queue"
              accessibilityRole="button"
            >
              <Feather name="x" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Queue list */}
        <FlatList
          data={queueItems}
          renderItem={renderQueueItem}
          keyExtractor={keyExtractor}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<EmptyState />}
          removeClippedSubviews={true} // Performance optimization
          maxToRenderPerBatch={10} // Performance optimization
          windowSize={10} // Performance optimization
          initialNumToRender={5} // Performance optimization
          getItemLayout={undefined} // Let FlatList calculate automatically for variable heights
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statText: {
    fontSize: 11,
    color: '#64748b',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
    gap: 8,
  },
  queueItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timeText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  errorText: {
    fontSize: 10,
    color: '#ef4444',
    fontStyle: 'italic',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: '#e2e8f0',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressText: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#10b981',
  },
  editButton: {
    backgroundColor: '#3b82f6',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
}); 