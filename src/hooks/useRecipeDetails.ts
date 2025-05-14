import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useMemo } from 'react';

// Define the RecipeDetailsData interface for type safety
export interface RecipeDetailsData {
  recipe_id: string;
  title: string;
  user_id: string;
  servings: number | null;
  diet_tags: string[] | null;
  is_public: boolean;
  video_url: string | null;
  created_at: string;
  description: string | null;
  username?: string | null;
  avatar_url?: string | null;
  ingredients: Array<{ name: string; unit: string | null; quantity: string | null }>;
  comments_count: number;
  cook_time_minutes: number | null;
  prep_time_minutes: number | null;
  preparation_steps: string[];
  likes: number;
  is_liked_by_user: boolean;
  is_saved_by_user: boolean;
  matched_ingredients?: string[];
  missing_ingredient_names?: string[];
  missing_ingredients?: string[];
}

// Define the hook's return type
interface UseRecipeDetailsResult {
  data: RecipeDetailsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Update fetchRecipeDetails to accept userId and pass it to RPC
export const fetchRecipeDetails = async (recipeId: string, userId?: string) => {
  if (!recipeId) throw new Error('Recipe ID is required');
  
  console.log(`[fetchRecipeDetails] Fetching for recipe ${recipeId}, user ${userId}`);
  
  // Pass userId to the RPC. Backend RPC needs to handle null/undefined userId gracefully (return is_saved_by_user: false)
  const { data, error } = await supabase.rpc('get_recipe_details', { 
    p_recipe_id: recipeId, 
    p_user_id: userId // Pass the user ID
  });
  
  if (error) {
    console.error('[fetchRecipeDetails] RPC Error:', error);
    throw error;
  }
  if (!data) {
    console.warn(`[fetchRecipeDetails] No data returned for recipe ${recipeId}`);
    throw new Error('Recipe not found');
  }
  
  // Log raw and cleaned preparation steps for debugging
  console.log(`[fetchRecipeDetails] Raw data.preparation_steps for recipe ${recipeId}:`, JSON.stringify(data.preparation_steps));
  const cleanedSteps = (data.preparation_steps || []).map(
    (step: string) => step.replace(/^"+|"+$/g, '').trim()
  );
  console.log(`[fetchRecipeDetails] Cleaned preparation_steps for recipe ${recipeId}:`, JSON.stringify(cleanedSteps));
  
  // Return data including the new is_saved_by_user field (assuming RPC provides it)
  return {
    ...data,
    preparation_steps: cleanedSteps,
    ingredients: data.ingredients || [],
    diet_tags: data.diet_tags || [],
    description: data.description || '',
    servings: data.servings ?? null,
    prep_time_minutes: data.prep_time_minutes ?? null,
    cook_time_minutes: data.cook_time_minutes ?? null,
    video_url: data.video_url ?? null,
    likes: data.likes ?? 0,
    is_liked_by_user: data.is_liked_by_user ?? false, // Default if missing
    is_saved_by_user: data.is_saved_by_user ?? false, // Default if missing
    comments_count: data.comments_count ?? 0,
  } as RecipeDetailsData; // Cast to ensure type match
};

export const fetchPantryMatch = async (recipeId: string, userId: string) => {
  if (!recipeId || !userId) return { matched_ingredients: [], missing_ingredients: [] };
  
  const { data, error } = await supabase.rpc('match_pantry_ingredients', {
    p_recipe_id: recipeId,
    p_user_id: userId
  });

  if (error) {
    console.error('RPC Error Details (match_pantry_ingredients):', error);
    throw new Error('Failed to fetch pantry match: ' + error.message);
  }

  if (!data) {
    console.warn('No data returned from match_pantry_ingredients');
    throw new Error('No pantry match data found');
  }

  return {
    matched_ingredients: data?.matched_ingredients || [],
    missing_ingredients: data?.unmatched_ingredients || [],
  };
};

// Prefetch function that can be used in list screens, etc.
export const prefetchRecipeDetails = async (queryClient: any, recipeId: string, userId?: string) => {
  // Prefetch recipe details
  await queryClient.prefetchQuery({
    queryKey: ['recipeDetails', recipeId, userId],
    queryFn: () => fetchRecipeDetails(recipeId, userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Prefetch pantry match if user is logged in
  if (userId) {
    await queryClient.prefetchQuery({
      queryKey: ['pantryMatch', recipeId, userId],
      queryFn: () => fetchPantryMatch(recipeId, userId),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }
};

export const useRecipeDetails = (recipeId: string | undefined, userId?: string): UseRecipeDetailsResult => {
  const queryClient = useQueryClient();
  
  const results = useQueries({
    queries: [
      {
        queryKey: ['recipeDetails', recipeId, userId], // Add userId to queryKey
        queryFn: () => fetchRecipeDetails(recipeId!, userId), // Pass userId here
        // Ensure query is enabled only when both recipeId and userId are available,
        // because the RPC get_recipe_details(p_recipe_id, p_user_id) expects both.
        enabled: !!recipeId && typeof userId !== 'undefined', 
        staleTime: 10 * 60 * 1000, 
        gcTime: 30 * 60 * 1000,
      },
      {
        queryKey: ['pantryMatch', recipeId, userId],
        queryFn: () => fetchPantryMatch(recipeId!, userId!),
        enabled: !!recipeId && !!userId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      },
    ],
  });

  const recipeResult = results[0];
  const pantryResult = results[1];

  const isLoading = recipeResult.isLoading || (!!userId && pantryResult.isLoading);
  const error = recipeResult.error || pantryResult.error;
  
  // Memoize the combined data
  const data = useMemo(() => {
    if (!recipeResult.data) return null;
    
    // Combine results, ensuring is_saved_by_user is included from recipeResult.data
    return {
      ...recipeResult.data, 
      matched_ingredients: pantryResult.data?.matched_ingredients || [],
      missing_ingredients: pantryResult.data?.missing_ingredients || [],
      missing_ingredient_names: pantryResult.data?.missing_ingredients || [],
    } as RecipeDetailsData;
  }, [recipeResult.data, pantryResult.data]);

  // Update refetch logic if needed, but it might be okay as is
  const refetch = () => {
    recipeResult.refetch();
    if (userId) {
      pantryResult.refetch();
    }
    if (recipeId) {
      queryClient.invalidateQueries({ queryKey: ['recipe-comments', recipeId] });
    }
  };

  return {
    data,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
};

export default useRecipeDetails; 