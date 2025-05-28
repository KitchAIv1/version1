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
  pantry_match?: {                  // NEW: Unified pantry match data
    match_percentage: number;
    matched_ingredients: string[];
    missing_ingredients: string[];
  };
  matched_ingredients?: string[];   // For backward compatibility
  missing_ingredient_names?: string[]; 
  missing_ingredients?: string[];   // For backward compatibility
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
  
  try {
    // Fetch recipe details (using the reverted get_recipe_details)
    const { data: recipeData, error: recipeError } = await supabase.rpc('get_recipe_details', {
      p_user_id: userId,
      p_recipe_id: recipeId
    });

    if (recipeError) {
      console.error('[fetchRecipeDetails] Error fetching recipe details:', recipeError.message);
      throw new Error('Failed to fetch recipe details');
    }

    if (!recipeData) {
      console.warn(`[fetchRecipeDetails] No recipe data returned for recipe ${recipeId}`);
      throw new Error('Recipe not found');
    }

    // Fetch pantry match data separately using calculate_pantry_match
    let pantryMatchData = null;
    if (userId) {
      const { data: pantryData, error: pantryError } = await supabase.rpc('calculate_pantry_match', {
        p_user_id: userId,
        p_recipe_id: recipeId
      });

      if (pantryError) {
        console.error('[fetchRecipeDetails] Error fetching pantry match:', pantryError.message);
        // Don't throw error, just use empty pantry data
        pantryMatchData = { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
      } else {
        pantryMatchData = pantryData || { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
      }
    } else {
      // No user logged in, use empty pantry data
      pantryMatchData = { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
    }

    console.log(`[fetchRecipeDetails] Pantry match data for recipe ${recipeId}:`, {
      match_percentage: pantryMatchData.match_percentage,
      matched_count: pantryMatchData.matched_ingredients?.length || 0,
      missing_count: pantryMatchData.missing_ingredients?.length || 0,
      total_count: (pantryMatchData.matched_ingredients?.length || 0) + (pantryMatchData.missing_ingredients?.length || 0)
    });

    // Combine recipe data with pantry match data
    const combinedData = {
      ...recipeData,
      pantry_match: pantryMatchData
    };

    // Process the combined data
    return await processRecipeDetailsData(combinedData, recipeId, userId, existingFeedData);
    
  } catch (error: any) {
    console.error('[fetchRecipeDetails] Exception caught:', error);
    throw error;
  }
};

// EMERGENCY FALLBACK: Fetch recipe details using alternative method
const fetchRecipeDetailsViaFallback = async (recipeId: string, userId?: string, existingFeedData?: any) => {
  console.log(`[fetchRecipeDetailsViaFallback] Using fallback method for recipe ${recipeId}`);
  
  try {
    // Use basic recipe query without user-specific data
    const { data: basicRecipe, error: basicError } = await supabase
      .from('recipes')
      .select(`
        recipe_id,
        title,
        user_id,
        servings,
        diet_tags,
        is_public,
        video_url,
        created_at,
        description,
        ingredients,
        cook_time_minutes,
        prep_time_minutes,
        preparation_steps,
        views_count
      `)
      .eq('recipe_id', recipeId)
      .single();
      
    if (basicError || !basicRecipe) {
      console.error('[fetchRecipeDetailsViaFallback] Basic recipe query failed:', basicError);
      throw new Error('Recipe not found');
    }
    
    // Get user info for creator
    let creatorInfo = null;
    if (basicRecipe.user_id) {
      const { data: creator } = await supabase
        .from('users')
        .select('username, avatar_url')
        .eq('id', basicRecipe.user_id)
        .single();
      creatorInfo = creator;
    }
    
    // Get like/save status if user is logged in
    let userInteractions = { is_liked: false, is_saved: false };
    let likesCount = 0;
    let commentsCount = 0;
    
    if (userId) {
      // Get user interactions
      const { data: interactions } = await supabase
        .from('user_interactions')
        .select('interaction_type')
        .eq('user_id', userId)
        .eq('recipe_id', recipeId);
        
      if (interactions) {
        userInteractions.is_liked = interactions.some(i => i.interaction_type === 'like');
      }
      
      // Check saved recipes
      const { data: savedRecipe } = await supabase
        .from('saved_recipes')
        .select('id')
        .eq('user_id', userId)
        .eq('recipe_id', recipeId)
        .single();
        
      userInteractions.is_saved = !!savedRecipe;
    }
    
    // Get total likes count
    const { count: totalLikes } = await supabase
      .from('user_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', recipeId)
      .eq('interaction_type', 'like');
      
    likesCount = totalLikes || 0;
    
    // Get comments count
    const { count: totalComments } = await supabase
      .from('recipe_comments')
      .select('*', { count: 'exact', head: true })
      .eq('recipe_id', recipeId);
      
    commentsCount = totalComments || 0;
    
    // Use feed data if available for more accurate counts
    if (existingFeedData) {
      likesCount = Math.max(likesCount, existingFeedData.likes || 0);
      commentsCount = Math.max(commentsCount, existingFeedData.commentsCount || 0);
      userInteractions.is_liked = existingFeedData.liked ?? userInteractions.is_liked;
      userInteractions.is_saved = existingFeedData.saved ?? userInteractions.is_saved;
    }
    
    // Construct fallback data structure
    const fallbackData = {
      ...basicRecipe,
      username: creatorInfo?.username || null,
      avatar_url: creatorInfo?.avatar_url || null,
      likes: likesCount,
      is_liked_by_user: userInteractions.is_liked,
      is_saved_by_user: userInteractions.is_saved,
      comments_count: commentsCount,
      // No pantry_match data - will be handled by separate pantry query
      pantry_match: null,
    };
    
    console.log(`[fetchRecipeDetailsViaFallback] Successfully constructed fallback data for recipe ${recipeId}`);
    return await processRecipeDetailsData(fallbackData, recipeId, userId, existingFeedData);
    
  } catch (fallbackError: any) {
    console.error('[fetchRecipeDetailsViaFallback] Fallback method also failed:', fallbackError);
    throw new Error(`Failed to fetch recipe details: ${fallbackError.message}`);
  }
};

// Process recipe details data (common logic)
const processRecipeDetailsData = async (data: any, recipeId: string, userId?: string, existingFeedData?: any) => {
  // Add detailed logging for like state and compare with feed data
  console.log(`[processRecipeDetailsData] Processing data for recipe ${recipeId}:`, {
    is_liked_by_user: data.is_liked_by_user,
    likes: data.likes,
    user_id: userId,
    has_pantry_match: !!data.pantry_match,
    timestamp: new Date().toISOString()
  });
  
  // Check for discrepancies with feed data
  if (existingFeedData && existingFeedData.likes !== data.likes) {
    console.warn(`[processRecipeDetailsData] LIKE COUNT DISCREPANCY for recipe ${recipeId}:`, {
      feed_likes: existingFeedData.likes,
      recipe_details_likes: data.likes,
      feed_liked: existingFeedData.liked,
      recipe_details_liked: data.is_liked_by_user,
      title: data.title,
      timestamp: new Date().toISOString()
    });
    
    // Use the higher like count as it's more likely to be correct
    if (existingFeedData.likes > data.likes) {
      console.log(`[processRecipeDetailsData] Using feed like count (${existingFeedData.likes}) instead of recipe details (${data.likes})`);
      data.likes = existingFeedData.likes;
    }
  }
  
  // Log raw and cleaned preparation steps for debugging
  console.log(`[processRecipeDetailsData] Raw data.preparation_steps for recipe ${recipeId}:`, JSON.stringify(data.preparation_steps));
  const cleanedSteps = (data.preparation_steps || []).map(
    (step: string) => step.replace(/^"+|"+$/g, '').trim()
  );
  console.log(`[processRecipeDetailsData] Cleaned preparation_steps for recipe ${recipeId}:`, JSON.stringify(cleanedSteps));
  
  // Return data including pantry_match from calculate_pantry_match
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
    is_liked_by_user: data.is_liked_by_user ?? false,
    is_saved_by_user: data.is_saved_by_user ?? false,
    comments_count: data.comments_count ?? 0,
    views_count: data.views_count ?? 0,
    // pantry_match from calculate_pantry_match RPC
    pantry_match: data.pantry_match || null,
    // Backward compatibility: extract from pantry_match
    matched_ingredients: data.pantry_match?.matched_ingredients || [],
    missing_ingredients: data.pantry_match?.missing_ingredients || [],
    missing_ingredient_names: data.pantry_match?.missing_ingredients || [],
  } as RecipeDetailsData;

  // Log pantry match data for debugging
  if (data.pantry_match) {
    console.log(`[processRecipeDetailsData] Final pantry match data for recipe ${recipeId}:`, {
      match_percentage: data.pantry_match.match_percentage,
      matched_count: data.pantry_match.matched_ingredients?.length || 0,
      missing_count: data.pantry_match.missing_ingredients?.length || 0,
      total_count: (data.pantry_match.matched_ingredients?.length || 0) + (data.pantry_match.missing_ingredients?.length || 0)
    });
  } else {
    console.log(`[processRecipeDetailsData] No pantry_match data for recipe ${recipeId}`);
  }

  return processedData;
};

// FALLBACK: This function provides pantry match data when the new pantry_match field is not available
// Will be removed once backend's unified pantry_match is fully deployed and working
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
  // Prefetch recipe details (now includes pantry_match)
  await queryClient.prefetchQuery({
    queryKey: ['recipeDetails', recipeId, userId],
    queryFn: () => fetchRecipeDetails(recipeId, userId, queryClient), // Pass queryClient
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // NOTE: No longer need to prefetch pantry match separately as it's included in get_recipe_details
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
      // RESTORED: Keep separate pantry match query as fallback during transition
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
  const pantryResult = results[1]; // RESTORED: pantryResult for fallback

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
  
  // HYBRID: Use pantry_match if available, fallback to separate pantry query
  const data = useMemo(() => {
    if (!recipeResult.data) return null;
    
    // Check if new pantry_match is available
    const pantryMatch = recipeResult.data.pantry_match;
    const hasPantryMatch = pantryMatch && (pantryMatch.matched_ingredients?.length > 0 || pantryMatch.missing_ingredients?.length > 0);
    
    if (hasPantryMatch) {
      // Use new unified pantry_match structure
      console.log(`[useRecipeDetails] Using NEW pantry_match for recipe ${recipeId}:`, {
        match_percentage: pantryMatch.match_percentage,
        matchedCount: pantryMatch.matched_ingredients.length,
        missingCount: pantryMatch.missing_ingredients.length,
        totalCount: pantryMatch.matched_ingredients.length + pantryMatch.missing_ingredients.length,
      });
      
      return recipeResult.data; // Already includes pantry_match and backward compatibility fields
    } else {
      // Fallback to separate pantry query (old working method)
      console.log(`[useRecipeDetails] Using FALLBACK pantry query for recipe ${recipeId}:`, {
        pantryResult_available: !!pantryResult.data,
        matchedCount: pantryResult.data?.matched_ingredients?.length || 0,
        missingCount: pantryResult.data?.missing_ingredients?.length || 0,
      });
      
      return {
        ...recipeResult.data,
        // Use fallback pantry data
        matched_ingredients: pantryResult.data?.matched_ingredients || [],
        missing_ingredients: pantryResult.data?.missing_ingredients || [],
        missing_ingredient_names: pantryResult.data?.missing_ingredients || [],
      } as RecipeDetailsData;
    }
  }, [recipeResult.data, pantryResult.data, recipeId]);

  // Restored refetch logic
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