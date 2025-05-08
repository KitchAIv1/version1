import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase'; // Assuming supabase client is here
import { PostgrestError } from '@supabase/supabase-js';

// Define the structure of a single comment based on the RPC output
export interface RecipeComment {
  comment_id: number;
  recipe_id: string; // UUIDs are strings in JS/TS
  user_id: string;   // UUIDs are strings in JS/TS
  comment_text: string;
  created_at: string; // Timestamps are typically strings, can be parsed to Date
  username: string;
  avatar_url?: string | null; // avatar_url can be null
}

// Define the props for the hook
interface UseRecipeCommentsProps {
  recipeId: string | undefined | null;
}

export const useRecipeComments = ({ recipeId }: UseRecipeCommentsProps) => {
  const fetchComments = async () => {
    if (!recipeId) {
      // Return an empty array or throw an error if recipeId is not provided
      // For now, let's return empty, useQuery's enabled flag will prevent fetching
      return [];
    }

    const { data, error } = await supabase.rpc('get_recipe_comments', {
      p_recipe_id: recipeId,
    });

    if (error) {
      console.error('Error fetching recipe comments:', error);
      throw error; // React Query will catch this and set the error state
    }
    return data as RecipeComment[]; // Cast to our defined type
  };

  return useQuery<RecipeComment[], PostgrestError>({
    queryKey: ['recipeComments', recipeId],
    queryFn: fetchComments,
    enabled: !!recipeId, // Only run the query if recipeId is truthy
    staleTime: 5 * 60 * 1000, // Optional: 5 minutes stale time
    // Add other React Query options as needed, e.g., onError, onSuccess
  });
}; 