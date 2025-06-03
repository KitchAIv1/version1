import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  targetSizeKB?: number;
  maxIterations?: number;
}

export interface CompressionResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
  fileSize?: number;
  compressionRatio?: number;
}

// Predefined compression presets
export const COMPRESSION_PRESETS = {
  AVATAR: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.8,
    format: 'jpeg' as const,
    targetSizeKB: 100,
    maxIterations: 3,
  },
  THUMBNAIL: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'jpeg' as const,
    targetSizeKB: 50,
    maxIterations: 3,
  },
  HIGH_QUALITY: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.9,
    format: 'jpeg' as const,
    targetSizeKB: 300,
    maxIterations: 2,
  },
  LOW_BANDWIDTH: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.6,
    format: 'jpeg' as const,
    targetSizeKB: 30,
    maxIterations: 4,
  },
} as const;

/**
 * Estimates file size from base64 string
 * @param base64 - Base64 encoded image
 * @returns Estimated file size in bytes
 */
const estimateFileSizeFromBase64 = (base64: string): number => {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  // Base64 encoding increases size by ~33%, so actual size is ~75% of base64 length
  return Math.round((cleanBase64.length * 3) / 4);
};

/**
 * Calculates optimal dimensions while maintaining aspect ratio
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param maxWidth - Maximum allowed width
 * @param maxHeight - Maximum allowed height
 * @returns Optimized dimensions
 */
const calculateOptimalDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } => {
  const aspectRatio = originalWidth / originalHeight;

  let newWidth = originalWidth;
  let newHeight = originalHeight;

  // Scale down if exceeds max dimensions
  if (newWidth > maxWidth) {
    newWidth = maxWidth;
    newHeight = newWidth / aspectRatio;
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = newHeight * aspectRatio;
  }

  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
  };
};

/**
 * Compresses an image with intelligent quality adjustment
 * @param uri - Image URI to compress
 * @param options - Compression options
 * @returns Promise with compression result
 */
export const compressImage = async (
  uri: string,
  options: CompressionOptions = {},
): Promise<CompressionResult> => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    format = 'jpeg',
    targetSizeKB,
    maxIterations = 3,
  } = options;

  try {
    // Get original image info
    const originalInfo = await ImageManipulator.manipulateAsync(uri, [], {
      base64: true,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const originalSize = estimateFileSizeFromBase64(originalInfo.base64!);
    const originalSizeKB = originalSize / 1024;

    // Calculate optimal dimensions
    const { width: targetWidth, height: targetHeight } =
      calculateOptimalDimensions(
        originalInfo.width,
        originalInfo.height,
        maxWidth,
        maxHeight,
      );

    let currentQuality = quality;
    let currentWidth = targetWidth;
    let currentHeight = targetHeight;
    let iteration = 0;
    let result = originalInfo;

    // If no target size specified, just resize and compress once
    if (!targetSizeKB) {
      result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: currentWidth, height: currentHeight } }],
        {
          compress: currentQuality,
          format:
            format === 'jpeg'
              ? ImageManipulator.SaveFormat.JPEG
              : format === 'png'
                ? ImageManipulator.SaveFormat.PNG
                : ImageManipulator.SaveFormat.WEBP,
          base64: true,
        },
      );
    } else {
      // Iteratively compress to reach target size
      while (iteration < maxIterations) {
        const manipulateActions: ImageManipulator.Action[] = [];

        // Add resize action if dimensions changed
        if (
          currentWidth !== originalInfo.width ||
          currentHeight !== originalInfo.height
        ) {
          manipulateActions.push({
            resize: { width: currentWidth, height: currentHeight },
          });
        }

        result = await ImageManipulator.manipulateAsync(
          uri,
          manipulateActions,
          {
            compress: currentQuality,
            format:
              format === 'jpeg'
                ? ImageManipulator.SaveFormat.JPEG
                : format === 'png'
                  ? ImageManipulator.SaveFormat.PNG
                  : ImageManipulator.SaveFormat.WEBP,
            base64: true,
          },
        );

        const currentSize = estimateFileSizeFromBase64(result.base64!);
        const currentSizeKB = currentSize / 1024;

        // Check if we've reached the target size
        if (currentSizeKB <= targetSizeKB) {
          break;
        }

        // Adjust compression parameters for next iteration
        iteration++;
        if (iteration < maxIterations) {
          // Reduce quality more aggressively if we're far from target
          const sizeRatio = currentSizeKB / targetSizeKB;
          if (sizeRatio > 2) {
            currentQuality *= 0.6; // Aggressive reduction
            // Also reduce dimensions if quality is getting too low
            if (currentQuality < 0.3) {
              currentWidth = Math.round(currentWidth * 0.8);
              currentHeight = Math.round(currentHeight * 0.8);
              currentQuality = Math.max(currentQuality, 0.3);
            }
          } else {
            currentQuality *= 0.8; // Moderate reduction
          }

          currentQuality = Math.max(currentQuality, 0.1); // Minimum quality threshold
        }
      }
    }

    const finalSize = estimateFileSizeFromBase64(result.base64!);
    const compressionRatio =
      originalSize > 0 ? (originalSize - finalSize) / originalSize : 0;

    return {
      uri: result.uri,
      base64: result.base64,
      width: result.width,
      height: result.height,
      fileSize: finalSize,
      compressionRatio,
    };
  } catch (error) {
    console.error('[imageCompression] Error compressing image:', error);
    throw new Error(`Image compression failed: ${(error as Error).message}`);
  }
};

/**
 * Compresses image using a predefined preset
 * @param uri - Image URI to compress
 * @param preset - Compression preset name
 * @returns Promise with compression result
 */
export const compressImageWithPreset = async (
  uri: string,
  preset: keyof typeof COMPRESSION_PRESETS,
): Promise<CompressionResult> => {
  return compressImage(uri, COMPRESSION_PRESETS[preset]);
};

/**
 * Creates multiple sizes of an image (useful for responsive images)
 * @param uri - Original image URI
 * @param sizes - Array of size configurations
 * @returns Promise with array of compression results
 */
export const createMultipleSizes = async (
  uri: string,
  sizes: Array<{ name: string; options: CompressionOptions }>,
): Promise<Array<{ name: string; result: CompressionResult }>> => {
  const results = await Promise.all(
    sizes.map(async ({ name, options }) => ({
      name,
      result: await compressImage(uri, options),
    })),
  );

  return results;
};

/**
 * Validates if an image needs compression
 * @param uri - Image URI to check
 * @param maxSizeKB - Maximum allowed size in KB
 * @returns Promise with boolean indicating if compression is needed
 */
export const needsCompression = async (
  uri: string,
  maxSizeKB: number,
): Promise<{ needsCompression: boolean; currentSizeKB: number }> => {
  try {
    const info = await ImageManipulator.manipulateAsync(uri, [], {
      base64: true,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    const currentSize = estimateFileSizeFromBase64(info.base64!);
    const currentSizeKB = currentSize / 1024;

    return {
      needsCompression: currentSizeKB > maxSizeKB,
      currentSizeKB,
    };
  } catch (error) {
    console.error('[imageCompression] Error checking image size:', error);
    return { needsCompression: true, currentSizeKB: 0 };
  }
};
