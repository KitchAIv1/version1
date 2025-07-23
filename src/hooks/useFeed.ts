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
 * Enhanced Feed V4 Hook - TikTok-Style Feed with Pantry Matching
 * 
 * Fetches community feed with advanced algorithms and real-time pantry matching.
 * Implements sophisticated caching, error handling, and performance optimization
 * for a seamless TikTok-style user experience.
 * 
 * @returns {Object} Feed data and state
 * @returns {FeedItem[]} data - Array of feed items with pantry matching data
 * @returns {boolean} isLoading - Loading state indicator
 * @returns {Error | null} error - Error state if feed fetch fails
 * @returns {() => Promise<void>} refetch - Function to manually refetch feed data
 * 
 * @example
 * ```typescript
 * const { data: feedData, isLoading, error, refetch } = useFeed();
 * 
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <FlatList 
 *     data={feedData} 
 *     renderItem={({ item }) => <RecipeCard item={item} />}
 *   />
 * );
 * ```
 * 
 * @since 4.0.0 Enhanced Feed V4 implementation
 * @architectural_decision Uses TikTok-style feed algorithm for maximum engagement
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

      console.log('[useFeed] 🚀 Fetching Enhanced Feed V4 for user:', user.id);

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
        console.error('[useFeed] Enhanced Feed V4 Error:', error);
        throw error;
      }

      // 🚀 ENHANCED FEED V4: Handle new response structure
      const feedResponse = data as EnhancedFeedResponse;
      
      if (!feedResponse || !feedResponse.recipes || !Array.isArray(feedResponse.recipes)) {
        console.warn('[useFeed] No recipes returned or recipes is not an array');
        return [];
      }

      const recipes = feedResponse.recipes;
      const metadata = feedResponse.algorithm_metadata;
      
      console.log(`[useFeed] ✅ Enhanced Feed V4 - Successfully fetched ${recipes.length} human recipes`);
      console.log('[useFeed] 🎯 Algorithm Metadata:', {
        ai_recipes_excluded: metadata?.ai_recipes_excluded,
        human_recipes_only: metadata?.human_recipes_only,
        algorithm_version: metadata?.algorithm_version,
        personalization_confidence: metadata?.personalization_confidence,
        time_context: metadata?.time_context,
        total_considered: metadata?.total_recipes_considered
      });

      // Log enhanced feed statistics
      recipes.slice(0, 3).forEach((item, index) => {
        console.log(`[useFeed] 🔍 ENHANCED ITEM ${index + 1}:`, {
          recipe_id: item.output_id,
          title: `${item.output_name?.substring(0, 25)}...`,
          is_ai_generated: item.is_ai_generated, // Should always be false
          algorithm_score: item.algorithm_score,
          engagement_velocity: item.engagement_velocity,
          feed_type: item.output_feed_type,
          following_creator: item.following_creator,
          likes_count: item.output_likes_count,
          is_liked: item.output_is_liked,
        });
      });



      // Transform the data to match the expected FeedItem interface
      const transformedData: FeedItem[] = recipes.map((item, index) => {
        // 🔍 CRITICAL FIX: Properly extract pantry match data from V4 RPC
        const pantryMatch = item.pantry_match;
        const pantryMatchPct = pantryMatch?.match_percentage || 0;
        const matchedCount = pantryMatch?.matched_ingredients?.length || 0;
        const missingCount = pantryMatch?.missing_ingredients?.length || 0;
        const totalCount = matchedCount + missingCount;

        // 🚨 DEBUG: Log pantry data for recipes that should have matches
        if (index < 3) {
          console.log(`[useFeed] 🔍 Recipe ${index + 1} Pantry Debug:`, {
            recipe_id: item.output_id,
            title: item.output_name?.substring(0, 30),
            pantryMatch_object: !!pantryMatch,
            match_percentage: pantryMatchPct,
            matched_count: matchedCount,
            missing_count: missingCount,
            total_count: totalCount,
            matched_ingredients: pantryMatch?.matched_ingredients?.slice(0, 3), // First 3 ingredients
            missing_ingredients: pantryMatch?.missing_ingredients?.slice(0, 3), // First 3 ingredients
          });
        }

        return {
          id: item.output_id,
          recipe_id: item.output_id,
          title: item.output_name,
          video: item.output_video_url,
          video_url: item.output_video_url,
          description: item.output_description,
          likes: item.output_likes_count ?? 0, // Updated field name
          liked: item.output_is_liked ?? false,
          saved: item.output_is_saved ?? false,
          saves: 0,
          commentsCount: item.output_comments_count ?? 0,
          userName: item.user_name || 'Unknown User',
          creatorAvatarUrl: item.out_creator_avatar_url || null,
          creator_user_id: item.output_user_id,
          created_at: item.output_created_at,
          pantryMatchPct,
          _userIngredientsCount: matchedCount,
          _totalIngredientsCount: totalCount,
          source: item.output_feed_type as 'saved' | 'created_by_user' | 'feed',
          // Enhanced feed metadata
          _enhancedMeta: {
            algorithm_score: item.algorithm_score,
            engagement_velocity: item.engagement_velocity,
            is_ai_generated: item.is_ai_generated,
            following_creator: item.following_creator,
          }
        };
      });

      console.log(`[useFeed] ✅ Enhanced Feed V4 transformation complete: ${transformedData.length} recipes ready`);
      return transformedData;
    },
    enabled: !!user?.id,
    // 🚀 OPTIMIZED: Extended cache times for video loading performance
    staleTime: 8 * 60 * 1000, // 8 minutes (was 2 minutes) - reduces background fetching
    gcTime: 20 * 60 * 1000, // 20 minutes (was 10 minutes) - longer cache retention
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Use cached data for faster video loading
  });

  return feedQuery;
};

/**
 * Function to refresh feed data when pantry changes occur
 * This ensures pantry match percentages are up-to-date
 */
export const refreshFeedPantryMatches = (queryClient: any) => {
  console.log('[useFeed] Refreshing Enhanced Feed V4 pantry matches due to pantry changes');
  queryClient.invalidateQueries({ queryKey: ['feed'] });
};
