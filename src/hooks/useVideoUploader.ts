import { useState } from 'react';
import { supabase } from '../services/supabase';

interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

interface RecipeMetadata {
  title: string;
  description?: string;
  ingredients: Ingredient[];
  diet_tags: string[];
  preparation_steps: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  is_public: boolean;
}

export const useVideoUploader = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadVideoToSupabase = async (videoUri: string): Promise<string> => {
    try {
      // 1. Convert video to blob
      const response = await fetch(videoUri);
      const blob = await response.blob();

      // 2. Generate unique filename
      const videoFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;

      // 3. Upload to Supabase Storage
      const { data: videoData, error: videoError } = await supabase.storage
        .from('videos')
        .upload(`processed-videos/${videoFileName}`, blob, {
          contentType: 'video/mp4',
        });

      if (videoError) throw videoError;

      // 4. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(`processed-videos/${videoFileName}`);

      return publicUrl;
    } catch (err) {
      console.error('Error uploading video:', err);
      throw new Error('Failed to upload video');
    }
  };

  const submitRecipeMetadata = async (metadata: RecipeMetadata, videoUrl: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const { data: recipeData, error: recipeError } = await supabase
        .from('recipe_uploads')
        .insert({
          user_id: userData.user?.id,
          video_url: videoUrl,
          title: metadata.title,
          description: metadata.description,
          ingredients: metadata.ingredients,
          diet_tags: metadata.diet_tags,
          preparation_steps: metadata.preparation_steps,
          prep_time_minutes: metadata.prep_time_minutes,
          cook_time_minutes: metadata.cook_time_minutes,
          servings: metadata.servings,
          is_public: metadata.is_public,
          created_at: new Date().toISOString(),
        });

      if (recipeError) throw recipeError;
      return recipeData;
    } catch (err) {
      console.error('Error submitting recipe metadata:', err);
      throw new Error('Failed to submit recipe metadata');
    }
  };

  const uploadRecipe = async (videoUri: string, metadata: RecipeMetadata) => {
    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload video
      const videoUrl = await uploadVideoToSupabase(videoUri);

      // 2. Submit metadata
      const recipeData = await submitRecipeMetadata(metadata, videoUrl);

      return recipeData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadRecipe,
    isUploading,
    error,
  };
}; 