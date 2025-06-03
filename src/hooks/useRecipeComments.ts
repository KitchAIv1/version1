import { useQuery } from '@tanstack/react-query';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../services/supabase'; // Assuming supabase client is here

// Define the structure of a single comment based on the RPC output
export interface RecipeComment {
  comment_id: number;
  recipe_id: string; // UUIDs are strings in JS/TS
  user_id: string; // UUIDs are strings in JS/TS
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

// NEW: Lightweight comment count fetcher for efficient real-time sync
export const fetchCommentCount = async (recipeId: string): Promise<number> => {
  if (!recipeId) return 0;

  console.log(`[fetchCommentCount] 📊 Fetching count for recipe ${recipeId}`);

  // Use direct table count for maximum efficiency
  const { count, error } = await supabase
    .from('recipe_comments')
    .select('*', { count: 'exact', head: true })
    .eq('recipe_id', recipeId);

  if (error) {
    console.error(`[fetchCommentCount] Error for recipe ${recipeId}:`, error);
    return 0;
  }

  const commentCount = count || 0;
  console.log(
    `[fetchCommentCount] ✅ Recipe ${recipeId} has ${commentCount} comments`,
  );

  return commentCount;
};

// NEW: Batch comment count fetcher for multiple recipes
export const fetchMultipleCommentCounts = async (
  recipeIds: string[],
): Promise<Record<string, number>> => {
  if (!recipeIds.length) return {};

  console.log(
    `[fetchMultipleCommentCounts] 📊 Batch fetching counts for ${recipeIds.length} recipes`,
  );

  const { data, error } = await supabase
    .from('recipe_comments')
    .select('recipe_id')
    .in('recipe_id', recipeIds);

  if (error) {
    console.error('[fetchMultipleCommentCounts] Error:', error);
    return {};
  }

  // Count comments per recipe
  const counts: Record<string, number> = {};
  recipeIds.forEach(id => (counts[id] = 0)); // Initialize all to 0

  data.forEach(comment => {
    counts[comment.recipe_id] = (counts[comment.recipe_id] || 0) + 1;
  });

  console.log(`[fetchMultipleCommentCounts] ✅ Batch result:`, counts);
  return counts;
};
