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
  thumbnail_url?: string | null;   // For AI recipes and regular recipe thumbnails
  is_ai_generated?: boolean;       // To identify AI-generated recipes
  difficulty?: string | null;      // Recipe difficulty level
  estimated_cost?: string | null;  // Cost estimate
  nutrition_notes?: string | null; // Nutrition information
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

// Clean pantry match data to handle backend RPC format issues
const cleanPantryMatchData = (pantryData: any, recipeId: string) => {
  if (!pantryData) {
    console.warn(`[cleanPantryMatchData] No pantry data received for recipe ${recipeId}`);
    return { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
  }

  try {
    // Handle matched_ingredients array
    let matchedIngredients: string[] = [];
    if (Array.isArray(pantryData.matched_ingredients)) {
      matchedIngredients = pantryData.matched_ingredients
        .filter((item: any) => item != null && item !== undefined) // Remove null/undefined
        .map((item: any) => {
          // Handle both string and object formats
          if (typeof item === 'string') {
            return item.trim();
          } else if (typeof item === 'object' && item.name) {
            return item.name.trim();
          } else {
            console.warn(`[cleanPantryMatchData] Invalid matched ingredient format for recipe ${recipeId}:`, item);
            return null;
          }
        })
        .filter((name: any) => name && name.length > 0); // Remove empty strings
    }

    // Handle missing_ingredients array
    let missingIngredients: string[] = [];
    if (Array.isArray(pantryData.missing_ingredients)) {
      missingIngredients = pantryData.missing_ingredients
        .filter((item: any) => item != null && item !== undefined) // Remove null/undefined
        .map((item: any) => {
          // Handle both string and object formats
          if (typeof item === 'string') {
            return item.trim();
          } else if (typeof item === 'object' && item.name) {
            return item.name.trim();
          } else {
            console.warn(`[cleanPantryMatchData] Invalid missing ingredient format for recipe ${recipeId}:`, item);
            return null;
          }
        })
        .filter((name: any) => name && name.length > 0); // Remove empty strings
    }

    const totalIngredients = matchedIngredients.length + missingIngredients.length;
    const matchPercentage = totalIngredients > 0 
      ? Math.round((matchedIngredients.length / totalIngredients) * 100)
      : 0;

    console.log(`[cleanPantryMatchData] Cleaned pantry data for recipe ${recipeId}:`, {
      original_matched_count: pantryData.matched_ingredients?.length || 0,
      cleaned_matched_count: matchedIngredients.length,
      original_missing_count: pantryData.missing_ingredients?.length || 0,
      cleaned_missing_count: missingIngredients.length,
      calculated_percentage: matchPercentage,
      backend_percentage: pantryData.match_percentage
    });

    return {
      match_percentage: pantryData.match_percentage || matchPercentage,
      matched_ingredients: matchedIngredients,
      missing_ingredients: missingIngredients
    };

  } catch (error) {
    console.error(`[cleanPantryMatchData] Error cleaning pantry data for recipe ${recipeId}:`, error);
    return { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
  }
};

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

    // BACKEND AUDIT: Log what recipe details RPC returns for likes
    console.log(`[fetchRecipeDetails] 🔍 RECIPE DETAILS AUDIT for ${recipeId}:`, {
      likes: recipeData.likes,
      is_liked_by_user: recipeData.is_liked_by_user,
      is_saved_by_user: recipeData.is_saved_by_user,
      comments_count: recipeData.comments_count,
      title: recipeData.title?.substring(0, 30) + '...'
    });

    // CRITICAL: Show raw data types and values
    console.log(`[fetchRecipeDetails] 🚨 RAW RECIPE DETAILS DATA for ${recipeId}:`, {
      RAW_likes: recipeData.likes,
      RAW_is_liked_by_user: recipeData.is_liked_by_user,
      type_of_likes: typeof recipeData.likes,
      is_null_likes: recipeData.likes === null,
      is_undefined_likes: recipeData.likes === undefined,
      type_of_liked: typeof recipeData.is_liked_by_user,
      is_null_liked: recipeData.is_liked_by_user === null,
      COMPLETE_DATA_KEYS: Object.keys(recipeData)
    });

    // FIELD MAPPING FIX: Use correct backend field names
    console.log(`[fetchRecipeDetails] 🔧 CORRECT FIELD MAPPING for ${recipeId}:`, {
      recipe_details_likes: recipeData.recipe_details_likes,
      recipe_details_liked: recipeData.recipe_details_liked,
      backend_actually_works: "YES!"
    });

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
        // Clean and process pantry data to handle backend RPC data format issues
        const cleanedPantryData = cleanPantryMatchData(pantryData, recipeId);
        pantryMatchData = cleanedPantryData || { match_percentage: 0, matched_ingredients: [], missing_ingredients: [] };
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

    // Verify like fields are present (should now be included from backend)
    if (combinedData.is_liked_by_user === undefined || combinedData.likes === undefined) {
      console.warn(`[fetchRecipeDetails] Like fields missing from get_recipe_details RPC for recipe ${recipeId}. This should now be resolved.`);
      // Set defaults if still missing
      combinedData.is_liked_by_user = false;
      combinedData.likes = 0;
    }

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
  // Check for discrepancies with feed data
  if (existingFeedData && existingFeedData.likes !== data.likes) {
    console.warn(`[processRecipeDetailsData] LIKE COUNT DISCREPANCY for recipe ${recipeId}:`, {
      feed_likes: existingFeedData.likes,
      recipe_details_likes: data.recipe_details_likes,
      feed_liked: existingFeedData.liked,
      recipe_details_liked: data.recipe_details_liked,
      title: data.title
    });
    
    // Use the higher like count as it's more likely to be correct
    if (existingFeedData.likes > data.likes) {
      console.log(`[processRecipeDetailsData] Using feed like count (${existingFeedData.likes}) instead of recipe details (${data.likes})`);
      data.likes = existingFeedData.likes;
    }
  }
  
  // Clean preparation steps
  const cleanedSteps = (data.preparation_steps || []).map(
    (step: string) => step.replace(/^"+|"+$/g, '').trim()
  );
  
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
    // FIX: Use correct backend field names for likes
    likes: data.recipe_details_likes ?? data.likes ?? 0,  // Backend uses recipe_details_likes
    is_liked_by_user: data.recipe_details_liked ?? data.is_liked_by_user ?? false,  // Backend uses recipe_details_liked
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

  // SIMPLE CACHE SYNC: Prevent race conditions by only updating feed if recipe details has BETTER data
  useEffect(() => {
    if (recipeResult.data && recipeId) {
      console.log(`[useRecipeDetails] 🔄 ALWAYS SYNC - Backend fixed, syncing all data for recipe ${recipeId}:`, {
        recipe_comments: recipeResult.data.comments_count,
        recipe_likes: recipeResult.data.likes,
        recipe_liked: recipeResult.data.is_liked_by_user,
        recipe_saved: recipeResult.data.is_saved_by_user
      });

      // SMART SYNC: Only update feed if recipe details data is fresher
      queryClient.setQueryData(['feed'], (oldFeedData: any) => {
        if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
        
        return oldFeedData.map((item: any) => {
          if (item.id === recipeId || item.recipe_id === recipeId) {
            // SMART COMMENT SYNC: Don't overwrite higher comment counts (indicates fresh data)
            const shouldSyncComments = (recipeResult.data.comments_count >= (item.commentsCount || 0));
            const finalCommentCount = shouldSyncComments ? recipeResult.data.comments_count : item.commentsCount;
            
            console.log(`[useRecipeDetails] 📊 Syncing feed item for recipe ${recipeId}:`, {
              from_feed_likes: item.likes,
              to_recipe_likes: recipeResult.data.likes,
              from_feed_liked: item.liked,
              to_recipe_liked: recipeResult.data.is_liked_by_user,
              from_feed_saved: item.saved,
              to_recipe_saved: recipeResult.data.is_saved_by_user,
              from_feed_comments: item.commentsCount,
              to_recipe_comments: recipeResult.data.comments_count,
              final_comment_count: finalCommentCount,
              comments_sync_decision: shouldSyncComments ? 'SYNC' : 'KEEP_FEED'
            });
            
            return {
              ...item,
              likes: recipeResult.data.likes,
              liked: recipeResult.data.is_liked_by_user,
              saved: recipeResult.data.is_saved_by_user,
              commentsCount: finalCommentCount  // Smart comment sync
            };
          }
          return item;
        });
      });
    }
  }, [recipeResult.data, recipeId, queryClient]);

  // REVERSE SYNC: Update recipe details when feed data changes (for like/save mutations from feed)
  useEffect(() => {
    const feedData = queryClient.getQueryData(['feed']) as any[];
    if (feedData && recipeId && userId && recipeResult.data) {
      const feedItem = feedData.find((item: any) => item.id === recipeId || item.recipe_id === recipeId);
      
      if (feedItem) {
        // Check if feed has more recent interaction data
        const feedLiked = feedItem.liked;
        const feedSaved = feedItem.saved;
        const feedLikes = feedItem.likes;
        const feedComments = feedItem.commentsCount;
        
        const currentRecipeData = recipeResult.data;
        
        // Only update if there's a discrepancy (feed is more recent)
        if (feedLiked !== currentRecipeData.is_liked_by_user || 
            feedSaved !== currentRecipeData.is_saved_by_user ||
            feedLikes !== currentRecipeData.likes ||
            feedComments !== currentRecipeData.comments_count) {
          
          console.log(`[useRecipeDetails] Reverse sync: updating recipe details from feed for recipe ${recipeId}:`, {
            feed_liked: feedLiked,
            recipe_liked: currentRecipeData.is_liked_by_user,
            feed_saved: feedSaved,
            recipe_saved: currentRecipeData.is_saved_by_user,
            feed_likes: feedLikes,
            recipe_likes: currentRecipeData.likes,
            feed_comments: feedComments,
            recipe_comments: currentRecipeData.comments_count
          });
          
          queryClient.setQueryData(['recipeDetails', recipeId, userId], (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              is_liked_by_user: feedLiked,
              is_saved_by_user: feedSaved,
              likes: feedLikes,
              comments_count: feedComments
            };
          });
        }
      }
    }
  }, [queryClient, recipeId, userId, recipeResult.data]);

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