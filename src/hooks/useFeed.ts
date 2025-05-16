import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { RecipeItem } from '../types';

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
export interface FeedItem extends RecipeItem {}

type FeedQueryKey = ['feed'];
const FEED_PAGE_LIMIT = 10; // Define a limit for the number of items to fetch

/**
 * Hook to fetch feed data using infinite scrolling.
 * Currently uses dummy data.
 */
export const useFeed = () =>
  useQuery<
    FeedItem[], // Data type returned by queryFn
    Error,      // Error type
    FeedItem[], // QueryData type (usually same as TData)
    FeedQueryKey // QueryKey type
  >({
    queryKey: ['feed'],
    queryFn: async () => {
      console.log('Fetching feed with limit:', FEED_PAGE_LIMIT);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Auth error or no user:', authError);
        throw authError || new Error('User not authenticated');
      }
      const userIdParam = user.id;
      console.log('Calling RPC for user ID:', userIdParam);

      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_community_feed_pantry_match_v3', {
            user_id_param: userIdParam,
            p_limit: FEED_PAGE_LIMIT
        });

      if (rpcError) {
        console.error('Supabase RPC error (from client):', rpcError);
        throw rpcError;
      }

      console.log('Raw rpcData from client:', JSON.stringify(rpcData));

      let rawItems: RawFeedItem[] = [];
      if (Array.isArray(rpcData)) {
        rawItems = rpcData;
      } else if (rpcData && Array.isArray((rpcData as any).result)) {
        rawItems = (rpcData as any).result;
      } else if (rpcData && Array.isArray((rpcData as any).get_community_feed_pantry_match_v3)) {
        rawItems = (rpcData as any).get_community_feed_pantry_match_v3;
      } else if (rpcData) {
        console.warn('rpcData is an object but not in an expected array structure:', rpcData);
      }

      console.log('Extracted rawItems count:', rawItems.length);

      const mappedItems: FeedItem[] = rawItems.map(item => {
        const totalIngredients = item.output_total_ingredients_count;
        const userIngredients = item.output_user_ingredients_count;
        const pantryMatchPct = (totalIngredients > 0)
            ? Math.round((userIngredients / totalIngredients) * 100)
            : 0;

        return {
          id: item.output_id,
          title: item.output_name,
          video: item.output_video_url,
          description: item.output_description,
          liked: item.output_is_liked,
          likes: item.output_likes,
          saved: item.output_is_saved,
          userName: item.user_name,
          creatorAvatarUrl: item.out_creator_avatar_url,
          pantryMatchPct: pantryMatchPct,
          _userIngredientsCount: userIngredients,
          _totalIngredientsCount: totalIngredients,
          commentsCount: item.output_comments_count,
        };
      });

      return mappedItems;
    },
    // getNextPageParam and initialPageParam are removed as they are for useInfiniteQuery
    // No need for refetchInterval or other complex settings for now
  }); 