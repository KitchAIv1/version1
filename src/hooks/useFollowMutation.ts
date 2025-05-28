import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

interface FollowMutationParams {
  targetUserId: string;
  action: 'follow' | 'unfollow';
}

interface FollowMutationResult {
  success: boolean;
  action: 'followed' | 'unfollowed';
  message?: string;
}

export const useFollowMutation = (currentUserId?: string) => {
  const queryClient = useQueryClient();
  
  return useMutation<FollowMutationResult, Error, FollowMutationParams>({
    mutationFn: async ({ targetUserId, action }: FollowMutationParams) => {
      console.log(`[useFollowMutation] ${action} user ${targetUserId}`);
      
      if (!currentUserId) {
        throw new Error('Current user ID is required for follow/unfollow actions');
      }
      
      const rpcFunction = action === 'follow' ? 'follow_user' : 'unfollow_user';
      
      const { data, error } = await supabase.rpc(rpcFunction, {
        p_follower_id: currentUserId,
        p_followed_id: targetUserId
      });
      
      if (error) {
        console.error(`[useFollowMutation] Error ${action}ing user:`, error);
        throw new Error(`Failed to ${action} user: ${error.message}`);
      }
      
      console.log(`[useFollowMutation] Successfully ${action}ed user ${targetUserId}`);
      
      return {
        success: true,
        action: action === 'follow' ? 'followed' : 'unfollowed'
      };
    },
    onSuccess: (data, { targetUserId, action }) => {
      console.log(`[useFollowMutation] Invalidating caches after ${action}`);
      
      // Invalidate profile caches to update follower counts
      queryClient.invalidateQueries({ queryKey: ['profile', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
      
      // Invalidate follow lists
      queryClient.invalidateQueries({ queryKey: ['followers', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['following', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['followers', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['following', targetUserId] });
      
      // Invalidate follow status
      queryClient.invalidateQueries({ queryKey: ['followStatus', currentUserId, targetUserId] });
      
      // Invalidate activity feed to show new follow activity
      queryClient.invalidateQueries({ queryKey: ['userActivityFeed', currentUserId] });
    },
    onError: (error, { action }) => {
      console.error(`[useFollowMutation] Failed to ${action} user:`, error);
    }
  });
};

// Hook to check follow status
export const useFollowStatus = (currentUserId?: string, targetUserId?: string) => {
  return useQuery({
    queryKey: ['followStatus', currentUserId, targetUserId],
    queryFn: async () => {
      if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
        return { isFollowing: false };
      }
      
      console.log(`[useFollowStatus] Checking if ${currentUserId} follows ${targetUserId}`);
      
      const { data, error } = await supabase.rpc('get_follow_status', {
        p_follower_id: currentUserId,
        p_followed_id: targetUserId
      });
      
      if (error) {
        console.error('[useFollowStatus] Error checking follow status:', error);
        return { isFollowing: false };
      }
      
      return { isFollowing: data || false };
    },
    enabled: !!currentUserId && !!targetUserId && currentUserId !== targetUserId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook to get follower/following lists
export const useFollowersList = (userId?: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['followers', userId, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      console.log(`[useFollowersList] Fetching followers for user ${userId}`);
      
      const { data, error } = await supabase.rpc('get_user_followers', {
        p_user_id: userId,
        p_limit: limit
      });
      
      if (error) {
        console.error('[useFollowersList] Error fetching followers:', error);
        throw new Error(`Failed to fetch followers: ${error.message}`);
      }
      
      return data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useFollowingList = (userId?: string, limit: number = 50) => {
  return useQuery({
    queryKey: ['following', userId, limit],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      
      console.log(`[useFollowingList] Fetching following for user ${userId}`);
      
      const { data, error } = await supabase.rpc('get_user_following', {
        p_user_id: userId,
        p_limit: limit
      });
      
      if (error) {
        console.error('[useFollowingList] Error fetching following:', error);
        throw new Error(`Failed to fetch following: ${error.message}`);
      }
      
      return data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}; 