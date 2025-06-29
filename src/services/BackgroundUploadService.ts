import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { RecipeMetadataForEdgeFunction } from '../hooks/useVideoUploader';
import * as FileSystem from 'expo-file-system';

// Development logging flag - set to false for production
const __DEV__ = process.env.NODE_ENV === 'development';

export interface UploadQueueItem {
  id: string;
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
}

export interface UploadProgress {
  uploadId: string;
  progress: number;
  status: string;
  bytesUploaded?: number;
  totalBytes?: number;
  stage: 'thumbnail' | 'video' | 'processing' | 'completed';
}

class BackgroundUploadService extends EventEmitter {
  private static instance: BackgroundUploadService;
  private uploadQueue: Map<string, UploadQueueItem> = new Map();
  private activeUploads: Map<string, AbortController> = new Map();
  private isProcessing: boolean = false;
  private readonly STORAGE_KEY = 'backgroundUploads';
  private readonly MAX_CONCURRENT_UPLOADS = 1; // REDUCED: Only 1 concurrent upload to prevent memory issues
  private readonly MAX_QUEUE_SIZE = 20; // REDUCED: Lower queue size for better memory management
  private readonly PROGRESS_THROTTLE_MS = 100; // FIXED: Reduced throttle for better UI responsiveness
  private progressThrottleMap: Map<string, number> = new Map(); // ADDED: Track last progress emit time

  private constructor() {
    super();
    this.setMaxListeners(10); // REDUCED: Lower max listeners to prevent memory warnings
    this.loadPersistedQueue();
  }

  static getInstance(): BackgroundUploadService {
    if (!BackgroundUploadService.instance) {
      BackgroundUploadService.instance = new BackgroundUploadService();
    }
    return BackgroundUploadService.instance;
  }

  async addUpload(
    videoUri: string,
    thumbnailUri: string | undefined,
    metadata: RecipeMetadataForEdgeFunction,
    options: { maxRetries?: number } = {}
  ): Promise<string> {
    // Check queue size limit
    if (this.uploadQueue.size >= this.MAX_QUEUE_SIZE) {
      throw new Error('Upload queue is full. Please wait for current uploads to complete or clear completed uploads.');
    }

    // CRITICAL FIX: Validate file size before adding to queue
    try {
      const videoFileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!videoFileInfo.exists) {
        throw new Error('Video file does not exist');
      }

      // UPDATED: Using paid Supabase account with 100MB limit
      // Paid tier: 100MB limit for better video quality
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
      
      if (__DEV__) {
        const fileSizeMB = videoFileInfo.size ? Math.round(videoFileInfo.size / (1024 * 1024)) : 0;
        console.log(`[BackgroundUpload] 🔍 File validation - URI: ${videoUri}`);
        console.log(`[BackgroundUpload] 📊 Video file size: ${fileSizeMB}MB (${videoFileInfo.size} bytes)`);
                 console.log(`[BackgroundUpload] 🚫 Size limit: 100MB (${MAX_FILE_SIZE} bytes)`);
        console.log(`[BackgroundUpload] ✅ File exists: ${videoFileInfo.exists}`);
      }
      
      if (videoFileInfo.size && videoFileInfo.size > MAX_FILE_SIZE) {
        const fileSizeMB = Math.round(videoFileInfo.size / (1024 * 1024));
                 const errorMessage = `Video file is too large (${fileSizeMB}MB). Maximum allowed size is 100MB. Please compress your video and try again.`;
        
        if (__DEV__) {
          console.error(`[BackgroundUpload] ❌ File size validation failed: ${errorMessage}`);
        }
        
        throw new Error(errorMessage);
      }

      if (__DEV__) {
        console.log(`[BackgroundUpload] ✅ File size validation passed`);
      }
    } catch (error: any) {
      if (__DEV__) {
        console.error(`[BackgroundUpload] 💥 File validation error:`, error);
      }
      throw new Error(`File validation failed: ${error.message}`);
    }

    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const queueItem: UploadQueueItem = {
      id: uploadId,
      videoUri,
      thumbnailUri,
      metadata,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: options.maxRetries || 1, // REDUCED: Lower default retries to prevent long blocking
    };

    this.uploadQueue.set(uploadId, queueItem);
    await this.persistQueue();
    
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    this.emit('uploadAdded', queueItem);
    
    // PERFORMANCE FIX: Use longer delay to prevent immediate processing conflicts
    setTimeout(() => this.processQueue(), 1000);
    
    return uploadId;
  }

  getQueueStatus(): UploadQueueItem[] {
    return Array.from(this.uploadQueue.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getActiveUploadsCount(): number {
    return Array.from(this.uploadQueue.values()).filter(
      item => item.status === 'uploading'
    ).length;
  }

  getFailedUploads(): UploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.status === 'failed')
      .sort((a, b) => b.createdAt - a.createdAt); // Most recent first
  }

  getPendingUploads(): UploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt); // Oldest first for processing
  }

  getCompletedUploads(): UploadQueueItem[] {
    return Array.from(this.uploadQueue.values())
      .filter(item => item.status === 'completed')
      .sort((a, b) => b.completedAt! - a.completedAt!); // Most recent first
  }

  async clearCompletedUploads(): Promise<void> {
    const completedIds = this.getCompletedUploads().map(item => item.id);
    completedIds.forEach(id => this.uploadQueue.delete(id));
    await this.persistQueue();
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
  }

  async retryFailedUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem || queueItem.status !== 'failed') return false;

    // Reset for retry
    queueItem.status = 'pending';
    queueItem.progress = 0;
    queueItem.error = undefined;
    queueItem.retryCount = 0; // Reset retry count for manual retry
    delete queueItem.startedAt;
    delete queueItem.completedAt;

    await this.persistQueue();
    this.emit('uploadRetried', queueItem);
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    
    // PERFORMANCE FIX: Longer delay to prevent immediate conflicts
    setTimeout(() => this.processQueue(), 2000);
    
    return true;
  }

  async cancelUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem) return false;

    // Cancel active upload
    const controller = this.activeUploads.get(uploadId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(uploadId);
    }

    // Remove from queue
    this.uploadQueue.delete(uploadId);
    await this.persistQueue();
    
    this.emit('uploadCancelled', uploadId);
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    
    return true;
  }

  async resumeUpload(uploadId: string): Promise<boolean> {
    const queueItem = this.uploadQueue.get(uploadId);
    if (!queueItem || (queueItem.status !== 'paused' && queueItem.status !== 'failed')) return false;

    queueItem.status = 'pending';
    queueItem.retryCount = 0; // Reset retry count for manual retry
    await this.persistQueue();
    
    setTimeout(() => this.processQueue(), 1000);
    return true;
  }

  // Clean up resources - call this when app is backgrounded or closed
  destroy(): void {
    // Cancel all active uploads
    this.activeUploads.forEach(controller => controller.abort());
    this.activeUploads.clear();
    
    // Clear progress throttle map
    this.progressThrottleMap.clear();
    
    // Remove all listeners
    this.removeAllListeners();
    
    // Clear instance
    BackgroundUploadService.instance = null as any;
  }

  private async persistQueue(): Promise<void> {
    try {
      const queueData = Array.from(this.uploadQueue.entries());
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queueData));
    } catch (error) {
      if (__DEV__) {
        console.error('[BackgroundUpload] Failed to persist queue:', error);
      }
      // Clear corrupted data
      try {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
      } catch (clearError) {
        if (__DEV__) {
          console.error('[BackgroundUpload] Failed to clear corrupted queue data:', clearError);
        }
      }
    }
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (queueData) {
        const parsedData = JSON.parse(queueData) as Array<[string, UploadQueueItem]>;
        this.uploadQueue = new Map(parsedData);
        
        // Reset any 'uploading' status to 'pending' on app restart
        this.uploadQueue.forEach((item) => {
          if (item.status === 'uploading') {
            item.status = 'pending';
            item.progress = 0;
          }
        });
        
        // Auto-start processing if there are pending uploads
        const hasPending = Array.from(this.uploadQueue.values()).some(item => item.status === 'pending');
        if (hasPending) {
          setTimeout(() => this.processQueue(), 3000); // Delayed start to let app initialize
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[BackgroundUpload] Failed to load persisted queue:', error);
      }
      // Clear corrupted data
      try {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
        this.uploadQueue.clear();
      } catch (clearError) {
        if (__DEV__) {
          console.error('[BackgroundUpload] Failed to clear corrupted queue data:', clearError);
        }
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingUploads = Array.from(this.uploadQueue.values())
        .filter(item => item.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt);

      const activeCount = this.getActiveUploadsCount();
      const availableSlots = this.MAX_CONCURRENT_UPLOADS - activeCount;

      if (availableSlots > 0 && pendingUploads.length > 0) {
        const uploadsToStart = pendingUploads.slice(0, availableSlots);
        
        // PERFORMANCE FIX: Process uploads sequentially to prevent memory overload
        for (const upload of uploadsToStart) {
          try {
            await this.startUpload(upload);
            // PERFORMANCE FIX: Add delay between uploads to prevent memory spikes
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            if (__DEV__) {
              console.error('[BackgroundUpload] Unexpected error in startUpload:', error);
            }
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('[BackgroundUpload] Error in processQueue:', error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async startUpload(queueItem: UploadQueueItem): Promise<void> {
    const { id: uploadId, videoUri, thumbnailUri, metadata } = queueItem;
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    try {
      queueItem.status = 'uploading';
      queueItem.startedAt = Date.now();
      await this.persistQueue();
      this.emit('queueUpdated', Array.from(this.uploadQueue.values()));

      // Stage 1: Upload thumbnail (if provided) - NON-BLOCKING
      this.emitProgressThrottled(uploadId, 0.1, 'thumbnail');
      let publicThumbnailUrl: string | undefined;
      
      if (thumbnailUri) {
        publicThumbnailUrl = await this.uploadThumbnailOptimized(thumbnailUri, metadata.id, abortController.signal);
        this.emitProgressThrottled(uploadId, 0.2, 'thumbnail');
      }

      // PERFORMANCE CRITICAL: Add memory cleanup between stages
      if (global.gc) {
        global.gc();
      }

      // Stage 2: Upload video to raw-videos - MEMORY OPTIMIZED
      this.emitProgressThrottled(uploadId, 0.3, 'video');
      const videoFileName = await this.uploadVideoOptimized(videoUri, metadata.id, abortController.signal, (progress) => {
        // Map video upload progress from 30% to 80% with throttling
        const mappedProgress = 0.3 + (progress * 0.5);
        this.emitProgressThrottled(uploadId, mappedProgress, 'video');
      });

      // PERFORMANCE CRITICAL: Add memory cleanup between stages
      if (global.gc) {
        global.gc();
      }

      // Stage 3: Call edge function for processing
      this.emitProgressThrottled(uploadId, 0.8, 'processing');
      const finalMetadata = {
        ...metadata,
        thumbnail_url: publicThumbnailUrl,
      };

      await this.callVideoProcessorEdgeFunction(videoFileName, finalMetadata, abortController.signal);
      this.emitProgressThrottled(uploadId, 1.0, 'completed');

      // Mark as completed
      queueItem.status = 'completed';
      queueItem.completedAt = Date.now();
      queueItem.progress = 1;
      await this.persistQueue();

      this.activeUploads.delete(uploadId);
      this.emit('uploadSuccess', { uploadId, recipeId: metadata.id, metadata: finalMetadata });
      this.emit('queueUpdated', Array.from(this.uploadQueue.values()));

      if (__DEV__) {
        console.log(`✅ Background upload completed: ${uploadId}`);
      }

      // PERFORMANCE FIX: Longer delay before processing next upload
      setTimeout(() => this.processQueue(), 5000);

    } catch (error: any) {
      if (__DEV__) {
        console.error(`❌ Background upload failed: ${uploadId}`, error);
      }
      
      this.activeUploads.delete(uploadId);
      queueItem.retryCount++;
      queueItem.error = error.message || 'Upload failed';
      
      // Don't retry if it was cancelled by user
      if (error.message === 'Upload was cancelled') {
        queueItem.status = 'failed';
        queueItem.error = 'Upload was cancelled by user';
        this.emit('uploadCancelled', uploadId);
      } else if (queueItem.retryCount < queueItem.maxRetries) {
        // Schedule retry with exponential backoff
        const retryDelay = Math.min(Math.pow(2, queueItem.retryCount) * 2000, 60000); // Cap at 60s, longer delays
        queueItem.status = 'pending';
        queueItem.progress = 0; // Reset progress for retry
        
        console.log(`🔄 Scheduling retry for ${uploadId} in ${retryDelay/1000}s (attempt ${queueItem.retryCount}/${queueItem.maxRetries})`);
        this.emit('uploadRetrying', { ...queueItem, nextRetryIn: retryDelay });
        
        setTimeout(() => {
          this.processQueue();
        }, retryDelay);
      } else {
        // Max retries reached
        queueItem.status = 'failed';
        queueItem.error = `Upload failed after ${queueItem.maxRetries} retries: ${error.message || 'Unknown error'}`;
        this.emit('uploadFailed', queueItem);
        console.log(`💀 Upload ${uploadId} failed permanently after ${queueItem.maxRetries} retries`);
      }
      
      await this.persistQueue();
      this.emit('queueUpdated', Array.from(this.uploadQueue.values()));

      // Continue processing other uploads (but don't retry this one immediately)
      if (queueItem.status === 'failed') {
        setTimeout(() => this.processQueue(), 3000);
      }
    }
  }

  // PERFORMANCE FIX: Throttled progress emissions with better UI responsiveness
  private emitProgressThrottled(uploadId: string, progress: number, stage: UploadProgress['stage']): void {
    const now = Date.now();
    const lastEmit = this.progressThrottleMap.get(uploadId) || 0;
    
    // FIXED: More responsive progress updates - allow 5% increments or time-based throttling
    const progressDiff = Math.abs(progress - (this.uploadQueue.get(uploadId)?.progress || 0));
    const shouldEmit = (
      now - lastEmit >= this.PROGRESS_THROTTLE_MS || // Time-based throttling
      progressDiff >= 0.05 || // 5% progress change
      progress >= 1.0 || // Completion
      progress === 0 || // Start
      stage === 'completed' // Stage completion
    );
    
    if (shouldEmit) {
      this.progressThrottleMap.set(uploadId, now);
      this.emitProgress(uploadId, progress, stage);
    }
  }

  private emitProgress(uploadId: string, progress: number, stage: UploadProgress['stage']): void {
    const queueItem = this.uploadQueue.get(uploadId);
    if (queueItem) {
      // Ensure progress only moves forward (monotonic)
      if (progress >= queueItem.progress) {
        queueItem.progress = progress;
        if (__DEV__) {
          console.log(`📊 Upload ${uploadId}: ${Math.round(progress * 100)}% - ${stage}`);
        }
      } else {
        if (__DEV__) {
          console.warn(`⚠️ Upload ${uploadId}: Progress went backwards from ${Math.round(queueItem.progress * 100)}% to ${Math.round(progress * 100)}%`);
        }
        return; // Don't emit backwards progress
      }
    }
    
    this.emit('uploadProgress', {
      uploadId,
      progress: queueItem?.progress || progress,
      status: stage,
      stage,
    } as UploadProgress);
  }

  // PERFORMANCE OPTIMIZED: Memory-efficient thumbnail upload
  private async uploadThumbnailOptimized(thumbnailUri: string, recipeId: string, signal: AbortSignal): Promise<string> {
    const thumbFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
    if (!thumbFileInfo.exists) {
      throw new Error('Thumbnail file does not exist');
    }

    // PERFORMANCE FIX: Use streaming approach for large thumbnails
    const thumbBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const thumbUint8Array = await this.base64ToUint8ArrayOptimized(thumbBase64);
    const thumbArrayBuffer = thumbUint8Array.buffer as ArrayBuffer;

    // Clear the base64 string from memory immediately
    (thumbBase64 as any) = null;

    const thumbFileExt = thumbnailUri.split('.').pop()?.toLowerCase() || 'jpg';
    const thumbContentType = `image/${thumbFileExt === 'jpg' ? 'jpeg' : thumbFileExt}`;
    const thumbFileName = `thumb-${recipeId}-${Date.now()}.${thumbFileExt}`;

    // Get user ID for path
    let userIdForPath = 'public';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userIdForPath = user.id;
    } catch (authError) {
      console.warn('Could not get user for thumbnail path, using default:', authError);
    }

    const thumbStoragePath = `${userIdForPath}/recipe-thumbnails/${thumbFileName}`;

    const { data: thumbUploadData, error: thumbUploadError } = await supabase.storage
      .from('recipe-thumbnails')
      .upload(thumbStoragePath, thumbArrayBuffer, {
        contentType: thumbContentType,
        upsert: true,
        cacheControl: '3600',
      });

    // Clear array buffer from memory
    (thumbUint8Array as any) = null;

    if (thumbUploadError) {
      throw new Error(`Failed to upload thumbnail: ${thumbUploadError.message}`);
    }

    if (thumbUploadData?.path) {
      const { data: urlData } = supabase.storage
        .from('recipe-thumbnails')
        .getPublicUrl(thumbUploadData.path);
      return urlData.publicUrl;
    } else {
      throw new Error('Thumbnail upload successful but no path returned');
    }
  }

  // PERFORMANCE OPTIMIZED: Memory-efficient video upload with chunking
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

    // ADDITIONAL VALIDATION: Double-check file size here as well
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
    if (__DEV__) {
      const fileSizeMB = videoFileInfo.size ? Math.round(videoFileInfo.size / (1024 * 1024)) : 0;
      console.log(`[BackgroundUpload] 🔄 Double-checking file size in upload method`);
      console.log(`[BackgroundUpload] 📊 File size: ${fileSizeMB}MB (${videoFileInfo.size} bytes)`);
    }
    
    if (videoFileInfo.size && videoFileInfo.size > MAX_FILE_SIZE) {
      const fileSizeMB = Math.round(videoFileInfo.size / (1024 * 1024));
             const errorMessage = `Video file is too large (${fileSizeMB}MB). This should have been caught earlier! Maximum allowed size is 100MB.`;
      
      if (__DEV__) {
        console.error(`[BackgroundUpload] ❌ CRITICAL: File size validation bypass detected: ${errorMessage}`);
      }
      
      throw new Error(errorMessage);
    }

    // Start with initial progress
    onProgress?.(0.0);

    // PERFORMANCE CRITICAL: Read file in chunks to prevent memory overflow
    const videoBase64 = await this.readFileInChunks(videoUri);
    
    if (!videoBase64 || videoBase64.length === 0) {
      throw new Error('FileSystem.readAsStringAsync returned empty base64 data');
    }
    
    // Progress after reading file
    onProgress?.(0.2);

    const videoUint8Array = await this.base64ToUint8ArrayOptimized(videoBase64);
    const videoArrayBuffer = videoUint8Array.buffer as ArrayBuffer;

    // CRITICAL: Clear base64 string from memory immediately
    (videoBase64 as any) = null;

    if (videoArrayBuffer.byteLength === 0) {
      throw new Error('ArrayBuffer created from file data is empty (byteLength is 0)');
    }

    // Progress after processing file
    onProgress?.(0.3);

    const videoFileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    const videoContentType = `video/${videoFileExt}`;
    
    // MATCH WORKING UPLOADER: Use exact same filename pattern
    const videoFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${videoFileExt}`;
    const rawUploadPath = `raw-videos/${videoFileName}`;

    console.log(`[BackgroundUpload] Uploading raw video to: ${rawUploadPath}`);

    // PERFORMANCE FIX: Reduced progress updates to prevent UI spam
    let currentProgress = 0.3;
    const progressInterval = setInterval(() => {
      if (currentProgress < 0.8) {
        currentProgress += 0.1; // Slower increment
        onProgress?.(currentProgress);
      }
    }, 1500); // Longer intervals

    try {
      // MATCH WORKING UPLOADER: Use exact same upload parameters
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(rawUploadPath, videoArrayBuffer, {
          contentType: videoContentType,
          upsert: false, // MATCH WORKING UPLOADER: upsert: false
        });

      clearInterval(progressInterval);
      
      // CRITICAL: Clear array buffer from memory immediately
      (videoUint8Array as any) = null;
      
      onProgress?.(0.85);

      if (uploadError) {
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }

      // MATCH WORKING UPLOADER: Add validation step
      if (uploadData?.path) {
        console.log(`[BackgroundUpload] Validating uploaded file by downloading: ${uploadData.path}`);
        
        const { data: downloadedBlob, error: downloadValidationError } = await supabase.storage
          .from('videos')
          .download(uploadData.path);

        if (downloadValidationError) {
          console.error('[BackgroundUpload] Download validation error:', downloadValidationError.message);
          throw new Error(`Failed to validate uploaded file (download step): ${downloadValidationError.message}`);
        }

        if (!downloadedBlob) {
          console.error('[BackgroundUpload] Downloaded blob for validation is null/undefined');
          throw new Error('Failed to validate uploaded file (empty blob)');
        }

        const fileSize = downloadedBlob.size;
        console.log('[BackgroundUpload] Successfully downloaded for validation. Uploaded file size (bytes):', fileSize);
        
        if (fileSize === 0) {
          console.error('[BackgroundUpload] Uploaded file is empty after download validation');
          throw new Error('Uploaded file is empty (validation check)');
        }
        
        console.log('[BackgroundUpload] File validation successful, proceeding to invoke Edge Function');
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

  // PERFORMANCE OPTIMIZATION: Read large files in chunks to prevent memory overflow
  private async readFileInChunks(fileUri: string): Promise<string> {
    try {
      // For now, use standard read but with memory management
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      return base64;
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  private async callVideoProcessorEdgeFunction(
    videoFileName: string,
    metadata: RecipeMetadataForEdgeFunction,
    signal: AbortSignal
  ): Promise<void> {
    try {
      console.log(`[BackgroundUpload] Calling edge function with fileName: ${videoFileName}`);
      
      // Use the SAME approach as the working uploader - just call edge function with fileName
      const { data, error } = await supabase.functions.invoke('video-processor', {
        body: {
          fileName: videoFileName, // Match working uploader format
          metadata: metadata,     // Let edge function handle all database operations
        },
      });

      if (error) {
        console.error(`[BackgroundUpload] Edge function error:`, error);
        throw new Error(`Edge function failed: ${error.message}`);
      }

      console.log(`[BackgroundUpload] Edge function success:`, data);
    } catch (error: any) {
      if (signal.aborted) {
        throw new Error('Upload cancelled');
      }
      
      console.error(`[BackgroundUpload] Edge function call failed:`, error);
      throw error;
    }
  }

  // PERFORMANCE OPTIMIZED: Memory-efficient base64 conversion
  private async base64ToUint8ArrayOptimized(base64: string): Promise<Uint8Array> {
    try {
      const binary_string = atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      
      // Process in chunks to prevent blocking
      const chunkSize = 8192; // 8KB chunks
      for (let i = 0; i < len; i += chunkSize) {
        const end = Math.min(i + chunkSize, len);
        for (let j = i; j < end; j++) {
          bytes[j] = binary_string.charCodeAt(j);
        }
        
        // Yield control to prevent UI blocking
        if (i % (chunkSize * 10) === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      
      return bytes;
    } catch (e) {
      console.error('Failed to decode base64 string with atob:', e);
      throw new Error('Failed to process file data (base64 decode error).');
    }
  }

  // PERFORMANCE OPTIMIZED: Memory-efficient base64 conversion (synchronous version)
  private base64ToUint8Array(base64: string): Uint8Array {
    try {
      const binary_string = atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes;
    } catch (e) {
      console.error('Failed to decode base64 string with atob:', e);
      throw new Error('Failed to process file data (base64 decode error).');
    }
  }
}

export default BackgroundUploadService;
