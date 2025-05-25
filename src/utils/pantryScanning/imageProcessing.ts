import { supabase } from '../../services/supabase';

export interface ScannedItem {
  name: string;
  quantity: string;
}

export interface RecognitionResult {
  items: ScannedItem[];
}

/**
 * Processes an image using AI recognition service
 * @param base64Image - Base64 encoded image data
 * @returns Promise with recognized items
 */
export const processImageWithAI = async (base64Image: string): Promise<RecognitionResult> => {
  try {
    const { data, error: functionError } = await supabase.functions.invoke('recognize-stock', {
      body: { image: base64Image }
    });

    if (functionError) {
      console.error('[imageProcessing] Supabase function error:', functionError);
      throw new Error(`Function error: ${functionError.message}`);
    }

    if (!data || !Array.isArray(data.items)) {
      console.error('[imageProcessing] Invalid data format:', data);
      throw new Error('Invalid response format from AI service');
    }

    return { items: data.items };
  } catch (error) {
    console.error('[imageProcessing] Recognition error:', error);
    throw error;
  }
};

/**
 * Enforces minimum display time for loading animations
 * @param startTime - Timestamp when analysis started
 * @param minimumDisplayTime - Minimum time to show loading (default 4000ms)
 */
export const enforceMinimumDisplayTime = async (startTime: number, minTime: number): Promise<void> => {
  const elapsed = Date.now() - startTime;
  const remainingTime = Math.max(0, minTime - elapsed);
  
  if (remainingTime > 0) {
    await new Promise(resolve => setTimeout(resolve, remainingTime));
  }
};

/**
 * Validates recognition result
 * @param data - Recognition result to validate
 * @returns boolean indicating if data is valid
 */
export const validateRecognitionResult = (data: any): data is RecognitionResult => {
  return data && 
         data.items && 
         Array.isArray(data.items) && 
         data.items.every((item: any) => 
           typeof item === 'object' && 
           typeof item.name === 'string' && 
           typeof item.quantity === 'string'
         );
}; 