import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

// Notification types based on actual backend structure from logs
export interface AgingNotification {
  id: string;
  user_id: string;
  type: 'aging_alert';
  title?: string; // Not provided by backend, will generate
  message?: string; // Not provided by backend, will generate
  // Backend provides these fields directly (not nested in metadata)
  item_name?: string;
  days_old?: number;
  stock_item_id?: string;
  recipe_id?: string | null;
  // Legacy metadata field for backwards compatibility
  metadata?: {
    item_name?: string;
    days_old?: number;
    age_group?: 'red' | 'yellow' | 'green';
    stock_item_id?: string;
  };
  is_read?: boolean; // Make optional since it might not exist in DB
  created_at: string;
}

/**
 * Hook to fetch and manage aging notifications for a user
 * Updated to focus on notifications table as per backend team's request
 */
export const useAgingNotifications = (userId?: string) => {
  const [notifications, setNotifications] = useState<AgingNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      console.warn('[useAgingNotifications] No userId provided');
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    console.log(
      '[useAgingNotifications] Fetching notifications for user:',
      userId,
    );

    try {
      // Fetch directly from notifications table as backend team requested
      const { data, error } = await supabase
        .from('notifications')
        .select(
          'id, user_id, type, created_at, stock_item_id, item_name, days_old',
        )
        .eq('user_id', userId)
        .eq('type', 'aging_alert')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(
          '[useAgingNotifications] Error fetching notifications:',
          error,
        );
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      // Debug: Log notification structure to understand backend format
      if (data && data.length > 0) {
        console.log(
          '[useAgingNotifications] Sample notification structure:',
          JSON.stringify(data[0], null, 2),
        );
        console.log(
          `[useAgingNotifications] Found ${data.length} notifications`,
        );

        // Log variety of items to see if they're all the same
        const uniqueItems = [...new Set(data.map((n: any) => n.item_name))];
        console.log(
          `[useAgingNotifications] Unique items: ${uniqueItems.join(', ')}`,
        );

        // Show first 5 different notifications
        console.log('[useAgingNotifications] First 5 notifications:');
        data.slice(0, 5).forEach((notification: any, index: number) => {
          console.log(
            `  ${index + 1}. ${notification.item_name} (${notification.days_old} days) - ID: ${notification.id}`,
          );
        });
      }

      const typedData = data as AgingNotification[];

      // Deduplicate notifications by stock_item_id (keep most recent for each item)
      const deduplicatedNotifications = typedData.reduce(
        (acc: AgingNotification[], notification) => {
          const itemId = notification.stock_item_id;
          if (!itemId) return acc; // Skip notifications without stock_item_id

          // Check if we already have a notification for this item
          const existingIndex = acc.findIndex(n => n.stock_item_id === itemId);

          if (existingIndex === -1) {
            // First notification for this item
            acc.push(notification);
          } else {
            // Keep the more recent notification
            const existing = acc[existingIndex];
            const existingDate = new Date(existing.created_at);
            const newDate = new Date(notification.created_at);

            if (newDate > existingDate) {
              acc[existingIndex] = notification;
            }
          }

          return acc;
        },
        [],
      );

      console.log(
        `[useAgingNotifications] Deduplicated ${typedData.length} notifications to ${deduplicatedNotifications.length} unique items`,
      );
      if (deduplicatedNotifications.length > 0) {
        const uniqueItemsAfter = [
          ...new Set(deduplicatedNotifications.map(n => n.item_name)),
        ];
        console.log(
          `[useAgingNotifications] Unique items after deduplication: ${uniqueItemsAfter.join(', ')}`,
        );
      }

      setNotifications(deduplicatedNotifications || []);
      setUnreadCount(deduplicatedNotifications?.length || 0); // Treat all as unread since no is_read field
    } catch (error) {
      console.error('[useAgingNotifications] Unexpected error:', error);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchNotifications();

      // Set up real-time subscription for new notifications
      const subscription = supabase
        .channel('aging-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId} AND type=eq.aging_alert`,
          },
          payload => {
            console.log(
              '[useAgingNotifications] New notification received:',
              payload.new,
            );
            const newNotification = payload.new as AgingNotification;

            // Check if it's an aging alert
            const isAgingAlert = newNotification.type === 'aging_alert';

            if (isAgingAlert) {
              let isNewNotification = false;

              setNotifications(prev => {
                // Deduplicate with existing notifications
                const itemId = newNotification.stock_item_id;
                if (!itemId) return prev;

                const existingIndex = prev.findIndex(
                  n => n.stock_item_id === itemId,
                );
                isNewNotification = existingIndex === -1;

                if (existingIndex === -1) {
                  return [newNotification, ...prev];
                }
                // Replace existing with newer notification
                const updated = [...prev];
                updated[existingIndex] = newNotification;
                return updated;
              });

              // Only increment count for truly new notifications
              if (isNewNotification) {
                setUnreadCount(prev => prev + 1);
              }
            }
          },
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
    
    // Return cleanup function for all paths
    return () => {
      // No cleanup needed when userId is null
    };
  }, [userId, fetchNotifications]);

  return { notifications, unreadCount };
};

/**
 * Hook to get unread notifications count
 */
export const useUnreadNotificationsCount = (
  notifications: AgingNotification[],
) => {
  // Since we don't have is_read field, treat all as unread for now
  return notifications.length;
};

/**
 * Hook to mark notification as read
 * Currently disabled since backend doesn't have is_read column
 */
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // Backend doesn't support is_read column yet
      console.log(
        '[useMarkNotificationRead] Backend does not support marking as read yet',
      );
      return Promise.resolve();
    },
    onSuccess: (_, notificationId) => {
      // No cache updates needed since we don't track read status
    },
    onError: error => {
      console.log(
        '[useMarkNotificationRead] Read status not supported:',
        error,
      );
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
        // Don't throw to avoid UI crashes
      }
    },
    onSuccess: (_, notificationId) => {
      // Remove from cache with intelligent cleanup
      queryClient.setQueryData(
        ['agingNotifications'],
        (old: AgingNotification[] = []) =>
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
 * Currently disabled since backend doesn't have is_read column
 */
export const useMarkAllNotificationsRead = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('User ID is required');

      // Backend doesn't support is_read column yet
      console.log(
        '[useMarkAllNotificationsRead] Backend does not support marking as read yet',
      );
      return Promise.resolve();
    },
    onSuccess: () => {
      // No cache updates needed since we don't track read status
    },
    onError: error => {
      console.log(
        '[useMarkAllNotificationsRead] Read status not supported:',
        error,
      );
    },
  });
};

/**
 * Hook to set up real-time subscription for new aging notifications
 * Gracefully handles missing table/schema
 */
export const useAgingNotificationsSubscription = (
  userId?: string,
  onNewNotification?: (notification: AgingNotification) => void,
) => {
  const queryClient = useQueryClient();

  const setupSubscription = useCallback(() => {
    if (!userId) return;

    console.log(
      '[useAgingNotificationsSubscription] Setting up real-time subscription for user:',
      userId,
    );

    try {
      const subscription = supabase
        .channel('aging-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId} AND type=eq.aging_alert`,
          },
          payload => {
            console.log(
              '[useAgingNotificationsSubscription] New notification received:',
              payload,
            );

            const newNotification = payload.new as AgingNotification;

            // Only handle aging alerts (check multiple ways since schema might vary)
            const isAgingAlert =
              newNotification.type === 'aging_alert' ||
              newNotification.title?.includes('aging') ||
              newNotification.message?.includes('aging') ||
              newNotification.title?.includes('old') ||
              newNotification.message?.includes('old') ||
              newNotification.title?.includes('attention') ||
              newNotification.message?.includes('attention');

            if (isAgingAlert) {
              // Update cache with new notification
              queryClient.setQueryData(
                ['agingNotifications', userId],
                (old: AgingNotification[] = []) => [newNotification, ...old],
              );

              // Call callback if provided
              onNewNotification?.(newNotification);
            }
          },
        )
        .subscribe();

      return () => {
        console.log(
          '[useAgingNotificationsSubscription] Cleaning up subscription',
        );
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error(
        '[useAgingNotificationsSubscription] Error setting up subscription:',
        error,
      );
      // Return no-op cleanup function
      return () => {};
    }
  }, [userId, queryClient, onNewNotification]);

  return setupSubscription;
};
