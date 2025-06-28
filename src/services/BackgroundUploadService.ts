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
  private readonly MAX_CONCURRENT_UPLOADS = 2;
  private readonly MAX_QUEUE_SIZE = 50; // Prevent memory issues

  private constructor() {
    super();
    this.setMaxListeners(20); // Prevent memory leak warnings
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
      maxRetries: options.maxRetries || 2, // Increased default retries
    };

    this.uploadQueue.set(uploadId, queueItem);
    await this.persistQueue();
    
    this.emit('queueUpdated', Array.from(this.uploadQueue.values()));
    this.emit('uploadAdded', queueItem);
    
    // Start processing immediately but don't await
    setImmediate(() => this.processQueue());
    
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
    
    // Start processing immediately
    setImmediate(() => this.processQueue());
    
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
    
    setImmediate(() => this.processQueue());
    return true;
  }

  // Clean up resources - call this when app is backgrounded or closed
  destroy(): void {
    // Cancel all active uploads
    this.activeUploads.forEach(controller => controller.abort());
    this.activeUploads.clear();
    
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
      // Always log persistence errors as they're critical
      console.error('[BackgroundUpload] Failed to persist upload queue:', error);
    }
  }

  private async loadPersistedQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (queueData) {
        const entries: [string, UploadQueueItem][] = JSON.parse(queueData);
        this.uploadQueue = new Map(entries);
        
        // Reset any uploading items to pending on app restart
        this.uploadQueue.forEach(item => {
          if (item.status === 'uploading') {
            item.status = 'pending';
            item.progress = 0;
          }
        });
        
        const hasPending = Array.from(this.uploadQueue.values()).some(
          item => item.status === 'pending'
        );
        
        if (hasPending) {
          // Delay processing to allow app to fully initialize
          setTimeout(() => this.processQueue(), 2000);
        }
      }
    } catch (error) {
      console.error('[BackgroundUpload] Failed to load persisted upload queue:', error);
      // Clear corrupted data
      await AsyncStorage.removeItem(this.STORAGE_KEY);
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
        
        // Start uploads without awaiting to allow concurrent processing
        uploadsToStart.forEach(upload => {
          this.startUpload(upload).catch(error => {
            if (__DEV__) {
              console.error('[BackgroundUpload] Unexpected error in startUpload:', error);
            }
          });
        });
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

      // Stage 1: Upload thumbnail (if provided)
      this.emitProgress(uploadId, 0.1, 'thumbnail');
      let publicThumbnailUrl: string | undefined;
      
      if (thumbnailUri) {
        publicThumbnailUrl = await this.uploadThumbnail(thumbnailUri, metadata.id, abortController.signal);
        this.emitProgress(uploadId, 0.2, 'thumbnail');
      }

      // Stage 2: Upload video to raw-videos
      this.emitProgress(uploadId, 0.3, 'video');
      const videoFileName = await this.uploadVideoToRaw(videoUri, metadata.id, abortController.signal, (progress) => {
        // Map video upload progress from 30% to 80%
        const mappedProgress = 0.3 + (progress * 0.5);
        this.emitProgress(uploadId, mappedProgress, 'video');
      });

      // Stage 3: Call edge function for processing
      this.emitProgress(uploadId, 0.8, 'processing');
      const finalMetadata = {
        ...metadata,
        thumbnail_url: publicThumbnailUrl,
      };

      await this.callVideoProcessorEdgeFunction(videoFileName, finalMetadata, abortController.signal);
      this.emitProgress(uploadId, 1.0, 'completed');

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

      // Process next items in queue
      setTimeout(() => this.processQueue(), 100);

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
        const retryDelay = Math.min(Math.pow(2, queueItem.retryCount) * 1000, 30000); // Cap at 30s
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
        setTimeout(() => this.processQueue(), 1000);
      }
    }
  }

  private emitProgress(uploadId: string, progress: number, stage: UploadProgress['stage']): void {
    const queueItem = this.uploadQueue.get(uploadId);
    if (queueItem) {
      // Ensure progress only moves forward (monotonic)
      if (progress >= queueItem.progress) {
        queueItem.progress = progress;
        console.log(`📊 Upload ${uploadId}: ${Math.round(progress * 100)}% - ${stage}`);
      } else {
        console.warn(`⚠️ Upload ${uploadId}: Progress went backwards from ${Math.round(queueItem.progress * 100)}% to ${Math.round(progress * 100)}%`);
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

  private async uploadThumbnail(thumbnailUri: string, recipeId: string, signal: AbortSignal): Promise<string> {
    const thumbFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
    if (!thumbFileInfo.exists) {
      throw new Error('Thumbnail file does not exist');
    }

    const thumbBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const thumbUint8Array = this.base64ToUint8Array(thumbBase64);
    const thumbArrayBuffer = thumbUint8Array.buffer as ArrayBuffer;

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

  private async uploadVideoToRaw(
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

    // Start with initial progress
    onProgress?.(0.0);

    const videoBase64 = await FileSystem.readAsStringAsync(videoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    if (!videoBase64 || videoBase64.length === 0) {
      throw new Error('FileSystem.readAsStringAsync returned empty base64 data');
    }
    
    // Progress after reading file
    onProgress?.(0.2);

    const videoUint8Array = this.base64ToUint8Array(videoBase64);
    const videoArrayBuffer = videoUint8Array.buffer as ArrayBuffer;

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

    // Smooth progress simulation - increment steadily
    let currentProgress = 0.3;
    const progressInterval = setInterval(() => {
      if (currentProgress < 0.8) {
        currentProgress += 0.05; // Increment by 5% each time
        onProgress?.(currentProgress);
      }
    }, 800);

    try {
      // MATCH WORKING UPLOADER: Use exact same upload parameters
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(rawUploadPath, videoArrayBuffer, {
          contentType: videoContentType,
          upsert: false, // MATCH WORKING UPLOADER: upsert: false
        });

      clearInterval(progressInterval);
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
