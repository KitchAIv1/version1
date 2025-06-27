import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';

// 🎯 FOLLOW DATA PRELOADER
// Industry best practice: Load follow data before user needs it

interface FollowDataPreloaderOptions {
  enabled?: boolean;
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Preloads follow-related data to improve perceived performance
 * 
 * WHEN TO USE:
 * - Profile screen initialization
 * - Before navigating to follower lists
 * - When user enters app (background loading)
 * 
 * BENEFITS:
 * - Eliminates follow button loading states
 * - Instant navigation to follower screens
 * - Better perceived performance
 */
export const useFollowDataPreloader = (
  userId?: string,
  options: FollowDataPreloaderOptions = {}
) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { enabled = true, priority = 'medium' } = options;

  const shouldPreload = enabled && userId && user?.id;

  // 🎯 1. PRELOAD FOLLOW COUNTS (Critical for UI layout)
  const { data: followCounts } = useQuery({
    queryKey: ['followCounts', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');

      console.log(`[useFollowDataPreloader] Preloading follow counts for ${userId}`);

      const { data, error } = await supabase.rpc('get_follow_counts', {
        user_id_param: userId,
      });

      if (error) {
        console.error('[useFollowDataPreloader] Error fetching follow counts:', error);
        return { followers: 0, following: 0 };
      }

      return {
        followers: data?.followers_count || 0,
        following: data?.following_count || 0,
      };
    },
    enabled: !!shouldPreload,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    // High priority for UI layout
    networkMode: priority === 'high' ? 'always' : 'online',
  });

  // 🎯 2. PRELOAD FOLLOW STATUS (For follow buttons)
  const { data: currentUserFollowStatus } = useQuery({
    queryKey: ['followStatus', user?.id, userId],
    queryFn: async () => {
      if (!user?.id || !userId || user.id === userId) {
        return { isFollowing: false };
      }

      console.log(`[useFollowDataPreloader] Preloading follow status: ${user.id} -> ${userId}`);

      const { data, error } = await supabase.rpc('get_follow_status', {
        follower_id_param: user.id,
        followed_id_param: userId,
      });

      if (error) {
        console.error('[useFollowDataPreloader] Error checking follow status:', error);
        return { isFollowing: false };
      }

      return { isFollowing: data?.is_following || false };
    },
    enabled: !!(shouldPreload && user?.id && userId && user.id !== userId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // 🎯 3. PRELOAD RECENT FOLLOWERS (For quick access)
  const preloadRecentFollowers = useCallback(async () => {
    if (!shouldPreload || priority === 'low') return;

    const isAlreadyCached = queryClient.getQueryData(['followers', userId]);
    if (isAlreadyCached) return;

    console.log(`[useFollowDataPreloader] Preloading recent followers for ${userId}`);

    queryClient.prefetchQuery({
      queryKey: ['followers', userId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_user_followers', {
          user_id_param: userId,
          limit_param: 20, // Only preload recent ones
        });

        if (error) {
          console.error('[useFollowDataPreloader] Error preloading followers:', error);
          return [];
        }

        return data || [];
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [shouldPreload, priority, queryClient, userId]);

  // 🎯 4. PRELOAD RECENT FOLLOWING (For quick access)
  const preloadRecentFollowing = useCallback(async () => {
    if (!shouldPreload || priority === 'low') return;

    const isAlreadyCached = queryClient.getQueryData(['following', userId]);
    if (isAlreadyCached) return;

    console.log(`[useFollowDataPreloader] Preloading recent following for ${userId}`);

    queryClient.prefetchQuery({
      queryKey: ['following', userId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_user_following', {
          user_id_param: userId,
          limit_param: 20, // Only preload recent ones
        });

        if (error) {
          console.error('[useFollowDataPreloader] Error preloading following:', error);
          return [];
        }

        return data || [];
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }, [shouldPreload, priority, queryClient, userId]);

  // 🎯 5. PRELOAD MUTUAL FOLLOWERS (Social proof)
  const preloadMutualFollowers = useCallback(async () => {
    if (!shouldPreload || !user?.id || user.id === userId || priority === 'low') return;

    const isAlreadyCached = queryClient.getQueryData(['mutualFollowers', user.id, userId]);
    if (isAlreadyCached) return;

    console.log(`[useFollowDataPreloader] Preloading mutual followers: ${user.id} <-> ${userId}`);

    queryClient.prefetchQuery({
      queryKey: ['mutualFollowers', user.id, userId],
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_mutual_followers', {
          user1_id: user.id,
          user2_id: userId,
          limit_param: 10,
        });

        if (error) {
          console.error('[useFollowDataPreloader] Error preloading mutual followers:', error);
          return [];
        }

        return data || [];
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  }, [shouldPreload, user?.id, userId, priority, queryClient]);

  // 🎯 6. TRIGGER PRELOADING BASED ON PRIORITY
  useEffect(() => {
    if (!shouldPreload) return;

    const preloadData = async () => {
      switch (priority) {
        case 'high':
          // Immediate preloading (user actively viewing profile)
          await Promise.all([
            preloadRecentFollowers(),
            preloadRecentFollowing(),
            preloadMutualFollowers(),
          ]);
          break;

        case 'medium':
          // Staggered preloading (user navigating to profile)
          setTimeout(() => preloadRecentFollowers(), 100);
          setTimeout(() => preloadRecentFollowing(), 200);
          setTimeout(() => preloadMutualFollowers(), 300);
          break;

        case 'low':
          // Background preloading (user might view profile)
          setTimeout(() => preloadRecentFollowers(), 1000);
          setTimeout(() => preloadRecentFollowing(), 1500);
          break;
      }
    };

    preloadData();
  }, [shouldPreload, priority, preloadRecentFollowers, preloadRecentFollowing, preloadMutualFollowers]);

  return {
    followCounts,
    currentUserFollowStatus,
    // Utility functions for manual preloading
    preloadFollowData: useCallback(() => {
      preloadRecentFollowers();
      preloadRecentFollowing();
      preloadMutualFollowers();
    }, [preloadRecentFollowers, preloadRecentFollowing, preloadMutualFollowers]),
    
    // Status indicators
    isPreloaded: !!(followCounts && currentUserFollowStatus),
    isPreloading: false, // Could track active preloading operations
  };
};

// 🎯 BULK FOLLOW STATUS PRELOADER
// For screens with multiple users (feed, followers list, etc.)
export const useBulkFollowStatusPreloader = (userIds: string[]) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || userIds.length === 0) return;

    // Batch preload follow statuses for multiple users
    const preloadBatch = async () => {
      const uncachedUserIds = userIds.filter(userId => {
        const cached = queryClient.getQueryData(['followStatus', user.id, userId]);
        return !cached && userId !== user.id;
      });

      if (uncachedUserIds.length === 0) return;

      console.log(`[useBulkFollowStatusPreloader] Preloading ${uncachedUserIds.length} follow statuses`);

      // In a real implementation, this would use a bulk API endpoint
      // For now, we'll stagger individual requests to avoid overwhelming the API
      uncachedUserIds.forEach((userId, index) => {
        setTimeout(() => {
          queryClient.prefetchQuery({
            queryKey: ['followStatus', user.id, userId],
            queryFn: async () => {
              const { data, error } = await supabase.rpc('get_follow_status', {
                follower_id_param: user.id,
                followed_id_param: userId,
              });

              if (error) return { isFollowing: false };
              return { isFollowing: data?.is_following || false };
            },
            staleTime: 30 * 1000,
          });
        }, index * 50); // Stagger by 50ms
      });
    };

    preloadBatch();
  }, [user?.id, userIds, queryClient]);
};

export default useFollowDataPreloader; 