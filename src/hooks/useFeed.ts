import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { RecipeItem } from '../types';
import { useEffect, useRef } from 'react';
import { useCacheManager } from './useCacheManager';
import { useAuth } from '../providers/AuthProvider';

// Interface for the raw item structure returned by the RPC
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
  output_user_ingredients_count: number;
  output_total_ingredients_count: number;
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
  const queryClient = useQueryClient();
  const cacheManager = useCacheManager();
  const { user } = useAuth();
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
        p_limit: 50
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
      
      // Debug: Log comment counts from RPC to identify the issue
      console.log('[useFeed] Comment count debugging:', data.slice(0, 3).map(item => ({
        recipe_id: item.output_id,
        title: item.output_name,
        raw_comments_count: item.output_comments_count,
        raw_comments_field: item.output_comments
      })));
      
      // Enhanced debugging: Show ALL comment counts to identify the pattern
      const commentCountAnalysis = data.map(item => ({
        recipe_id: item.output_id,
        title: item.output_name?.substring(0, 30) + '...',
        comments_count: item.output_comments_count,
        has_comments_field: item.output_comments !== undefined,
        created_at: item.output_created_at
      }));
      
      console.log('[useFeed] FULL Comment Count Analysis:', commentCountAnalysis);
      
      const zeroCommentItems = commentCountAnalysis.filter(item => item.comments_count === 0);
      const nonZeroCommentItems = commentCountAnalysis.filter(item => item.comments_count > 0);
      
      console.log(`[useFeed] Comment Count Summary: ${nonZeroCommentItems.length} items with comments, ${zeroCommentItems.length} items with 0 comments`);
      
      if (zeroCommentItems.length > 0) {
        console.log('[useFeed] Items with 0 comments (potential issues):', zeroCommentItems.slice(0, 5));
      }
      
      if (nonZeroCommentItems.length > 0) {
        console.log('[useFeed] Items with comments (working correctly):', nonZeroCommentItems.slice(0, 3));
      }
      
      // Transform the data to match the expected FeedItem interface
      const transformedData: FeedItem[] = data.map((item: RawFeedItem) => ({
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
        created_at: item.output_created_at,
        pantryMatchPct: Math.round((item.output_user_ingredients_count / item.output_total_ingredients_count) * 100),
        _userIngredientsCount: item.output_user_ingredients_count,
        _totalIngredientsCount: item.output_total_ingredients_count,
        source: item.output_feed_type as 'saved' | 'created_by_user' | 'feed'
      }));

      return transformedData;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Fix comment counts for items showing 0 comments using the accurate RPC
  useEffect(() => {
    if (!feedQuery.data || !Array.isArray(feedQuery.data) || !user?.id) return;
    
    console.log('[useFeed] Checking for items with 0 comment counts to refresh');
    
    // Find items with 0 comments that might need refreshing (exclude already refreshed)
    const itemsNeedingRefresh = feedQuery.data.filter((item: FeedItem) => {
      const recipeId = item.id || item.recipe_id;
      return item.commentsCount === 0 && recipeId && !refreshedRecipeIds.current.has(recipeId);
    });
    
    if (itemsNeedingRefresh.length === 0) {
      console.log('[useFeed] No items need comment count refresh');
      return;
    }
    
    console.log(`[useFeed] Found ${itemsNeedingRefresh.length} items with 0 comments, refreshing first 5`);
    
    // Refresh comment counts for the first 5 items (increased from 3)
    const itemsToRefresh = itemsNeedingRefresh.slice(0, 5);
    
    const refreshCommentCounts = async () => {
      for (const item of itemsToRefresh) {
        const recipeId = item.id || item.recipe_id;
        if (!recipeId) continue;
        
        try {
          console.log(`[useFeed] Refreshing comment count for recipe ${recipeId}`);
          
          // Use the same RPC that recipe details uses for accurate comment counts
          const { data: recipeData, error } = await supabase.rpc('get_recipe_details', {
            p_recipe_id: recipeId,
            p_user_id: user.id
          });
          
          if (error) {
            console.error(`[useFeed] Error refreshing comment count for recipe ${recipeId}:`, error);
            continue;
          }
          
          if (recipeData && recipeData.comments_count !== undefined) {
            const actualCommentCount = recipeData.comments_count;
            console.log(`[useFeed] Recipe ${recipeId} actual comment count: ${actualCommentCount} (was showing 0)`);
            
            // Update the feed cache with the correct comment count
            queryClient.setQueryData(['feed'], (oldFeedData: any) => {
              if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
              
              return oldFeedData.map((feedItem: any) => {
                if (feedItem.id === recipeId || feedItem.recipe_id === recipeId) {
                  return {
                    ...feedItem,
                    commentsCount: actualCommentCount
                  };
                }
                return feedItem;
              });
            });
          }
        } catch (error) {
          console.error(`[useFeed] Exception refreshing comment count for recipe ${recipeId}:`, error);
        }
        
        // Mark this recipe as refreshed to avoid repeated attempts
        refreshedRecipeIds.current.add(recipeId);
        
        // Add a small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    
    // Debounce the refresh to avoid excessive calls (reduced for faster response)
    const timeoutId = setTimeout(refreshCommentCounts, 500);
    
    return () => clearTimeout(timeoutId);
  }, [feedQuery.data?.length, user?.id, queryClient]); // Only depend on data length and user ID

  return feedQuery;
}; 