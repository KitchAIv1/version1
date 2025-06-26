import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
// import RNFS from 'react-native-fs'; // Remove or ensure this is commented out
import * as FileSystem from 'expo-file-system'; // Import expo-file-system
import { supabase } from '../services/supabase';

// Helper function to convert base64 string to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
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

export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface RecipeMetadataForEdgeFunction {
  id: string;
  title: string;
  description?: string;
  ingredients: Ingredient[];
  diet_tags: string[];
  preparation_steps: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  is_public: boolean;
  thumbnail_url?: string;
}

interface UseVideoUploaderProps {
  onUploadSuccess?: (response: any) => void;
  onUploadError?: (errorDetails: any | string) => void;
}

export const useVideoUploader = ({
  onUploadSuccess,
  onUploadError,
}: UseVideoUploaderProps = {}) => {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // 0 to 1
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const requestMediaLibraryPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return false;
      }
      return true;
    }
    return true;
  };

  const selectMedia = async (
    mediaTypeValue: ImagePicker.MediaType,
    setUri: (uri: string | null) => void,
  ) => {
    const hasPermission = await requestMediaLibraryPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaTypeValue,
        allowsEditing: mediaTypeValue === 'images',
        aspect: mediaTypeValue === 'images' ? [4, 3] : undefined,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUri(result.assets[0].uri);
        setError(null);
      } else {
        setUri(null);
      }
    } catch (err: any) {
      console.error(`Error selecting media (${mediaTypeValue}):`, err);
      setError(err.message || 'Failed to select media.');
      setUri(null);
      if (onUploadError)
        onUploadError(err.message || 'Failed to select media.');
    }
  };

  const selectVideo = () => selectMedia('videos', setVideoUri);
  const selectThumbnail = () => selectMedia('images', setThumbnailUri);

  const uploadRecipe = async (metadata: RecipeMetadataForEdgeFunction) => {
    if (!videoUri) {
      const errMsg = 'No video selected to upload.';
      setError(errMsg);
      if (onUploadError) onUploadError(errMsg);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const finalMetadata = { ...metadata }; // Copy metadata to potentially add thumbnail_url

    try {
      // Part 1: Upload Thumbnail if present
      let publicThumbnailUrl: string | undefined;
      if (thumbnailUri) {
        console.log('[THUMBNAIL] Processing thumbnail URI:', thumbnailUri);
        setUploadProgress(0.05); // Progress for starting thumbnail upload

        const thumbFileInfo = await FileSystem.getInfoAsync(thumbnailUri);
        if (!thumbFileInfo.exists) {
          throw new Error('Selected thumbnail file does not exist.');
        }

        const thumbBase64 = await FileSystem.readAsStringAsync(thumbnailUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!thumbBase64) {
          throw new Error('Failed to read thumbnail as base64.');
        }
        console.log('[THUMBNAIL] Read thumbnail as base64.');

        const thumbUint8Array = base64ToUint8Array(thumbBase64);
        const thumbArrayBuffer = thumbUint8Array.buffer as ArrayBuffer;

        if (thumbArrayBuffer.byteLength === 0) {
          throw new Error('Thumbnail ArrayBuffer is empty.');
        }

        const thumbFileExt =
          thumbnailUri.split('.').pop()?.toLowerCase() || 'jpg';
        const thumbContentType = `image/${thumbFileExt === 'jpg' ? 'jpeg' : thumbFileExt}`;
        // Use the recipe ID from metadata for a consistent thumbnail name
        const thumbFileName = `thumb-${metadata.id}-${Date.now()}.${thumbFileExt}`;

        // Attempt to get user ID for namespacing, fall back to 'public' or a default
        let userIdForPath = 'public';
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) userIdForPath = user.id;
        } catch (authError) {
          console.warn(
            'Could not get user for thumbnail path, using default:',
            authError,
          );
        }

        const thumbStoragePath = `${userIdForPath}/recipe-thumbnails/${thumbFileName}`;

        console.log(`[THUMBNAIL] Uploading to: ${thumbStoragePath}`);
        setUploadProgress(0.1); // Progress before thumbnail upload call

        const { data: thumbUploadData, error: thumbUploadError } =
          await supabase.storage
            .from('recipe-thumbnails')
            .upload(thumbStoragePath, thumbArrayBuffer, {
              contentType: thumbContentType,
              upsert: true, // Consider if upsert is desired for new uploads, usually false
              cacheControl: '3600',
            });

        if (thumbUploadError) {
          console.error('[THUMBNAIL] Upload error:', thumbUploadError);
          throw new Error(
            `Failed to upload thumbnail: ${thumbUploadError.message}`,
          );
        }
        console.log('[THUMBNAIL] Upload success:', thumbUploadData);
        setUploadProgress(0.15); // Progress after thumbnail upload

        if (thumbUploadData?.path) {
          const { data: urlData } = supabase.storage
            .from('recipe-thumbnails')
            .getPublicUrl(thumbUploadData.path);
          publicThumbnailUrl = urlData.publicUrl;
          console.log('[THUMBNAIL] Public URL:', publicThumbnailUrl);
          finalMetadata.thumbnail_url = publicThumbnailUrl; // Add to metadata
        } else {
          console.warn(
            '[THUMBNAIL] Upload successful but no path returned, cannot get public URL.',
          );
        }
      } else {
        console.log(
          '[THUMBNAIL] No thumbnail URI provided, skipping thumbnail upload.',
        );
      }

      // Part 2: Upload Video (existing logic)
      // Adjust progress to account for thumbnail step
      setUploadProgress(publicThumbnailUrl ? 0.2 : 0.05); // Base progress before video actions

      const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
      const determinedContentType = `video/${fileExt}`;
      let blob: Blob;

      console.log(
        '[EXPO-FS METHOD] Validating file with Expo FileSystem for URI:',
        videoUri,
      );
      const fileInfo = await FileSystem.getInfoAsync(videoUri);

      if (!fileInfo.exists) {
        throw new Error('Selected file does not exist on the device.');
      }
      if (fileInfo.size === 0) {
        throw new Error(
          'Selected file is empty on the device (0 bytes based on FileSystem.getInfoAsync).',
        );
      }
      console.log(
        `[EXPO-FS METHOD] File exists. Size: ${fileInfo.size} bytes. Proceeding to read.`,
      );

      const fileDataInBase64 = await FileSystem.readAsStringAsync(videoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!fileDataInBase64 || fileDataInBase64.length === 0) {
        throw new Error(
          'FileSystem.readAsStringAsync returned empty base64 data.',
        );
      }
      console.log(
        `[EXPO-FS METHOD] Successfully read file as base64. Base64 length: ${fileDataInBase64.length}`,
      );

      const uint8Array = base64ToUint8Array(fileDataInBase64);

      // Directly use the underlying ArrayBuffer from the Uint8Array, casting for Supabase client
      const arrayBuffer = uint8Array.buffer as ArrayBuffer;
      console.log(
        `[EXPO-FS METHOD] Created ArrayBuffer from Uint8Array. Byte length: ${arrayBuffer.byteLength}`,
      );

      if (arrayBuffer.byteLength === 0) {
        throw new Error(
          'ArrayBuffer created from file data is empty (byteLength is 0).',
        );
      }
      setUploadProgress(publicThumbnailUrl ? 0.25 : 0.1); // Video file processed

      const videoFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const rawUploadPath = `raw-videos/${videoFileName}`;

      console.log(`Uploading raw video to: ${rawUploadPath}`);
      setUploadProgress(publicThumbnailUrl ? 0.3 : 0.15); // Before video upload call
      const { data: uploadData, error: uploadErrorResponse } =
        await supabase.storage
          .from('videos')
          // .upload(rawUploadPath, blob, { // Old way with Blob
          //   contentType: blob.type,
          //   upsert: false,
          // });
          .upload(rawUploadPath, arrayBuffer, {
            contentType: determinedContentType, // Pass determinedContentType directly
            upsert: false,
          });

      setUploadProgress(publicThumbnailUrl ? 0.6 : 0.55);

      // Validate the uploaded file by attempting to download it and check its size
      if (uploadData?.path) {
        console.log(
          `[VALIDATION] Validating uploaded file by downloading: ${uploadData.path}`,
        );
        setUploadProgress(publicThumbnailUrl ? 0.6 : 0.55); // During validation
        const { data: downloadedBlob, error: downloadValidationError } =
          await supabase.storage.from('videos').download(uploadData.path);

        if (downloadValidationError) {
          console.error(
            '[VALIDATION] Download validation error:',
            downloadValidationError.message,
          );
          // Optionally, attempt to delete the just-uploaded file if validation fails early
          // await supabase.storage.from('videos').remove([uploadData.path]);
          throw new Error(
            `Failed to validate uploaded file (download step): ${downloadValidationError.message}`,
          );
        }

        if (!downloadedBlob) {
          console.error(
            '[VALIDATION] Downloaded blob for validation is null/undefined.',
          );
          // await supabase.storage.from('videos').remove([uploadData.path]);
          throw new Error('Failed to validate uploaded file (empty blob).');
        }

        const fileSize = downloadedBlob.size; // Blob directly has a size property
        console.log(
          '[VALIDATION] Successfully downloaded for validation. Uploaded file size (bytes):',
          fileSize,
        );
        if (fileSize === 0) {
          console.error(
            '[VALIDATION] Uploaded file is empty after download validation.',
          );
          // await supabase.storage.from('videos').remove([uploadData.path]);
          throw new Error('Uploaded file is empty (validation check).');
        }
        console.log(
          '[VALIDATION] File validation successful, proceeding to invoke Edge Function.',
        );
      } else {
        console.warn(
          '[VALIDATION] No uploadData.path available to validate uploaded file. Skipping validation.',
        );
        // This case should ideally not happen if upload was reported as successful
        throw new Error('Upload data path missing, cannot validate file.');
      }

      console.log(
        `Invoking Edge Function 'video-processor' for fileName: ${videoFileName} with metadata:`,
        finalMetadata,
      );
      setUploadProgress(publicThumbnailUrl ? 0.8 : 0.75); // Before EF invoke

      const { data: functionResponse, error: functionError } =
        await supabase.functions.invoke('video-processor', {
          body: {
            fileName: videoFileName,
            metadata: finalMetadata, // Pass the potentially updated metadata
          },
        });

      if (functionError) {
        console.error('Error invoking Edge Function:', functionError);
        if (uploadData?.path) {
          // Re-enable cleanup of raw video after Edge Function error
          await supabase.storage.from('videos').remove([uploadData.path]);
          console.log(
            'Cleaned up raw video after Edge Function error:',
            uploadData.path,
          );
        }
        // Pass richer error information if available (e.g., from functionError.context)
        // The actual structure of functionError depends on supabase-js version and how Edge Functions return errors.
        // Common places for JSON error body are context, details, or the error object itself might have more fields.
        const errorToPass =
          functionError.context ||
          functionError.details ||
          functionError.message ||
          functionError;
        if (onUploadError) {
          onUploadError(errorToPass);
        }
        setError(
          typeof errorToPass === 'string'
            ? errorToPass
            : JSON.stringify(errorToPass),
        ); // Update local error state as well
        return; // Stop execution here as onUploadError is called
        // throw new Error(`Video processing failed: ${functionError.message}`); // No longer throwing here, handled by callback
      }

      console.log('Edge Function response:', functionResponse);
      setUploadProgress(1);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        console.log(`Invalidated queries for user: ${user.id}`);
      } else {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }

      if (onUploadSuccess) onUploadSuccess(functionResponse);
      setVideoUri(null);
      setThumbnailUri(null);
      return functionResponse;
    } catch (err: any) {
      console.error('Error in uploadRecipe process:', err);
      // This catch block handles errors from earlier stages (file read, raw upload, validation)
      // or if onUploadError was not provided to the hook.
      const errorMessage =
        err.message || 'An unknown error occurred during recipe upload.';
      setError(errorMessage);
      if (onUploadError) {
        onUploadError(errorMessage); // For other errors, pass the message string
      } else {
        // If no callback, rethrow or handle as appropriate for your app's global error handling
        console.warn(
          'onUploadError callback not provided to useVideoUploader for error:',
          err,
        );
      }
    } finally {
      setIsUploading(false);
      if (uploadProgress < 1) {
        setUploadProgress(0);
      }
    }
  };

  return {
    selectVideo,
    selectThumbnail,
    uploadRecipe,
    videoUri,
    thumbnailUri,
    isUploading,
    uploadProgress,
    error,
  };
};
