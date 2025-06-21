import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

// Age group types based on backend logic
export type AgeGroup = 'green' | 'yellow' | 'red';

// Enhanced pantry item with aging information
export interface StockAgingItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  storage_location?: string;
  // Quantity tracking fields for mixed batches detection
  quantity_added?: number;
  previous_quantity?: number;
  // Aging-specific fields from RPC
  age_group: AgeGroup;
  days_old: number;
  age_description: string; // Human-readable age description like "3 days old"
}

// Age group configurations for UI
export const AGE_GROUP_CONFIG = {
  green: {
    color: '#10b981', // green-500
    backgroundColor: '#d1fae5', // green-100
    textColor: '#065f46', // green-800
    label: 'Fresh',
    description: '0-6 days old',
  },
  yellow: {
    color: '#f59e0b', // amber-500
    backgroundColor: '#fef3c7', // amber-100
    textColor: '#92400e', // amber-800
    label: 'Use Soon',
    description: '7-14 days old',
  },
  red: {
    color: '#ef4444', // red-500
    backgroundColor: '#fee2e2', // red-100
    textColor: '#991b1b', // red-800
    label: 'Use Now',
    description: '15+ days old',
  },
} as const;

/**
 * Calculate age group based on days old
 * Updated to match backend thresholds: green <7, yellow 7-14, red >14
 */
const calculateAgeGroup = (daysOld: number): AgeGroup => {
  if (daysOld < 7) return 'green';
  if (daysOld <= 14) return 'yellow';
  return 'red';
};

/**
 * Calculate days between two dates with proper handling of edge cases
 */
const calculateDaysOld = (createdAt: string): number => {
  try {
    const created = new Date(createdAt);
    const now = new Date();

    // Validate dates
    if (isNaN(created.getTime())) {
      console.warn('[calculateDaysOld] Invalid created_at date:', createdAt);
      return 0; // Default to 0 for invalid dates
    }

    // Handle future dates (shouldn't happen but just in case)
    if (created > now) {
      console.warn('[calculateDaysOld] Future date detected:', createdAt);
      return 0;
    }

    // Calculate difference in UTC to avoid timezone issues
    const createdUTC = Date.UTC(
      created.getFullYear(),
      created.getMonth(),
      created.getDate(),
    );
    const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = nowUTC - createdUTC;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays); // Ensure non-negative
  } catch (error) {
    console.error('[calculateDaysOld] Error calculating days old:', error);
    return 0; // Default to 0 for any errors
  }
};

/**
 * Generate age description
 */
const generateAgeDescription = (daysOld: number): string => {
  if (daysOld === 0) return 'Added today';
  if (daysOld === 1) return '1 day old';
  return `${daysOld} days old`;
};

/**
 * Validate and normalize storage location
 */
const validateStorageLocation = (location?: string): string => {
  const validLocations = ['refrigerator', 'freezer', 'cupboard', 'condiments'];

  if (!location) return 'cupboard'; // Default

  const normalized = location.toLowerCase().trim();
  return validLocations.includes(normalized) ? normalized : 'cupboard';
};

/**
 * Convert regular stock item to aging item using client-side calculations
 */
const convertToAgingItem = (stockItem: any): StockAgingItem => {
  const daysOld = calculateDaysOld(stockItem.created_at);
  const ageGroup = calculateAgeGroup(daysOld);
  const ageDescription = generateAgeDescription(daysOld);

  return {
    ...stockItem,
    storage_location: validateStorageLocation(stockItem.storage_location),
    age_group: ageGroup,
    days_old: daysOld,
    age_description: ageDescription,
  };
};

/**
 * Hook to fetch stock items with aging information
 * Uses a hybrid approach: gets aging data from RPC and supplements with full item data
 */
export const useStockAging = (userId?: string) => {
  return useQuery({
    queryKey: ['stockAging', userId],
    queryFn: async (): Promise<StockAgingItem[]> => {
      if (!userId) throw new Error('User ID is required');

      console.log('[useStockAging] Fetching aging data for user:', userId);

      try {
        console.log(
          '[useStockAging] Attempting hybrid approach: RPC + full pantry data...',
        );

        // Fetch both aging data from RPC and full pantry data in parallel
        const [rpcResult, pantryResult] = await Promise.all([
          supabase.rpc('get_stock_aging', { p_user_id: userId }),
          supabase
            .from('stock')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
        ]);

        console.log('[useStockAging] RPC response:', {
          data: rpcResult.data,
          error: rpcResult.error,
        });
        console.log('[useStockAging] Pantry response:', {
          count: pantryResult.data?.length,
          error: pantryResult.error,
        });

        // Check for errors
        if (rpcResult.error) {
          console.warn(
            '[useStockAging] RPC error, falling back to client-side calculation:',
            rpcResult.error,
          );
          throw rpcResult.error;
        }

        if (pantryResult.error) {
          console.error(
            '[useStockAging] Pantry data error:',
            pantryResult.error,
          );
          throw pantryResult.error;
        }

        // If we have both datasets, merge them
        if (
          rpcResult.data &&
          Array.isArray(rpcResult.data) &&
          rpcResult.data.length > 0 &&
          pantryResult.data &&
          Array.isArray(pantryResult.data) &&
          pantryResult.data.length > 0
        ) {
          console.log(
            '[useStockAging] Merging RPC aging data with full pantry data...',
          );

          // Create a map of pantry items by ID for quick lookup
          const pantryItemsMap = new Map(
            pantryResult.data.map(item => [item.id, item]),
          );

          // Merge aging data with full pantry item data
          const mergedItems: StockAgingItem[] = rpcResult.data.map(
            (agingItem: any) => {
              const fullItem = pantryItemsMap.get(agingItem.id);

              if (!fullItem) {
                console.warn(
                  `[useStockAging] No matching pantry item found for aging item ${agingItem.id}`,
                );
                // Return aging item with defaults for missing fields
                return {
                  ...agingItem,
                  quantity: 1,
                  unit: 'units',
                  description: '',
                  created_at: new Date().toISOString(), // Fallback
                  updated_at: new Date().toISOString(),
                  storage_location: 'cupboard',
                  age_description: generateAgeDescription(agingItem.days_old),
                };
              }

              // Merge aging data with full item data
              const mergedItem: StockAgingItem = {
                ...fullItem, // Start with full item data (includes all missing fields)
                ...agingItem, // Override with aging-specific data (age_group, days_old)
                storage_location: validateStorageLocation(
                  fullItem.storage_location,
                ),
                age_description: generateAgeDescription(agingItem.days_old),
                // Preserve quantity tracking fields from full item data
                quantity_added: fullItem.quantity_added,
                previous_quantity: fullItem.previous_quantity,
              };

              return mergedItem;
            },
          );

          console.log(
            `[useStockAging] Successfully merged ${mergedItems.length} items`,
          );
          console.log('[useStockAging] Sample merged item:', {
            name: mergedItems[0]?.item_name,
            age_group: mergedItems[0]?.age_group,
            days_old: mergedItems[0]?.days_old,
            storage_location: mergedItems[0]?.storage_location,
            quantity: mergedItems[0]?.quantity,
            unit: mergedItems[0]?.unit,
            created_at: mergedItems[0]?.created_at,
            quantity_added: mergedItems[0]?.quantity_added,
            previous_quantity: mergedItems[0]?.previous_quantity,
          });

          return mergedItems;
        }

        // If RPC data is empty, fall back to client-side calculation
        console.log(
          '[useStockAging] RPC returned empty data, falling back to client-side calculation',
        );
        throw new Error('RPC returned empty data');
      } catch (error) {
        console.log(
          '[useStockAging] Using fallback: fetching stock data and calculating aging client-side',
        );

        // Fallback to regular stock data with client-side aging calculations
        const { data: stockData, error: stockError } = await supabase
          .from('stock')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (stockError) {
          console.error(
            '[useStockAging] Error fetching stock data:',
            stockError,
          );
          throw stockError;
        }

        const agingItems = (stockData || []).map(convertToAgingItem);

        console.log(
          `[useStockAging] Successfully converted ${agingItems.length} stock items to aging items`,
        );

        return agingItems;
      }
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter for aging data
    gcTime: 5 * 60 * 1000, // 5 minutes cache retention
    refetchOnWindowFocus: true, // Refetch on focus for aging updates
    refetchOnMount: true, // Always refetch for aging updates
    retry: 2,
  });
};

/**
 * Hook to filter aging items by age group
 */
export const useFilteredAgingItems = (
  items: StockAgingItem[],
  ageGroupFilter?: AgeGroup,
) => {
  if (!ageGroupFilter) return items;
  return items.filter(item => item.age_group === ageGroupFilter);
};

/**
 * Hook to get aging statistics
 */
export const useAgingStatistics = (items: StockAgingItem[]) => {
  const stats = items.reduce(
    (acc, item) => {
      acc[item.age_group] = (acc[item.age_group] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, total: 0 },
  );

  return stats;
};

/**
 * Hook for refreshing aging data
 */
export const useRefreshAgingData = () => {
  const queryClient = useQueryClient();

  return (userId?: string) => {
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['stockAging', userId] });
    }
  };
};
