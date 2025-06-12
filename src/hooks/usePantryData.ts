import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

// Storage location type for type safety
export type StorageLocation =
  | 'refrigerator'
  | 'freezer'
  | 'cupboard'
  | 'condiments';

// Extended interface with backward compatibility
export interface PantryItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  storage_location?: StorageLocation; // NEW: Optional field for backward compatibility
  quantity_added?: number;
  previous_quantity?: number;
}

// Storage location constants for reuse
export const STORAGE_LOCATIONS: Record<StorageLocation, string> = {
  refrigerator: 'Refrigerator',
  freezer: 'Freezer',
  cupboard: 'Cupboard',
  condiments: 'Condiments',
} as const;

export const STORAGE_LOCATION_OPTIONS = Object.entries(STORAGE_LOCATIONS).map(
  ([value, label]) => ({
    value: value as StorageLocation,
    label,
  }),
);

// Helper function to group items by storage location
export const groupItemsByStorageLocation = (items: PantryItem[]) => {
  const grouped = items.reduce(
    (acc, item) => {
      const location = item.storage_location || 'cupboard'; // Default to cupboard for legacy items
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(item);
      return acc;
    },
    {} as Record<StorageLocation, PantryItem[]>,
  );

  // Ensure all locations exist even if empty
  return {
    refrigerator: grouped.refrigerator || [],
    freezer: grouped.freezer || [],
    cupboard: grouped.cupboard || [],
    condiments: grouped.condiments || [],
  };
};

export const usePantryData = (userId?: string) => {
  return useQuery({
    queryKey: ['pantryItems', userId],
    queryFn: async (): Promise<PantryItem[]> => {
      if (!userId) throw new Error('User ID is required');

      console.log('[usePantryData] Fetching pantry data for user:', userId);

      // UPDATED: Include storage_location and quantity tracking in select query with backward compatibility
      const { data, error, count } = await supabase
        .from('stock')
        .select(
          'id, item_name, quantity, unit, description, created_at, updated_at, user_id, storage_location, quantity_added, previous_quantity',
          { count: 'exact' },
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[usePantryData] Error fetching pantry data:', error);
        throw error;
      }

      console.log(
        `[usePantryData] Successfully fetched ${data?.length || 0} pantry items (total count: ${count})`,
      );
      console.log(
        '[usePantryData] Sample items:',
        data?.slice(0, 3).map(item => ({
          id: item.id,
          name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          storage_location: item.storage_location || 'cupboard', // Log storage location with default
        })),
      );

      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retention
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    retry: 2, // Retry failed requests 2 times
  });
};

// Hook for refreshing pantry data
export const useRefreshPantryData = () => {
  const queryClient = useQueryClient();

  return (userId?: string) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['pantryItems', userId] });
    }
  };
};

// Hook for updating pantry data optimistically
export const usePantryMutations = (userId?: string) => {
  const queryClient = useQueryClient();

  const updatePantryCache = (updatedItems: PantryItem[]) => {
    if (userId) {
      queryClient.setQueryData(['pantryItems', userId], updatedItems);
    }
  };

  const invalidatePantryCache = () => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['pantryItems', userId] });
    }
  };

  return {
    updatePantryCache,
    invalidatePantryCache,
  };
};
