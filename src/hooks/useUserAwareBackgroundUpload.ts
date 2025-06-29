import { useState, useEffect, useRef, useCallback } from 'react';
import UserAwareBackgroundUploadService, { 
  UserAwareUploadQueueItem, 
  UserAwareUploadProgress 
} from '../services/UserAwareBackgroundUploadService';
import { useAuth } from '../providers/AuthProvider';
import { RecipeMetadataForEdgeFunction } from './useVideoUploader';

export const useUserAwareBackgroundUpload = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<UserAwareUploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadService = useRef<UserAwareBackgroundUploadService | null>(null);

  // Initialize service when user is available
  useEffect(() => {
    if (user?.id && !uploadService.current) {
      uploadService.current = UserAwareBackgroundUploadService.getInstance(user.id);
      console.log(`[useUserAwareBackgroundUpload] 🔒 Initialized service for user: ${user.id}`);
      
      // Load initial queue
      const initialQueue = uploadService.current.getQueueStatus();
      setQueue(initialQueue);
      console.log(`[useUserAwareBackgroundUpload] 📊 Queue updated for user ${user.id}: ${initialQueue.length} items`);
    }
  }, [user?.id]);

  // Set up event listeners
  useEffect(() => {
    if (!uploadService.current || !user?.id) return;

    const handleQueueUpdate = (queueItems: UserAwareUploadQueueItem[]) => {
      // Filter to only show items for current user (extra security)
      const userQueue = queueItems.filter(item => item.userId === user.id);
      setQueue(userQueue);
      console.log(`[useUserAwareBackgroundUpload] 📊 Queue updated for user ${user.id}: ${userQueue.length} items`);
    };

    const handleUploadProgress = (progress: UserAwareUploadProgress) => {
      // Only handle progress for current user
      if (progress.userId === user.id) {
        setIsUploading(progress.stage !== 'completed');
      }
    };

    const handleUploadSuccess = () => {
      setIsUploading(false);
    };

    const handleUploadFailed = () => {
      setIsUploading(false);
    };

    uploadService.current.on('queueUpdated', handleQueueUpdate);
    uploadService.current.on('uploadProgress', handleUploadProgress);
    uploadService.current.on('uploadSuccess', handleUploadSuccess);
    uploadService.current.on('uploadFailed', handleUploadFailed);

    return () => {
      if (uploadService.current) {
        uploadService.current.off('queueUpdated', handleQueueUpdate);
        uploadService.current.off('uploadProgress', handleUploadProgress);
        uploadService.current.off('uploadSuccess', handleUploadSuccess);
        uploadService.current.off('uploadFailed', handleUploadFailed);
      }
    };
  }, [user?.id]);

  // 🔒 SECURITY: Clean up on user logout - BUT ONLY IF NO ACTIVE UPLOADS
  useEffect(() => {
    return () => {
      if (user?.id && uploadService.current) {
        // Check if there are active uploads before destroying
        const activeUploads = uploadService.current.getActiveUploadsCount();
        if (activeUploads === 0) {
          console.log(`[useUserAwareBackgroundUpload] 🧹 Safe to destroy service for user ${user.id} - no active uploads`);
          UserAwareBackgroundUploadService.destroyUserInstance(user.id);
        } else {
          console.log(`[useUserAwareBackgroundUpload] ⚠️ NOT destroying service for user ${user.id} - ${activeUploads} active uploads`);
        }
      }
    };
  }, [user?.id]);

  const startUpload = useCallback(async (
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: RecipeMetadataForEdgeFunction
  ): Promise<string | null> => {
    if (!uploadService.current || !user?.id) {
      throw new Error('Upload service not initialized or user not logged in');
    }

    try {
      console.log(`[useUserAwareBackgroundUpload] 🚀 Starting background upload for user ${user.id}: ${metadata.title}`);
      const uploadId = await uploadService.current.addUpload(videoUri, thumbnailUri, metadata);
      console.log(`[useUserAwareBackgroundUpload] 📦 Upload queued for user ${user.id} with ID: ${uploadId}`);
      return uploadId;
    } catch (error) {
      console.error(`[useUserAwareBackgroundUpload] ❌ Upload failed for user ${user.id}:`, error);
      throw error;
    }
  }, [user?.id]);

  const cancelUpload = useCallback(async (uploadId: string): Promise<boolean> => {
    if (!uploadService.current) return false;
    return uploadService.current.cancelUpload(uploadId);
  }, []);

  const retryUpload = useCallback(async (uploadId: string): Promise<boolean> => {
    if (!uploadService.current) return false;
    return uploadService.current.retryFailedUpload(uploadId);
  }, []);

  const clearCompleted = useCallback(async (): Promise<void> => {
    if (!uploadService.current) return;
    await uploadService.current.clearCompletedUploads();
  }, []);

  return {
    queue,
    isUploading,
    startUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
    activeUploadsCount: uploadService.current?.getActiveUploadsCount() || 0,
    failedUploads: uploadService.current?.getFailedUploads() || [],
    completedUploads: uploadService.current?.getCompletedUploads() || [],
  };
}; 