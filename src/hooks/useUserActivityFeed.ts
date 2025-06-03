import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export interface ActivityItem {
  id?: string;
  user_id?: string;
  activity_type:
    | 'saved_recipe'
    | 'planned_meal'
    | 'generated_recipe'
    | 'added_to_grocery'
    | 'cooked_recipe'
    | 'manual_pantry_add'
    | 'successful_scan'
    | 'pantry_update';
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

// Group scanning activities that happen within a short time window
const groupScanningActivities = (
  activities: ActivityItem[],
): ActivityItem[] => {
  const grouped: ActivityItem[] = [];
  const scanningTypes = [
    'manual_pantry_add',
    'successful_scan',
    'pantry_update',
  ];
  const timeWindowMs = 30 * 1000; // 30 seconds

  for (let i = 0; i < activities.length; i++) {
    const currentActivity = activities[i];

    // If it's not a scanning activity, add it as-is
    if (!scanningTypes.includes(currentActivity.activity_type)) {
      grouped.push(currentActivity);
      continue;
    }

    // Look for other scanning activities within the time window
    const relatedActivities = [currentActivity];
    const currentTime = new Date(currentActivity.created_at).getTime();

    // Check subsequent activities within time window
    for (let j = i + 1; j < activities.length; j++) {
      const nextActivity = activities[j];
      const nextTime = new Date(nextActivity.created_at).getTime();

      // If outside time window, stop looking
      if (Math.abs(currentTime - nextTime) > timeWindowMs) break;

      // If it's a scanning activity, group it
      if (scanningTypes.includes(nextActivity.activity_type)) {
        relatedActivities.push(nextActivity);
      }
    }

    // If we found related activities, create a grouped activity
    if (relatedActivities.length > 1) {
      const groupedActivity: ActivityItem = {
        id: `grouped-${currentActivity.id}`,
        activity_type: 'successful_scan', // Use successful_scan as the primary type
        created_at: currentActivity.created_at,
        metadata: {
          ...currentActivity.metadata,
          grouped_activities: relatedActivities,
          total_items: relatedActivities.length,
          activity_types: relatedActivities.map(a => a.activity_type),
          item_names: relatedActivities
            .map(a => a.metadata?.item_name)
            .filter(Boolean)
            .slice(0, 3), // Show first 3 items
        },
      };

      grouped.push(groupedActivity);

      // Skip the activities we just grouped
      i += relatedActivities.length - 1;
    } else {
      // Single activity, add as-is
      grouped.push(currentActivity);
    }
  }

  return grouped;
};

export const useUserActivityFeed = (
  userId: string | undefined,
): UseUserActivityFeedResult => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['userActivityFeed', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      console.log(
        `[useUserActivityFeed] Fetching activity feed for user: ${userId}`,
      );

      const { data: activityData, error: rpcError } = await supabase.rpc(
        'get_user_activity_feed',
        {
          p_user_id: userId,
          p_limit: 50, // Fetch last 50 activities
        },
      );

      if (rpcError) {
        console.error('[useUserActivityFeed] RPC Error:', rpcError);
        throw new Error(`Failed to fetch activity feed: ${rpcError.message}`);
      }

      if (!activityData) {
        console.warn('[useUserActivityFeed] No activity data returned');
        return [];
      }

      console.log(
        `[useUserActivityFeed] Fetched ${activityData.length} activity items`,
      );

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
          ...item.metadata,
        },
      }));

      // Group scanning activities that happen within 30 seconds of each other
      const groupedData = groupScanningActivities(transformedData);

      return groupedData;
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
