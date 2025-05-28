import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { RecipeItem } from '../types';
import { useEffect, useRef } from 'react';
import { useCacheManager } from './useCacheManager';
import { useAuth } from '../providers/AuthProvider';

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
  output_likes: number;
  output_comments: any; // Adjust type if known
  output_created_at: string;
  output_dietary_category_ids: string[]; // Adjust type if known
  user_name: string;
  output_is_liked: boolean;
  output_is_saved: boolean;
  pantry_match?: PantryMatch;  // NEW: Replaces output_user_ingredients_count and output_total_ingredients_count
  output_feed_type: string;
  output_comments_count: number;
  out_creator_avatar_url: string;
  // output_cursor is removed as it's not used by the RPC with p_limit
}

// Type for the structure returned by the RPC call (nested under "result")
interface RpcResponse {
  result: RawFeedItem[];
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

  const feedQuery = useQuery<FeedItem[]>({
    queryKey: ['feed'],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('[useFeed] Fetching feed data for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_community_feed_pantry_match_v3', {
        user_id_param: user.id,
        p_limit: 50,
        p_offset: 0
      });

      if (error) {
        console.error('[useFeed] RPC Error:', error);
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.warn('[useFeed] No data returned or data is not an array');
        return [];
      }

      console.log(`[useFeed] Successfully fetched ${data.length} feed items`);
      
      // Log pantry match statistics for debugging
      const pantryMatchStats = data.map(item => ({
        title: item.output_name?.substring(0, 30) + '...',
        userCount: item.pantry_match?.matched_ingredients?.length || 0,
        totalCount: (item.pantry_match?.matched_ingredients?.length || 0) + (item.pantry_match?.missing_ingredients?.length || 0),
        percentage: item.pantry_match?.match_percentage || 0
      })).filter(item => item.userCount > 0); // Only show items with matches
      
      if (pantryMatchStats.length > 0) {
        console.log(`[useFeed] Pantry matches found in ${pantryMatchStats.length} recipes:`, pantryMatchStats.slice(0, 3));
      } else {
        console.log('[useFeed] No pantry matches found in current feed');
      }
      
      // Transform the data to match the expected FeedItem interface
      const transformedData: FeedItem[] = data.map((item: RawFeedItem) => {
        // Use new pantry_match structure
        const pantryMatchPct = item.pantry_match?.match_percentage || 0;
        const matchedCount = item.pantry_match?.matched_ingredients?.length || 0;
        const totalCount = (item.pantry_match?.matched_ingredients?.length || 0) + (item.pantry_match?.missing_ingredients?.length || 0);

        // Debug logging for pantry match (updated for new structure)
        if (matchedCount > 0 && pantryMatchPct === 0) {
          console.warn(`[useFeed] Pantry match discrepancy for ${item.output_name}: ${matchedCount}/${totalCount} ingredients matched but showing 0%`);
        }

        return {
          id: item.output_id,
          recipe_id: item.output_id,
          title: item.output_name,
          video: item.output_video_url,
          video_url: item.output_video_url,
          description: item.output_description,
          likes: item.output_likes,
          liked: item.output_is_liked,
          saved: item.output_is_saved,
          saves: 0,
          commentsCount: item.output_comments_count,
          userName: item.user_name,
          creatorAvatarUrl: item.out_creator_avatar_url,
          creator_user_id: item.output_user_id,
          created_at: item.output_created_at,
          pantryMatchPct: pantryMatchPct,
          _userIngredientsCount: matchedCount,
          _totalIngredientsCount: totalCount,
          source: item.output_feed_type as 'saved' | 'created_by_user' | 'feed'
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