import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { PantryItem } from './usePantryData';

/**
 * Hook to set up real-time subscription for stock table changes
 * This enables immediate updates across all pantry screens when items are added/updated/deleted
 */
export const useStockRealtime = (userId?: string) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);

  const setupSubscription = useCallback(() => {
    if (!userId) return;

    console.log(
      '[useStockRealtime] Setting up real-time subscription for user:',
      userId,
    );

    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel(`stock-changes-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useStockRealtime] New stock item inserted:',
              payload.new,
            );

            // Invalidate all stock-related queries to trigger refetch
            queryClient.invalidateQueries({
              queryKey: ['pantryItems', userId],
            });
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
            queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log('[useStockRealtime] Stock item updated:', payload.new);

            // Invalidate all stock-related queries to trigger refetch
            queryClient.invalidateQueries({
              queryKey: ['pantryItems', userId],
            });
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
            queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log('[useStockRealtime] Stock item deleted:', payload.old);

            // Invalidate all stock-related queries to trigger refetch
            queryClient.invalidateQueries({
              queryKey: ['pantryItems', userId],
            });
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
            queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
            queryClient.invalidateQueries({ queryKey: ['feed'] });
          },
        )
        .subscribe();

      subscriptionRef.current = subscription;

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('[useStockRealtime] Error setting up subscription:', error);
    }
  }, [userId, queryClient]);

  useEffect(() => {
    const cleanup = setupSubscription();
    return cleanup;
  }, [setupSubscription]);

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
 * Hook to set up optimistic real-time updates for stock table changes
 * This provides more granular control over cache updates
 */
export const useStockRealtimeOptimistic = (userId?: string) => {
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<any>(null);

  const setupSubscription = useCallback(() => {
    if (!userId) return;

    console.log(
      '[useStockRealtimeOptimistic] Setting up optimistic real-time subscription for user:',
      userId,
    );

    try {
      // Clean up existing subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      const subscription = supabase
        .channel(`stock-optimistic-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useStockRealtimeOptimistic] New stock item inserted:',
              payload.new,
            );

            const newItem = payload.new as PantryItem;

            // Optimistically update pantry items cache
            queryClient.setQueryData(
              ['pantryItems', userId],
              (old: PantryItem[] = []) => {
                // Check if item already exists to avoid duplicates
                const exists = old.some(item => item.id === newItem.id);
                if (exists) return old;

                return [newItem, ...old];
              },
            );

            // Also invalidate other related queries
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useStockRealtimeOptimistic] Stock item updated:',
              payload.new,
            );

            const updatedItem = payload.new as PantryItem;

            // Optimistically update pantry items cache
            queryClient.setQueryData(
              ['pantryItems', userId],
              (old: PantryItem[] = []) => {
                return old.map(item =>
                  item.id === updatedItem.id ? updatedItem : item,
                );
              },
            );

            // Also invalidate other related queries
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'stock',
            filter: `user_id=eq.${userId}`,
          },
          payload => {
            console.log(
              '[useStockRealtimeOptimistic] Stock item deleted:',
              payload.old,
            );

            const deletedItem = payload.old as PantryItem;

            // Optimistically update pantry items cache
            queryClient.setQueryData(
              ['pantryItems', userId],
              (old: PantryItem[] = []) => {
                return old.filter(item => item.id !== deletedItem.id);
              },
            );

            // Also invalidate other related queries
            queryClient.invalidateQueries({ queryKey: ['stock', userId] });
            queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
          },
        )
        .subscribe();

      subscriptionRef.current = subscription;

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error(
        '[useStockRealtimeOptimistic] Error setting up subscription:',
        error,
      );
    }
  }, [userId, queryClient]);

  useEffect(() => {
    const cleanup = setupSubscription();
    return cleanup;
  }, [setupSubscription]);

  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, []);
};
