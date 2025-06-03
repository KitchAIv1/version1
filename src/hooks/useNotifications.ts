import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// Global notification types based on backend
export type NotificationType =
  | 'aging_alert'
  | 'review_prompt'
  | 'meal_plan_ready'
  | 'recipe_liked'
  | 'recipe_commented'
  | 'new_follower'
  | 'feature_announcement'
  | 'maintenance_notice'
  | 'upgrade_prompt';

export interface GlobalNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: {
    [key: string]: any;
    // For aging alerts
    item_name?: string;
    days_old?: number;
    age_group?: 'red' | 'yellow' | 'green';
    stock_item_id?: string;
    // For recipe interactions
    recipe_id?: string;
    recipe_title?: string;
    commenter_username?: string;
    // For social interactions
    follower_username?: string;
    follower_id?: string;
    // For app features
    feature_name?: string;
    action_url?: string;
  };
  read: boolean;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  action_url?: string; // For deep linking
  expires_at?: string; // For temporary notifications
  created_at: string;
}

/**
 * Hook to fetch all notifications for a user
 * Handles graceful fallback when table schema isn't ready
 */
export const useNotifications = (userId?: string) => {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async (): Promise<GlobalNotification[]> => {
      if (!userId) throw new Error('User ID is required');

      console.log(
        '[useNotifications] Fetching notifications for user:',
        userId,
      );

      try {
        // Try to fetch with proper schema
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100); // Limit to recent notifications

        if (error) {
          // Check if the error is due to missing columns
          if (error.code === '42703') {
            console.warn(
              '[useNotifications] Schema issue detected, trying fallback approach',
            );

            // Try with minimal schema (id, user_id, message, created_at, read)
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('notifications')
              .select('id, user_id, message, created_at, read')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(100);

            if (fallbackError) {
              console.error(
                '[useNotifications] Fallback query failed:',
                fallbackError,
              );
              return [];
            }

            // Transform minimal data to our interface
            const transformedData = (fallbackData || []).map(item => ({
              id: item.id,
              user_id: item.user_id,
              type: 'aging_alert' as NotificationType, // Default type
              title: 'Notification',
              message: item.message || 'New notification',
              metadata: {},
              read: item.read ?? false,
              priority: 'normal' as const,
              created_at: item.created_at,
            }));

            console.log(
              `[useNotifications] Fallback: transformed ${transformedData.length} notifications`,
            );
            return transformedData;
          }

          console.error(
            '[useNotifications] Error fetching notifications:',
            error,
          );
          return [];
        }

        console.log(
          `[useNotifications] Successfully fetched ${data?.length || 0} notifications`,
        );
        return data || [];
      } catch (error) {
        console.error('[useNotifications] Unexpected error:', error);
        return [];
      }
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - notifications should be fresh
    gcTime: 5 * 60 * 1000, // 5 minutes cache retention
    refetchOnWindowFocus: true, // Check for new notifications on focus
    retry: 1, // Reduced retry count for schema issues
  });
};

/**
 * Hook to get unread notification count
 */
export const useUnreadNotificationCount = (
  notifications: GlobalNotification[],
) => {
  return notifications.filter(n => !n.read).length;
};

/**
 * Hook to get unread notifications by priority
 */
export const useNotificationsByPriority = (
  notifications: GlobalNotification[],
) => {
  const unreadNotifications = notifications.filter(n => !n.read);

  return {
    urgent: unreadNotifications.filter(n => n.priority === 'urgent'),
    high: unreadNotifications.filter(n => n.priority === 'high'),
    normal: unreadNotifications.filter(n => n.priority === 'normal'),
    low: unreadNotifications.filter(n => n.priority === 'low'),
    total: unreadNotifications.length,
  };
};

/**
 * Hook to mark notification as read
 */
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);

        if (error) throw error;
      } catch (error) {
        console.error(
          '[useMarkNotificationRead] Error marking notification as read:',
          error,
        );
        // Don't throw to avoid UI crashes
      }
    },
    onSuccess: (_, notificationId) => {
      // Optimistically update all relevant caches
      queryClient.setQueryData(
        ['notifications'],
        (old: GlobalNotification[] = []) =>
          old.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification,
          ),
      );

      // Also update aging notifications cache if it exists
      queryClient.setQueryData(['agingNotifications'], (old: any[] = []) =>
        old.map(notification =>
          notification.id === notificationId
            ? { ...notification, is_read: true, read: true }
            : notification,
        ),
      );
    },
    onError: error => {
      console.error('[useMarkNotificationRead] Mutation error:', error);
    },
  });
};

/**
 * Hook to dismiss (delete) notification
 */
export const useDismissNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        if (error) throw error;
      } catch (error) {
        console.error(
          '[useDismissNotification] Error dismissing notification:',
          error,
        );
      }
    },
    onSuccess: (_, notificationId) => {
      // Remove from all caches
      queryClient.setQueryData(
        ['notifications'],
        (old: GlobalNotification[] = []) =>
          old.filter(notification => notification.id !== notificationId),
      );

      queryClient.setQueryData(['agingNotifications'], (old: any[] = []) =>
        old.filter(notification => notification.id !== notificationId),
      );
    },
    onError: error => {
      console.error('[useDismissNotification] Mutation error:', error);
    },
  });
};

/**
 * Hook to mark all notifications as read
 */
export const useMarkAllNotificationsRead = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('User ID is required');

      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false);

        if (error) throw error;
      } catch (error) {
        console.error(
          '[useMarkAllNotificationsRead] Error marking all notifications as read:',
          error,
        );
      }
    },
    onSuccess: () => {
      // Mark all notifications as read in cache
      queryClient.setQueryData(
        ['notifications', userId],
        (old: GlobalNotification[] = []) =>
          old.map(notification => ({ ...notification, read: true })),
      );

      queryClient.setQueryData(
        ['agingNotifications', userId],
        (old: any[] = []) =>
          old.map(notification => ({
            ...notification,
            is_read: true,
            read: true,
          })),
      );
    },
    onError: error => {
      console.error('[useMarkAllNotificationsRead] Mutation error:', error);
    },
  });
};

/**
 * Hook to set up real-time subscription for all notifications
 * Gracefully handles missing table/schema
 */
export const useNotificationsSubscription = (
  userId?: string,
  onNewNotification?: (notification: GlobalNotification) => void,
) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);

  const setupSubscription = useCallback(() => {
    if (!userId) return;

    console.log(
      '[useNotificationsSubscription] Setting up real-time subscription for user:',
      userId,
    );

    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useNotificationsSubscription] New notification received:',
              payload,
            );

            const newNotification = payload.new as GlobalNotification;

            // Update cache with new notification
            queryClient.setQueryData(
              ['notifications', userId],
              (old: GlobalNotification[] = []) => [newNotification, ...old],
            );

            // Call callback if provided (for toasts, etc.)
            onNewNotification?.(newNotification);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useNotificationsSubscription] Notification updated:',
              payload,
            );

            const updatedNotification = payload.new as GlobalNotification;

            // Update cache with updated notification
            queryClient.setQueryData(
              ['notifications', userId],
              (old: GlobalNotification[] = []) =>
                old.map(notification =>
                  notification.id === updatedNotification.id
                    ? updatedNotification
                    : notification,
                ),
            );
          },
        )
        .subscribe();

      subscriptionRef.current = subscription;

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error(
        '[useNotificationsSubscription] Error setting up subscription:',
        error,
      );
    }
  }, [userId, queryClient, onNewNotification]);

  useEffect(() => {
    const cleanup = setupSubscription();
    return cleanup;
  }, [setupSubscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);
};

/**
 * Utility function to get notification icon based on type
 */
export const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'aging_alert':
      return 'time-outline';
    case 'review_prompt':
      return 'star-outline';
    case 'meal_plan_ready':
      return 'restaurant-outline';
    case 'recipe_liked':
      return 'heart-outline';
    case 'recipe_commented':
      return 'chatbubble-outline';
    case 'new_follower':
      return 'person-add-outline';
    case 'feature_announcement':
      return 'megaphone-outline';
    case 'maintenance_notice':
      return 'construct-outline';
    case 'upgrade_prompt':
      return 'diamond-outline';
    default:
      return 'notifications-outline';
  }
};

/**
 * Utility function to get notification color based on priority
 */
export const getNotificationColor = (priority?: string): string => {
  switch (priority) {
    case 'urgent':
      return '#ef4444'; // Red
    case 'high':
      return '#f59e0b'; // Orange
    case 'normal':
      return '#10b981'; // Green
    case 'low':
      return '#6b7280'; // Gray
    default:
      return '#10b981';
  }
};
