import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { RecipeItem } from '../types';
import { useCacheManager } from './useCacheManager';
import { useAuth } from '../providers/AuthProvider';
// Removed complex retry logic - using React Query's built-in retry instead

// Interface for the raw item structure returned by the RPC
interface PantryMatch {
  match_percentage: number;
  matched_ingredients: string[];
  missing_ingredients: string[];
}

interface RawFeedItem {
  output_id: string;
  output_user_id: string;
  output_name: string;
  output_video_url: string;
  output_description: string;
  output_likes_count: number; // Updated for new RPC
  output_comments: any;
  output_created_at: string;
  output_dietary_category_ids: string[];
  user_name: string;
  output_is_liked: boolean;
  output_is_saved: boolean;
  pantry_match?: PantryMatch;
  output_feed_type: string;
  output_comments_count: number;
  out_creator_avatar_url: string;
  is_ai_generated: boolean; // New: Always false in enhanced feed
  following_creator: boolean; // New: Social signal
  algorithm_score: number; // New: Algorithm scoring
  engagement_velocity: number; // New: TikTok-style engagement
}

// Type for the enhanced feed V4 response structure
interface EnhancedFeedResponse {
  recipes: RawFeedItem[];
  algorithm_metadata: {
    ai_recipes_excluded: boolean;
    human_recipes_only: boolean;
    algorithm_version: string;
    personalization_confidence: number;
    time_context: string;
    current_hour: number;
    total_recipes_considered: number;
  };
}

// Renamed from FeedPageItem, removed cursor
export interface FeedItem extends RecipeItem {
  id: string; // Keep the original id property for compatibility
  video?: string; // Keep the original video property for compatibility
}

type FeedQueryKey = ['feed'];
const FEED_PAGE_LIMIT = 10; // Define a limit for the number of items to fetch

/**
 * Hook to fetch feed data using infinite scrolling.
 * Currently uses dummy data.
 */
export const useFeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
  const refreshedRecipeIds = useRef<Set<string>>(new Set());

  // NUCLEAR CACHE CLEAR: Remove all stale cached data with wrong field mappings
  useEffect(() => {
    if (user?.id) {
      console.log(
        '[useFeed] 🧹 NUCLEAR CACHE CLEAR - Removing stale cached data with wrong field mappings',
      );
      queryClient.clear(); // Clear ALL cached data to start fresh
    }
  }, [user?.id, queryClient]);

  const feedQuery = useQuery<FeedItem[]>({
    queryKey: ['feed'],
    retry: 3, // Retry 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('[useFeed] Fetching feed data for user:', user.id);

      // 🚀 ENHANCED FEED ALGORITHM V4 - NO AI RECIPES + TikTok-style personalization
      const { data, error } = await supabase.rpc(
        'get_enhanced_feed_v4',
        {
          user_id_param: user.id,
          session_context: {},
          feed_position: 0,
          time_context: 'general',
          limit_param: 50,
        },
      );

      if (error) {
        console.error('[useFeed] RPC Error after retries:', error);

        // Check if this is the known backend issue with missing likes column
        if (
          error.code === '42703' &&
          error.message?.includes('column r.likes does not exist')
        ) {
          console.error(
            '[useFeed] BACKEND ISSUE: The get_community_feed_pantry_match_v3 RPC is trying to access a "likes" column that does not exist in the recipes table.',
          );
          console.error('[useFeed] Backend team needs to fix this by either:');
          console.error(
            '[useFeed] 1. Adding likes column to recipes table, OR',
          );
          console.error(
            '[useFeed] 2. Calculating likes from recipe_likes table using COUNT()',
          );

          // Create a more user-friendly error message
          throw new Error(
            'Feed is temporarily unavailable due to a backend issue. Please try again later.',
          );
        }

        // Throw the original error
        throw error;
      }

      // 🚀 ENHANCED FEED V4: Handle new response structure
      if (!data || !data.recipes || !Array.isArray(data.recipes)) {
        console.warn('[useFeed] No recipes returned or recipes is not an array');
        return [];
      }

      const recipes = data.recipes;
      const metadata = data.algorithm_metadata;
      
      console.log(`[useFeed] ✅ Enhanced Feed V4 - Successfully fetched ${recipes.length} human recipes`);
      console.log('[useFeed] 🎯 Algorithm Metadata:', {
        ai_recipes_excluded: metadata?.ai_recipes_excluded,
        human_recipes_only: metadata?.human_recipes_only,
        algorithm_version: metadata?.algorithm_version,
        personalization_confidence: metadata?.personalization_confidence,
        time_context: metadata?.time_context
      });

      // CRITICAL BACKEND AUDIT: Show EVERY piece of like data from the first few items
      console.log('[useFeed] 🚨 CRITICAL BACKEND AUDIT - Raw RPC Response:');
      data.slice(0, 3).forEach((item, index) => {
        console.log(`[useFeed] 🔍 RAW ITEM ${index + 1}:`, {
          recipe_id: item.output_id,
          title: `${item.output_name?.substring(0, 25)}...`,
          RAW_output_likes: item.output_likes,
          RAW_output_is_liked: item.output_is_liked,
          RAW_output_is_saved: item.output_is_saved,
          RAW_output_comments_count: item.output_comments_count,
          type_of_likes: typeof item.output_likes,
          is_null_likes: item.output_likes === null,
          is_undefined_likes: item.output_likes === undefined,
        });
      });

      // Log pantry match statistics for debugging
      const pantryMatchStats = data
        .map(item => ({
          title: `${item.output_name?.substring(0, 30)}...`,
          userCount: item.pantry_match?.matched_ingredients?.length || 0,
          totalCount:
            (item.pantry_match?.matched_ingredients?.length || 0) +
            (item.pantry_match?.missing_ingredients?.length || 0),
          percentage: item.pantry_match?.match_percentage || 0,
        }))
        .filter(item => item.userCount > 0); // Only show items with matches

      if (pantryMatchStats.length > 0) {
        console.log(
          `[useFeed] Pantry matches found in ${pantryMatchStats.length} recipes:`,
          pantryMatchStats.slice(0, 3),
        );
      } else {
        console.log('[useFeed] No pantry matches found in current feed');
      }

      // Transform the data to match the expected FeedItem interface
      const transformedData: FeedItem[] = data.map((item, index) => {
        // Use new pantry_match structure
        const pantryMatchPct = item.pantry_match?.match_percentage || 0;
        const matchedCount =
          item.pantry_match?.matched_ingredients?.length || 0;
        const totalCount =
          (item.pantry_match?.matched_ingredients?.length || 0) +
          (item.pantry_match?.missing_ingredients?.length || 0);

        // Debug logging for pantry match (updated for new structure)
        if (matchedCount > 0 && pantryMatchPct === 0) {
          console.warn(
            `[useFeed] Pantry match discrepancy for ${item.output_name}: ${matchedCount}/${totalCount} ingredients matched but showing 0%`,
          );
        }

        // TRANSFORMATION AUDIT: Log for first few items to see what's happening
        if (index < 2) {
          console.log(`[useFeed] 🔄 TRANSFORMATION for recipe ${index + 1}:`, {
            raw_output_likes: item.output_likes,
            raw_output_is_liked: item.output_is_liked,
            transformed_likes: item.output_likes ?? 0,
            transformed_liked: item.output_is_liked ?? false,
            title: `${item.output_name?.substring(0, 20)}...`,
          });
        }

        // CHECK: Does feed RPC also use different field names?
        if (index < 1) {
          console.log(`[useFeed] 🔍 FEED RPC FIELD CHECK:`, {
            all_keys: Object.keys(item),
            has_recipe_details_likes: 'recipe_details_likes' in item,
            has_recipe_details_liked: 'recipe_details_liked' in item,
            output_likes_value: item.output_likes,
            output_is_liked_value: item.output_is_liked,
          });
        }

        return {
          id: item.output_id,
          recipe_id: item.output_id,
          title: item.output_name,
          video: item.output_video_url,
          video_url: item.output_video_url,
          description: item.output_description,
          likes: item.output_likes ?? 0, // Use nullish coalescing - 0 is a valid value!
          liked: item.output_is_liked ?? false, // Use nullish coalescing
          saved: item.output_is_saved ?? false, // Use nullish coalescing
          saves: 0,
          commentsCount: item.output_comments_count ?? 0, // Use nullish coalescing
          userName: item.user_name || 'Unknown User',
          creatorAvatarUrl: item.out_creator_avatar_url || null,
          creator_user_id: item.output_user_id,
          created_at: item.output_created_at,
          pantryMatchPct,
          _userIngredientsCount: matchedCount,
          _totalIngredientsCount: totalCount,
          source: item.output_feed_type as 'saved' | 'created_by_user' | 'feed',
        };
      });

      return transformedData;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return feedQuery;
};

/**
 * Function to refresh feed data when pantry changes occur
 * This ensures pantry match percentages are up-to-date
 */
export const refreshFeedPantryMatches = (queryClient: any) => {
  console.log('[useFeed] Refreshing feed pantry matches due to pantry changes');
  queryClient.invalidateQueries({ queryKey: ['feed'] });
};
