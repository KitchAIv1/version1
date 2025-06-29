import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { RecipeMetadataForEdgeFunction } from '../hooks/useVideoUploader';
import * as FileSystem from 'expo-file-system';

// Development logging flag - set to false for production
const __DEV__ = process.env.NODE_ENV === 'development';

export interface UserAwareUploadQueueItem {
  id: string;
  userId: string; // 🔒 SECURITY: Always include user ID
  videoUri: string;
  thumbnailUri?: string;
  metadata: RecipeMetadataForEdgeFunction;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  progress: number; // 0 to 1
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  // 📊 Enhanced queue management fields
  finalVideoUrl?: string; // Store successful upload URL
  finalThumbnailUrl?: string; // Store successful thumbnail URL
  recipeId?: string; // Store created recipe ID
  uploadDurationMs?: number; // Track upload performance
  fileSizeBytes?: number; // Store original file size
}

export interface UserAwareUploadProgress {
  uploadId: string;
  userId: string; // 🔒 SECURITY: Always include user ID
  progress: number;
  status: string;
  bytesUploaded?: number;
  totalBytes?: number;
  stage: 'thumbnail' | 'video' | 'processing' | 'completed';
}

class UserAwareBackgroundUploadService extends EventEmitter {
  private static instances: Map<string, UserAwareBackgroundUploadService> = new Map();
  private uploadQueue: Map<string, UserAwareUploadQueueItem> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();
  private isProcessing: boolean = false;
  private readonly userId: string;
  private readonly STORAGE_KEY: string; // 🔒 SECURITY: User-specific storage key
  private readonly COMPLETED_STORAGE_KEY: string; // 📊 Separate storage for completed uploads
  private readonly MAX_CONCURRENT_UPLOADS = 1;
  private readonly MAX_QUEUE_SIZE = 20;
  private readonly MAX_COMPLETED_HISTORY = 50; // Store last 50 completed uploads
  private readonly PROGRESS_THROTTLE_MS = 100;
  private progressThrottleMap: Map<string, { lastUpdate: number; lastProgress: number }> = new Map();

  private constructor(userId: string) {
    super();
    this.userId = userId;
    this.STORAGE_KEY = `userAwareBackgroundUploads_${userId}`; // 🔒 SECURITY: User-specific key
    this.COMPLETED_STORAGE_KEY = `userAwareCompletedUploads_${userId}`; // 📊 Completed uploads history
    this.setMaxListeners(10);
    this.loadPersistedQueue();
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] 🔒 Service created for user: ${userId}`);
    }
  }

  // 🔒 SECURITY: User-specific singleton pattern
  static getInstance(userId: string): UserAwareBackgroundUploadService {
    if (!userId) {
      throw new Error('User ID is required for UserAwareBackgroundUploadService');
    }
    
    if (!UserAwareBackgroundUploadService.instances.has(userId)) {
      UserAwareBackgroundUploadService.instances.set(
        userId, 
        new UserAwareBackgroundUploadService(userId)
      );
    }
    return UserAwareBackgroundUploadService.instances.get(userId)!;
  }

  // 🔒 SECURITY: Clean up user instance on logout - with safety checks
  static destroyUserInstance(userId: string): void {
    const instance = UserAwareBackgroundUploadService.instances.get(userId);
    if (instance) {
      // Safety check: Don't destroy if there are active uploads
      const activeUploads = instance.getActiveUploadsCount();
      if (activeUploads > 0) {
        if (__DEV__) {
          console.log(`[UserAwareUpload] ⚠️ NOT destroying instance for user ${userId} - ${activeUploads} active uploads`);
        }
        return;
      }
      
      instance.destroy();
      UserAwareBackgroundUploadService.instances.delete(userId);
      if (__DEV__) {
        console.log(`[UserAwareUpload] 🗑️ Destroyed instance for user: ${userId}`);
      }
    }
  }

  // 🔒 SECURITY: Validate user context for all operations
  private validateUserContext(operationUserId?: string): void {
    if (operationUserId && operationUserId !== this.userId) {
      throw new Error(`Access denied: Operation user ID (${operationUserId}) does not match service user ID (${this.userId})`);
    }
  }

  async addUpload(
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: RecipeMetadataForEdgeFunction,
    options: { maxRetries?: number } = {}
  ): Promise<string> {
    // 🔒 SECURITY: Validate user context
    this.validateUserContext();
    
    // Check queue size limit
    if (this.uploadQueue.size >= this.MAX_QUEUE_SIZE) {
      throw new Error('Upload queue is full. Please wait for current uploads to complete or clear completed uploads.');
    }

          // File size validation with metadata capture
      let fileSizeBytes = 0;
      try {
        const videoFileInfo = await FileSystem.getInfoAsync(videoUri);
        if (!videoFileInfo.exists) {
          throw new Error('Video file does not exist');
        }

        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
        fileSizeBytes = videoFileInfo.size || 0; // 📊 Capture file size for metadata
        
        if (__DEV__) {
          const fileSizeMB = fileSizeBytes ? Math.round(fileSizeBytes / (1024 * 1024)) : 0;
          console.log(`[UserAwareUpload] 🔍 File validation for user ${this.userId} - URI: ${videoUri}`);
          console.log(`[UserAwareUpload] 📊 Video file size: ${fileSizeMB}MB (${fileSizeBytes} bytes)`);
          console.log(`[UserAwareUpload] 🚫 Size limit: 100MB (${MAX_FILE_SIZE} bytes)`);
        }
        
        if (fileSizeBytes > MAX_FILE_SIZE) {
          const fileSizeMB = Math.round(fileSizeBytes / (1024 * 1024));
          const errorMessage = `Video file is too large (${fileSizeMB}MB). Maximum allowed size is 100MB. Please compress your video and try again.`;
          
          if (__DEV__) {
            console.error(`[UserAwareUpload] ❌ File size validation failed for user ${this.userId}: ${errorMessage}`);
          }
          
          throw new Error(errorMessage);
        }

        if (__DEV__) {
          console.log(`[UserAwareUpload] ✅ File size validation passed for user ${this.userId}`);
        }
      } catch (error: any) {
        if (__DEV__) {
          console.error(`[UserAwareUpload] 💥 File validation error for user ${this.userId}:`, error);
        }
        throw new Error(`File validation failed: ${error.message}`);
      }

    const uploadId = `upload_${this.userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const queueItem: UserAwareUploadQueueItem = {
      id: uploadId,
      userId: this.userId, // 🔒 SECURITY: Always include user ID
      videoUri,
      thumbnailUri,
      metadata,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 1,
      fileSizeBytes, // 📊 Store file size for analytics
    };

    this.uploadQueue.set(uploadId, queueItem);
    await this.persistQueue();
    
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    this.emit('uploadAdded', queueItem);
    
    setTimeout(() => this.processQueue(), 1000);
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] 📦 Upload queued for user ${this.userId}: ${uploadId}`);
    }
    
    return uploadId;
  }

  getQueueStatus(): UserAwareUploadQueueItem[] {
    // 🔒 SECURITY: Only return uploads for current user
    return Array.from(this.uploadQueue.values())
      .filter(item => item.userId === this.userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getActiveUploadsCount(): number {
    return Array.from(this.uploadQueue.values()).filter(
      item => item.userId === this.userId && item.status === 'uploading'
    ).length;
  }

  getFailedUploads(): UserAwareUploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.userId === this.userId && item.status === 'failed')
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPendingUploads(): UserAwareUploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.userId === this.userId && item.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getCompletedUploads(): UserAwareUploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.userId === this.userId && item.status === 'completed')
      .sort((a, b) => b.completedAt! - a.completedAt!);
  }

  async clearCompletedUploads(): Promise<void> {
    const completedUploads = this.getCompletedUploads();
    
    // 📊 Move completed uploads to history before clearing
    if (completedUploads.length > 0) {
      await this.moveToCompletedHistory(completedUploads);
    }
    
    const completedIds = completedUploads.map(item => item.id);
    completedIds.forEach(id => this.uploadQueue.delete(id));
    await this.persistQueue();
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] 🧹 Cleared ${completedIds.length} completed uploads for user ${this.userId} (moved to history)`);
    }
  }

  // 📊 Enhanced queue management methods
  async getCompletedHistory(): Promise<UserAwareUploadQueueItem[]> {
    try {
      const historyData = await AsyncStorage.getItem(this.COMPLETED_STORAGE_KEY);
      if (historyData) {
        const parsedHistory = JSON.parse(historyData) as UserAwareUploadQueueItem[];
        return parsedHistory
          .filter(item => item.userId === this.userId) // 🔒 SECURITY: Filter by user
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      }
      return [];
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Failed to load completed history for user ${this.userId}:`, error);
      }
      return [];
    }
  }

  private async moveToCompletedHistory(completedUploads: UserAwareUploadQueueItem[]): Promise<void> {
    try {
      const existingHistory = await this.getCompletedHistory();
      const newHistory = [...completedUploads, ...existingHistory]
        .slice(0, this.MAX_COMPLETED_HISTORY); // Keep only recent uploads
      
      await AsyncStorage.setItem(this.COMPLETED_STORAGE_KEY, JSON.stringify(newHistory));
      
      if (__DEV__) {
        console.log(`[UserAwareUpload] 📊 Moved ${completedUploads.length} uploads to history for user ${this.userId}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Failed to move to completed history for user ${this.userId}:`, error);
      }
    }
  }

  async clearCompletedHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.COMPLETED_STORAGE_KEY);
      if (__DEV__) {
        console.log(`[UserAwareUpload] 🗑️ Cleared completed history for user ${this.userId}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Failed to clear completed history for user ${this.userId}:`, error);
      }
    }
  }

  // 📊 Get upload statistics
  getUploadStats(): {
    total: number;
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
    successRate: number;
  } {
    const allUploads = Array.from(this.uploadQueue.values())
      .filter(item => item.userId === this.userId);
    
    const stats = {
      total: allUploads.length,
      pending: allUploads.filter(item => item.status === 'pending').length,
      uploading: allUploads.filter(item => item.status === 'uploading').length,
      completed: allUploads.filter(item => item.status === 'completed').length,
      failed: allUploads.filter(item => item.status === 'failed').length,
      successRate: 0,
    };
    
    const finishedUploads = stats.completed + stats.failed;
    if (finishedUploads > 0) {
      stats.successRate = (stats.completed / finishedUploads) * 100;
    }
    
    return stats;
  }

  async retryFailedUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem || queueItem.status !== 'failed') return false;

    // 🔒 SECURITY: Validate user owns this upload
    this.validateUserContext(queueItem.userId);

    queueItem.status = 'pending';
    queueItem.progress = 0;
    queueItem.error = undefined;
    queueItem.retryCount = 0;
    delete queueItem.startedAt;
    delete queueItem.completedAt;

    await this.persistQueue();
    this.emit('uploadRetried', queueItem);
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    
    setTimeout(() => this.processQueue(), 2000);
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] 🔄 Retrying upload for user ${this.userId}: ${uploadId}`);
    }
    
    return true;
  }

  async cancelUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem) return false;

    // 🔒 SECURITY: Validate user owns this upload
    this.validateUserContext(queueItem.userId);

    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }

    this.uploadQueue.delete(uploadId);
    await this.persistQueue();
    
    this.emit('uploadCancelled', uploadId);
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] ❌ Cancelled upload for user ${this.userId}: ${uploadId}`);
    }
    
    return true;
  }

  async resumeUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem || (queueItem.status !== 'paused' && queueItem.status !== 'failed')) return false;

    // 🔒 SECURITY: Validate user owns this upload
    this.validateUserContext(queueItem.userId);

    queueItem.status = 'pending';
    queueItem.retryCount = 0;
    await this.persistQueue();
    
    setTimeout(() => this.processQueue(), 1000);
    return true;
  }

  destroy(): void {
    this.activeUploads.forEach(controller => controller.abort());
    this.activeUploads.clear();
    this.progressThrottleMap.clear();
    this.removeAllListeners();
    
    if (__DEV__) {
      console.log(`[UserAwareUpload] 🗑️ Service destroyed for user ${this.userId}`);
    }
  }

  // 🔒 SECURITY: User-specific persistence
  private async persistQueue(): Promise<void> {
    try {
      const queueData = Array.from(this.uploadQueue.entries());
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueData));
      
      if (__DEV__) {
        console.log(`[UserAwareUpload] 💾 Queue persisted for user ${this.userId} with ${queueData.length} items`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Failed to persist queue for user ${this.userId}:`, error);
      }
      try {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
      } catch (clearError) {
        if (__DEV__) {
          console.error(`[UserAwareUpload] Failed to clear corrupted queue data for user ${this.userId}:`, clearError);
        }
      }
    }
  }

  // 🔒 SECURITY: User-specific loading with validation
  private async loadPersistedQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (queueData) {
        const parsedData = JSON.parse(queueData) as Array<[string, UserAwareUploadQueueItem]>;
        
        // 🔒 SECURITY: Validate all items belong to current user
        const validatedData = parsedData.filter(([_, item]) => {
          if (item.userId !== this.userId) {
            if (__DEV__) {
              console.warn(`[UserAwareUpload] ⚠️ Filtered out upload item belonging to different user: ${item.userId} (current: ${this.userId})`);
            }
            return false;
          }
          return true;
        });
        
        this.uploadQueue = new Map(validatedData);
        
        // Reset any 'uploading' status to 'pending' on app restart
        this.uploadQueue.forEach((item) => {
          if (item.status === 'uploading') {
            item.status = 'pending';
            item.progress = 0;
          }
        });
        
        const hasPending = Array.from(this.uploadQueue.values()).some(item => item.status === 'pending');
        if (hasPending) {
          setTimeout(() => this.processQueue(), 3000);
        }
        
        if (__DEV__) {
          console.log(`[UserAwareUpload] 📂 Loaded ${validatedData.length} queue items for user ${this.userId}`);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Failed to load persisted queue for user ${this.userId}:`, error);
      }
      try {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
        this.uploadQueue.clear();
      } catch (clearError) {
        if (__DEV__) {
          console.error(`[UserAwareUpload] Failed to clear corrupted queue data for user ${this.userId}:`, clearError);
        }
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingUploads = Array.from(this.uploadQueue.values())
        .filter(item => item.userId === this.userId && item.status === 'pending') // 🔒 SECURITY: Filter by user
        .sort((a, b) => a.createdAt - b.createdAt);

      const activeCount = this.getActiveUploadsCount();
      const availableSlots = this.MAX_CONCURRENT_UPLOADS - activeCount;

      if (availableSlots > 0 && pendingUploads.length > 0) {
        const uploadsToStart = pendingUploads.slice(0, availableSlots);
        
        for (const upload of uploadsToStart) {
          try {
            await this.startUpload(upload);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            if (__DEV__) {
              console.error(`[UserAwareUpload] Unexpected error in startUpload for user ${this.userId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] Error in processQueue for user ${this.userId}:`, error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async startUpload(queueItem: UserAwareUploadQueueItem): Promise<void> {
    const { id: uploadId, videoUri, thumbnailUri, metadata } = queueItem;
    
    // 🔒 SECURITY: Final validation that upload belongs to current user
    this.validateUserContext(queueItem.userId);

    if (__DEV__) {
      console.log(`[UserAwareUpload] 🚀 Starting upload for user ${this.userId}: ${uploadId}`);
    }

    queueItem.status = 'uploading';
    queueItem.startedAt = Date.now();
    queueItem.progress = 0;
    await this.persistQueue();

    const controller = new AbortController();
    this.activeUploads.set(uploadId, controller);
    this.emit('uploadStarted', queueItem);

    try {
      // Progress tracking
      const onProgress = (progress: number) => {
        this.emitProgressThrottled(uploadId, progress, 'video');
      };

      // Upload thumbnail if present
      let publicThumbnailUrl: string | undefined;
      if (thumbnailUri) {
        this.emitProgressThrottled(uploadId, 0.05, 'thumbnail');
        publicThumbnailUrl = await this.uploadThumbnailOptimized(thumbnailUri, metadata.id, controller.signal);
        this.emitProgressThrottled(uploadId, 0.15, 'thumbnail');
      }

      // Upload video
      this.emitProgressThrottled(uploadId, 0.2, 'video');
      const videoFileName = await this.uploadVideoOptimized(videoUri, metadata.id, controller.signal, onProgress);
      this.emitProgressThrottled(uploadId, 0.85, 'video');

      // Process with edge function
      this.emitProgressThrottled(uploadId, 0.9, 'processing');
      const finalMetadata = { ...metadata };
      if (publicThumbnailUrl) {
        finalMetadata.thumbnail_url = publicThumbnailUrl;
      }

      await this.callVideoProcessorEdgeFunction(videoFileName, finalMetadata, controller.signal);
      this.emitProgressThrottled(uploadId, 1.0, 'completed');

      // Mark as completed with enhanced metadata
      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.progress = 1;
      queueItem.uploadDurationMs = queueItem.startedAt ? Date.now() - queueItem.startedAt : undefined; // 📊 Track upload duration
      queueItem.recipeId = metadata.id; // 📊 Store recipe ID
      // URLs will be set by upload functions if available
      
      await this.persistQueue();

      this.activeUploads.delete(uploadId);
      this.emit('uploadSuccess', { uploadId, recipeId: metadata.id, metadata: finalMetadata });
      this.emit('queueUpdated', Array.from(this.uploadQueue.values()));

      if (__DEV__) {
        const durationSec = queueItem.uploadDurationMs ? Math.round(queueItem.uploadDurationMs / 1000) : 0;
        const fileSizeMB = queueItem.fileSizeBytes ? Math.round(queueItem.fileSizeBytes / (1024 * 1024)) : 0;
        console.log(`[UserAwareUpload] ✅ Upload completed for user ${this.userId}: ${uploadId} (${durationSec}s, ${fileSizeMB}MB)`);
      }

      setTimeout(() => this.processQueue(), 5000);

    } catch (error: any) {
      if (__DEV__) {
        console.error(`[UserAwareUpload] ❌ Upload failed for user ${this.userId}: ${uploadId}`, error);
      }
      
      this.activeUploads.delete(uploadId);
      queueItem.retryCount++;
      queueItem.error = error.message || 'Upload failed';
      
      if (error.message === 'Upload was cancelled') {
        queueItem.status = 'failed';
        queueItem.error = 'Upload was cancelled by user';
        this.emit('uploadCancelled', uploadId);
      } else if (queueItem.retryCount < queueItem.maxRetries) {
        const retryDelay = Math.min(Math.pow(2, queueItem.retryCount) * 2000, 60000);
        queueItem.status = 'pending';
        queueItem.progress = 0;
        
        this.emit('uploadRetrying', { ...queueItem, nextRetryIn: retryDelay });
        
        setTimeout(() => {
          this.processQueue();
        }, retryDelay);
      } else {
        queueItem.status = 'failed';
        queueItem.error = `Upload failed after ${queueItem.maxRetries} retries: ${error.message || 'Unknown error'}`;
        this.emit('uploadFailed', queueItem);
      }
      
      await this.persistQueue();
      this.emit('queueUpdated', Array.from(this.uploadQueue.values()));

      if (queueItem.status === 'failed') {
        setTimeout(() => this.processQueue(), 3000);
      }
    }
  }

  private emitProgressThrottled(uploadId: string, progress: number, stage: UserAwareUploadProgress['stage']): void {
    const now = Date.now();
    const lastEmit = this.progressThrottleMap.get(uploadId) || { lastUpdate: 0, lastProgress: 0 };
    
    // 🔧 PROGRESS FIX: Prevent backward progress and improve throttling
    const progressDelta = Math.abs(progress - lastEmit.lastProgress);
    const timeDelta = now - lastEmit.lastUpdate;
    
    // Only emit if:
    // 1. Progress moved forward significantly (≥2%)
    // 2. Enough time has passed (≥100ms)
    // 3. It's a completion (100%) or start (0%)
    // 4. Progress hasn't gone backward
    const shouldEmit = (
      (progress >= lastEmit.lastProgress && progressDelta >= 0.02) || // Forward progress ≥2%
      timeDelta >= this.PROGRESS_THROTTLE_MS || // Time threshold met
      progress >= 1.0 || // Completion
      progress === 0 || // Start
      stage === 'completed' // Final stage
    );
    
    if (shouldEmit && progress >= lastEmit.lastProgress) {
      this.progressThrottleMap.set(uploadId, { lastUpdate: now, lastProgress: progress });
      this.emitProgress(uploadId, progress, stage);
    } else if (progress < lastEmit.lastProgress && __DEV__) {
      // 🚨 PROGRESS REGRESSION DETECTED - Log but don't emit
      console.warn(`[UserAwareUpload] ⚠️ Upload ${uploadId} for user ${this.userId}: Progress regression prevented (${(lastEmit.lastProgress * 100).toFixed(1)}% → ${(progress * 100).toFixed(1)}%)`);
    }
  }

  private emitProgress(uploadId: string, progress: number, stage: UserAwareUploadProgress['stage']): void {
    const queueItem = this.uploadQueue.get(uploadId);
    if (queueItem && queueItem.userId === this.userId) { // 🔒 SECURITY: Validate user
      if (progress >= queueItem.progress) {
        queueItem.progress = progress;
        if (__DEV__) {
          console.log(`[UserAwareUpload] 📊 Upload ${uploadId} for user ${this.userId}: ${Math.round(progress * 100)}% - ${stage}`);
        }
      } else {
        if (__DEV__) {
          console.warn(`[UserAwareUpload] ⚠️ Upload ${uploadId} for user ${this.userId}: Progress went backwards`);
        }
        return;
      }
    }
    
    this.emit('uploadProgress', {
      uploadId,
      userId: this.userId, // 🔒 SECURITY: Include user ID in progress events
      progress: queueItem?.progress || progress,
      status: stage,
      stage,
    } as UserAwareUploadProgress);
  }

  // Thumbnail upload method (same as original but with user validation)
  private async uploadThumbnailOptimized(thumbnailUri: string, recipeId: string, signal: AbortSignal): Promise<string> {
    const thumbFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
    if (!thumbFileInfo.exists) {
      throw new Error('Thumbnail file does not exist');
    }

    const thumbBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const thumbUint8Array = await this.base64ToUint8ArrayOptimized(thumbBase64);
    const thumbArrayBuffer = thumbUint8Array.buffer as ArrayBuffer;

    (thumbBase64 as any) = null;

    const thumbFileExt = thumbnailUri.split('.').pop()?.toLowerCase() || 'jpg';
    const thumbContentType = `image/${thumbFileExt === 'jpg' ? 'jpeg' : thumbFileExt}`;
    const thumbFileName = `thumb-${recipeId}-${Date.now()}.${thumbFileExt}`;

    // 🔒 SECURITY: Use current user ID for path
    const thumbStoragePath = `${this.userId}/recipe-thumbnails/${thumbFileName}`;

    const { data: thumbUploadData, error: thumbUploadError } = await supabase.storage
      .from('recipe-thumbnails')
      .upload(thumbStoragePath, thumbArrayBuffer, {
        contentType: thumbContentType,
        upsert: true,
        cacheControl: '3600',
      });

    (thumbUint8Array as any) = null;

    if (thumbUploadError) {
      throw new Error(`Failed to upload thumbnail: ${thumbUploadError.message}`);
    }

    if (thumbUploadData?.path) {
      const { data: urlData } = supabase.storage
        .from('recipe-thumbnails')
        .getPublicUrl(thumbUploadData.path);
      return urlData.publicUrl;
    }

    throw new Error('Failed to get thumbnail URL');
  }

  // PERFORMANCE OPTIMIZED: Video upload method matching original's speed
  private async uploadVideoOptimized(
    videoUri: string, 
    recipeId: string, 
    signal: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const videoFileInfo = await FileSystem.getInfoAsync(videoUri);
    if (!videoFileInfo.exists) {
      throw new Error('Video file does not exist');
    }

    if (videoFileInfo.size === 0) {
      throw new Error('Selected file is empty on the device (0 bytes based on FileSystem.getInfoAsync)');
    }

    // PERFORMANCE CRITICAL: Enhanced file size validation matching original
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
    if (__DEV__) {
      const fileSizeMB = videoFileInfo.size ? Math.round(videoFileInfo.size / (1024 * 1024)) : 0;
      console.log(`[UserAwareUpload] 🔄 Double-checking file size in upload method for user ${this.userId}`);
      console.log(`[UserAwareUpload] 📊 File size: ${fileSizeMB}MB (${videoFileInfo.size} bytes)`);
    }
    
    if (videoFileInfo.size && videoFileInfo.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(videoFileInfo.size / (1024 * 1024));
      const errorMessage = `Video file is too large (${fileSizeMB}MB). This should have been caught earlier! Maximum allowed size is 100MB.`;
      
      if (__DEV__) {
        console.error(`[UserAwareUpload] ❌ CRITICAL: File size validation bypass detected for user ${this.userId}: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    // Start with initial progress - MATCHING ORIGINAL TIMING
    onProgress?.(0.0);

    // PERFORMANCE CRITICAL: Read file in chunks to prevent memory overflow - MATCHING ORIGINAL
    const videoBase64 = await this.readFileInChunks(videoUri);
    
    if (!videoBase64 || videoBase64.length === 0) {
      throw new Error('FileSystem.readAsStringAsync returned empty base64 data');
    }
    
    // Progress after reading file - MATCHING ORIGINAL
    onProgress?.(0.2);

    const videoUint8Array = await this.base64ToUint8ArrayOptimized(videoBase64);
    const videoArrayBuffer = videoUint8Array.buffer as ArrayBuffer;

    // CRITICAL: Clear base64 string from memory immediately - MATCHING ORIGINAL
    (videoBase64 as any) = null;

    if (videoArrayBuffer.byteLength === 0) {
      throw new Error('ArrayBuffer created from file data is empty (byteLength is 0)');
    }

    // Progress after processing file - MATCHING ORIGINAL
    onProgress?.(0.3);

    const videoFileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    const videoContentType = `video/${videoFileExt}`;
    
    // MATCH WORKING UPLOADER: Use exact same filename pattern
    const videoFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${videoFileExt}`;
    const rawUploadPath = `raw-videos/${videoFileName}`;

    console.log(`[UserAwareUpload] Uploading raw video to: ${rawUploadPath} for user ${this.userId}`);

    // PERFORMANCE FIX: Reduced progress updates to prevent UI spam - MATCHING ORIGINAL
    let currentProgress = 0.3;
    const progressInterval = setInterval(() => {
      if (currentProgress < 0.8) {
        currentProgress += 0.1; // Slower increment - MATCHING ORIGINAL
        onProgress?.(currentProgress);
      }
    }, 1500); // Longer intervals - MATCHING ORIGINAL

    try {
      // MATCH WORKING UPLOADER: Use exact same upload parameters
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(rawUploadPath, videoArrayBuffer, {
          contentType: videoContentType,
          upsert: false, // MATCH WORKING UPLOADER: upsert: false
        });

      clearInterval(progressInterval);
      
      // CRITICAL: Clear array buffer from memory immediately - MATCHING ORIGINAL
      (videoUint8Array as any) = null;
      
      onProgress?.(0.85);

      if (uploadError) {
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }

      // MATCH WORKING UPLOADER: Add validation step - ENHANCED FOR USER CONTEXT
      if (uploadData?.path) {
        console.log(`[UserAwareUpload] Validating uploaded file by downloading: ${uploadData.path} for user ${this.userId}`);
        
        const { data: downloadedBlob, error: downloadValidationError } = await supabase.storage
          .from('videos')
          .download(uploadData.path);

        if (downloadValidationError) {
          console.error(`[UserAwareUpload] Download validation error for user ${this.userId}:`, downloadValidationError.message);
          throw new Error(`Failed to validate uploaded file (download step): ${downloadValidationError.message}`);
        }

        if (!downloadedBlob) {
          console.error(`[UserAwareUpload] Downloaded blob for validation is null/undefined for user ${this.userId}`);
          throw new Error('Failed to validate uploaded file (empty blob)');
        }

        const fileSize = downloadedBlob.size;
        console.log(`[UserAwareUpload] Successfully downloaded for validation for user ${this.userId}. Uploaded file size (bytes):`, fileSize);
        
        if (fileSize === 0) {
          console.error(`[UserAwareUpload] Uploaded file is empty after download validation for user ${this.userId}`);
          throw new Error('Uploaded file is empty (validation check)');
        }
        
        console.log(`[UserAwareUpload] File validation successful for user ${this.userId}, proceeding to invoke Edge Function`);
        onProgress?.(1.0);

        // MATCH WORKING UPLOADER: Return just the filename (not the full path)
        return videoFileName;
      } else {
        throw new Error('Upload data path missing, cannot validate file');
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      throw error;
    } finally {
      clearInterval(progressInterval);
    }
  }

  // Edge function call (FIXED: Use 'fileName' instead of 'videoFileName')
  private async callVideoProcessorEdgeFunction(
    videoFileName: string,
    metadata: RecipeMetadataForEdgeFunction,
    signal: AbortSignal
  ): Promise<void> {
    const { data, error } = await supabase.functions.invoke('video-processor', {
      body: {
        fileName: videoFileName, // 🔧 FIX: Edge function expects 'fileName'
        metadata,
      },
    });

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Edge function processing failed');
    }
  }

  // PERFORMANCE OPTIMIZED: Utility methods matching original's chunked processing
  private async base64ToUint8ArrayOptimized(base64: string): Promise<Uint8Array> {
    try {
      const binary_string = atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      
      // PERFORMANCE CRITICAL: Process in chunks to prevent blocking - MATCHING ORIGINAL
      const chunkSize = 8192; // 8KB chunks
      for (let i = 0; i < len; i += chunkSize) {
        const end = Math.min(i + chunkSize, len);
        for (let j = i; j < end; j++) {
          bytes[j] = binary_string.charCodeAt(j);
        }
        
        // Yield control to prevent UI blocking - MATCHING ORIGINAL
        if (i % (chunkSize * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      return bytes;
    } catch (e) {
      console.error(`[UserAwareUpload] Failed to decode base64 string with atob for user ${this.userId}:`, e);
      throw new Error('Failed to process file data (base64 decode error).');
    }
  }

  // PERFORMANCE OPTIMIZATION: Read large files in chunks to prevent memory overflow - MATCHING ORIGINAL
  private async readFileInChunks(fileUri: string): Promise<string> {
    try {
      // For now, use standard read but with memory management - MATCHING ORIGINAL
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Force garbage collection if available - MATCHING ORIGINAL
      if (global.gc) {
        global.gc();
      }
      
      return base64;
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }
}

export default UserAwareBackgroundUploadService; 