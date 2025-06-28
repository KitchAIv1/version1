import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import BackgroundUploadService, { UploadQueueItem, UploadProgress } from '../services/BackgroundUploadService';
import { RecipeMetadataForEdgeFunction } from './useVideoUploader';
import { useAuth } from '../providers/AuthProvider';

interface UseBackgroundUploadOptions {
  onUploadSuccess?: (uploadId: string, recipeId: string) => void;
  onUploadError?: (uploadId: string, error: string) => void;
  onUploadProgress?: (uploadId: string, progress: UploadProgress) => void;
}

interface UseBackgroundUploadReturn {
  // Queue management
  uploads: UploadQueueItem[];
  activeUploadsCount: number;
  hasActiveUploads: boolean;
  
  // Upload control
  startBackgroundUpload: (
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: RecipeMetadataForEdgeFunction
  ) => Promise<string>;
  cancelUpload: (uploadId: string) => Promise<boolean>;
  retryUpload: (uploadId: string) => Promise<boolean>;
  clearCompleted: () => Promise<void>;
  
  // Status
  isUploading: boolean;
  currentUploadProgress: UploadProgress | null;
}

export const useBackgroundUpload = (options: UseBackgroundUploadOptions = {}): UseBackgroundUploadReturn => {
  const [uploads, setUploads] = useState<UploadQueueItem[]>([]);
  const [currentUploadProgress, setCurrentUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadService = useRef(BackgroundUploadService.getInstance()).current;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Store the latest callbacks in refs to avoid dependency issues
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Subscribe to upload service events
  useEffect(() => {
    const handleQueueUpdate = (queueItems: UploadQueueItem[]) => {
      setUploads(queueItems);
      setIsUploading(queueItems.some(item => item.status === 'uploading'));
    };

    const handleUploadProgress = (progress: UploadProgress) => {
      setCurrentUploadProgress(progress);
      callbacksRef.current.onUploadProgress?.(progress.uploadId, progress);
    };

    const handleUploadSuccess = (data: { uploadId: string; recipeId: string; metadata: RecipeMetadataForEdgeFunction }) => {
      console.log('🎉 Background upload completed successfully:', data.recipeId);
      
      // Invalidate queries to refresh UI
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ['userRecipesForPlanner', user.id],
        });
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        queryClient.invalidateQueries({ queryKey: ['feed'] });
      }
      
      callbacksRef.current.onUploadSuccess?.(data.uploadId, data.recipeId);
    };

    const handleUploadFailed = (queueItem: UploadQueueItem) => {
      console.error('❌ Background upload failed:', queueItem.error);
      callbacksRef.current.onUploadError?.(queueItem.id, queueItem.error || 'Upload failed');
    };

    const handleUploadRetrying = (queueItem: UploadQueueItem & { nextRetryIn: number }) => {
      console.log(`🔄 Retrying upload ${queueItem.id} in ${queueItem.nextRetryIn / 1000}s (attempt ${queueItem.retryCount})`);
    };

    // Subscribe to events
    uploadService.on('queueUpdated', handleQueueUpdate);
    uploadService.on('uploadProgress', handleUploadProgress);
    uploadService.on('uploadSuccess', handleUploadSuccess);
    uploadService.on('uploadFailed', handleUploadFailed);
    uploadService.on('uploadRetrying', handleUploadRetrying);

    // Initial load
    handleQueueUpdate(uploadService.getQueueStatus());

    return () => {
      uploadService.off('queueUpdated', handleQueueUpdate);
      uploadService.off('uploadProgress', handleUploadProgress);
      uploadService.off('uploadSuccess', handleUploadSuccess);
      uploadService.off('uploadFailed', handleUploadFailed);
      uploadService.off('uploadRetrying', handleUploadRetrying);
    };
  }, [uploadService, queryClient, user?.id]); // Removed options from dependencies

  // Upload control functions
  const startBackgroundUpload = useCallback(async (
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: RecipeMetadataForEdgeFunction
  ): Promise<string> => {
    console.log('🚀 Starting background upload for:', metadata.title);
    
    const uploadId = await uploadService.addUpload(videoUri, thumbnailUri, metadata);
    
    console.log('📦 Upload queued with ID:', uploadId);
    return uploadId;
  }, [uploadService]);

  const cancelUpload = useCallback(async (uploadId: string): Promise<boolean> => {
    console.log('❌ Cancelling upload:', uploadId);
    return await uploadService.cancelUpload(uploadId);
  }, [uploadService]);

  const retryUpload = useCallback(async (uploadId: string): Promise<boolean> => {
    console.log('🔄 Retrying upload:', uploadId);
    return await uploadService.resumeUpload(uploadId);
  }, [uploadService]);

  const clearCompleted = useCallback(async (): Promise<void> => {
    console.log('🧹 Clearing completed uploads');
    // Implementation would be added to BackgroundUploadService
    // await uploadService.clearCompleted();
  }, [uploadService]);

  // Computed values
  const activeUploadsCount = uploads.filter(upload => 
    upload.status === 'uploading' || upload.status === 'pending'
  ).length;

  const hasActiveUploads = activeUploadsCount > 0;

  return {
    // Queue state
    uploads,
    activeUploadsCount,
    hasActiveUploads,
    
    // Upload control
    startBackgroundUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
    
    // Status
    isUploading,
    currentUploadProgress,
  };
}; 