import { useQueries, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useMemo, useEffect } from 'react';
import { useCacheManager } from './useCacheManager';

// Define the RecipeDetailsData interface for type safety
export interface RecipeDetailsData {
  recipe_id: string;
  title: string;
  user_id: string; // creator's user_id
  servings: number | null;
  diet_tags: string[] | null;
  is_public: boolean;
  video_url: string | null;
  created_at: string;
  description: string | null;
  username?: string | null;         // Creator's username
  avatar_url?: string | null;       // Creator's avatar
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
  views_count: number;
}

// Define the hook's return type
interface UseRecipeDetailsResult {
  data: RecipeDetailsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Update fetchRecipeDetails to accept userId and pass it to RPC
export const fetchRecipeDetails = async (recipeId: string, userId?: string, queryClient?: any) => {
  if (!recipeId) throw new Error('Recipe ID is required');
  
  console.log(`[fetchRecipeDetails] Fetching for recipe ${recipeId}, user ${userId}`);
  
  // Check if we have existing feed data for this recipe to compare like counts
  let existingFeedData = null;
  if (queryClient) {
    const feedData = queryClient.getQueryData(['feed']);
    if (feedData && Array.isArray(feedData)) {
      existingFeedData = feedData.find((item: any) => item.id === recipeId || item.recipe_id === recipeId);
    }
  }
  
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
  
  // Add detailed logging for like state and compare with feed data
  console.log(`[fetchRecipeDetails] Raw like data for recipe ${recipeId}:`, {
    is_liked_by_user: data.is_liked_by_user,
    likes: data.likes,
    user_id: userId,
    raw_data_keys: Object.keys(data),
    timestamp: new Date().toISOString()
  });
  
  // Check for discrepancies with feed data
  if (existingFeedData && existingFeedData.likes !== data.likes) {
    console.warn(`[fetchRecipeDetails] LIKE COUNT DISCREPANCY for recipe ${recipeId}:`, {
      feed_likes: existingFeedData.likes,
      recipe_details_likes: data.likes,
      feed_liked: existingFeedData.liked,
      recipe_details_liked: data.is_liked_by_user,
      title: data.title,
      timestamp: new Date().toISOString()
    });
    
    // Use the higher like count as it's more likely to be correct
    // (assuming likes generally increase over time)
    if (existingFeedData.likes > data.likes) {
      console.log(`[fetchRecipeDetails] Using feed like count (${existingFeedData.likes}) instead of recipe details (${data.likes})`);
      data.likes = existingFeedData.likes;
    }
  }
  
  // Log raw and cleaned preparation steps for debugging
  console.log(`[fetchRecipeDetails] Raw data.preparation_steps for recipe ${recipeId}:`, JSON.stringify(data.preparation_steps));
  const cleanedSteps = (data.preparation_steps || []).map(
    (step: string) => step.replace(/^"+|"+$/g, '').trim()
  );
  console.log(`[fetchRecipeDetails] Cleaned preparation_steps for recipe ${recipeId}:`, JSON.stringify(cleanedSteps));
  
  // Return data including the new is_saved_by_user field (assuming RPC provides it)
  const processedData = {
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

  // Log the final processed data for comparison
  console.log(`[fetchRecipeDetails] Processed like data for recipe ${recipeId}:`, {
    final_is_liked_by_user: processedData.is_liked_by_user,
    final_likes: processedData.likes,
    user_id: userId,
    timestamp: new Date().toISOString()
  });

  return processedData;
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
    queryFn: () => fetchRecipeDetails(recipeId, userId, queryClient), // Pass queryClient
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
  const cacheManager = useCacheManager();
  
  // useEffect to log recipe view
  useEffect(() => {
    if (recipeId && userId) {
      const logView = async () => {
        try {
          console.log(`[useRecipeDetails] Logging view for recipe ${recipeId}, user ${userId}`);
          const { error: logError } = await supabase.rpc('log_recipe_view', {
            p_recipe_id: recipeId,
            p_user_id: userId
          });
          if (logError) {
            // Check if it's a duplicate key error (user already viewed this recipe)
            if (logError.code === '23505') {
              console.log(`[useRecipeDetails] View already logged for recipe ${recipeId}, user ${userId} - skipping`);
              return; // Don't treat duplicate views as errors
            }
            console.error('[useRecipeDetails] Error calling log_recipe_view:', logError);
            // Don't throw here to avoid breaking the main data fetch if logging fails
          } else {
            console.log(`[useRecipeDetails] View logged successfully for recipe ${recipeId}. Updating views count only.`);
            // Instead of invalidating the entire query, just update the views_count
            queryClient.setQueryData(['recipeDetails', recipeId, userId], (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                views_count: (oldData.views_count || 0) + 1
              };
            });
          }
        } catch (e) {
          console.error('[useRecipeDetails] Exception in logView:', e);
        }
      };
      
      // Add a small delay to avoid immediate invalidation on mount
      const timer = setTimeout(logView, 1000);
      return () => clearTimeout(timer);
    }
  }, [recipeId, userId, queryClient]);

  const results = useQueries({
    queries: [
      {
        queryKey: ['recipeDetails', recipeId, userId], // Add userId to queryKey
        queryFn: () => fetchRecipeDetails(recipeId!, userId, queryClient), // Pass userId and queryClient here
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

  // Update feed cache when recipe details are successfully fetched
  useEffect(() => {
    if (recipeResult.data && recipeId) {
      // Update feed cache with recipe details data to keep them in sync
      queryClient.setQueryData(['feed'], (oldFeedData: any) => {
        if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
        
        return oldFeedData.map((item: any) => {
          if (item.id === recipeId || item.recipe_id === recipeId) {
            console.log(`[useRecipeDetails] Syncing feed with recipe details for recipe ${recipeId}:`, {
              feed_likes: item.likes,
              recipe_details_likes: recipeResult.data.likes,
              feed_liked: item.liked,
              recipe_details_liked: recipeResult.data.is_liked_by_user,
              feed_saved: item.saved,
              recipe_details_saved: recipeResult.data.is_saved_by_user,
              feed_comments: item.commentsCount,
              recipe_details_comments: recipeResult.data.comments_count,
              title: item.title
            });
            
            return {
              ...item,
              likes: recipeResult.data.likes,
              liked: recipeResult.data.is_liked_by_user,
              saved: recipeResult.data.is_saved_by_user,
              commentsCount: recipeResult.data.comments_count
            };
          }
          return item;
        });
      });
    }
  }, [recipeResult.data, recipeId, queryClient]);

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

  // Update refetch logic to include comment count
  const refetch = () => {
    recipeResult.refetch();
    if (userId) {
      pantryResult.refetch();
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