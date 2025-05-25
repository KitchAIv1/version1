import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export interface ActivityItem {
  id?: string;
  user_id?: string;
  activity_type: 'saved_recipe' | 'planned_meal' | 'generated_recipe' | 'added_to_grocery' | 'cooked_recipe' | 'manual_pantry_add' | 'successful_scan' | 'pantry_update';
  metadata: {
    recipe_id?: string;
    recipe_title?: string;
    recipe_name?: string;
    recipe_thumbnail?: string;
    thumbnail_url?: string;
    meal_slot?: string;
    meal_date?: string;
    grocery_item?: string;
    item_name?: string;
    plan_date?: string;
    slot?: string;
    action?: string;
    new_quantity?: number;
    old_quantity?: number;
    scan_type?: string;
    items_count?: number;
    [key: string]: any;
  };
  created_at: string;
}

// Raw response interface from RPC
interface RawActivityItem {
  type: string;
  timestamp: string;
  recipe_id?: string;
  recipe_title?: string;
  recipe_thumbnail?: string;
  metadata?: {
    [key: string]: any;
  };
  [key: string]: any;
}

export interface UseUserActivityFeedResult {
  data: ActivityItem[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useUserActivityFeed = (userId: string | undefined): UseUserActivityFeedResult => {
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['userActivityFeed', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      console.log(`[useUserActivityFeed] Fetching activity feed for user: ${userId}`);
      
      const { data: activityData, error: rpcError } = await supabase.rpc('get_user_activity_feed', {
        p_user_id: userId,
        p_limit: 50 // Fetch last 50 activities
      });
      
      if (rpcError) {
        console.error('[useUserActivityFeed] RPC Error:', rpcError);
        throw new Error(`Failed to fetch activity feed: ${rpcError.message}`);
      }
      
      if (!activityData) {
        console.warn('[useUserActivityFeed] No activity data returned');
        return [];
      }
      
      console.log(`[useUserActivityFeed] Fetched ${activityData.length} activity items`);
      
      // Transform the data to match the expected format
      const transformedData = activityData.map((item: any) => ({
        id: `activity-${item.timestamp || Date.now()}`,
        activity_type: item.type as ActivityItem['activity_type'],
        created_at: item.timestamp,
        metadata: {
          recipe_id: item.recipe_id,
          recipe_title: item.recipe_title,
          recipe_name: item.recipe_title, // fallback
          recipe_thumbnail: item.recipe_thumbnail,
          thumbnail_url: item.recipe_thumbnail, // fallback
          ...item.metadata
        }
      }));
      
      return transformedData;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: data || null,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  };
};

export default useUserActivityFeed; 