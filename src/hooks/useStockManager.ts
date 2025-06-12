import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useGroceryContext } from '../providers/GroceryProvider';
import { useAuth } from '../providers/AuthProvider';
import { refreshFeedPantryMatches } from './useFeed';

// Define basic types within the hook for now, can be moved to a types file later
export interface StockItem {
  id?: string | number;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string | null;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  quantity_added?: number;
  previous_quantity?: number;
}

// Type for raw item from Supabase before quantity conversion if needed
interface RawStockItem extends Omit<StockItem, 'quantity'> {
  quantity: string | number;
}

export type UnitOption = { label: string; value: string };

// Default unit options
export const DEFAULT_UNIT_OPTIONS: UnitOption[] = [
  { label: 'Units', value: 'units' },
  { label: 'Grams (g)', value: 'g' },
  { label: 'Kilograms (kg)', value: 'kg' },
  { label: 'Milliliters (ml)', value: 'ml' },
  { label: 'Liters (l)', value: 'l' },
  { label: 'Ounces (oz)', value: 'oz' },
  { label: 'Pounds (lbs)', value: 'lbs' },
  { label: 'Cups', value: 'cups' },
];

// Fetch user session
const fetchUserSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  return session?.user?.id || null;
};

// Fetch stock data
const fetchStockData = async (userId: string): Promise<StockItem[]> => {
  const { data, error } = await supabase
    .from('stock')
    .select('id, item_name, quantity, unit, description, created_at, updated_at, quantity_added, previous_quantity')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (
    data?.map((item: RawStockItem) => ({
      ...item,
      quantity: Number(item.quantity),
    })) || []
  );
};

export const useStockManager = () => {
  const queryClient = useQueryClient();
  const { removeGroceryItem: removeGroceryItemFromList } = useGroceryContext();

  // Modal Visibility States
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Fetch user ID with React Query
  const { data: userId } = useQuery({
    queryKey: ['userSession'],
    queryFn: fetchUserSession,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Fetch stock data with React Query
  const {
    data: stockData = [],
    isLoading,
    error: queryError,
    refetch: fetchStock,
  } = useQuery({
    queryKey: ['stock', userId],
    queryFn: () => fetchStockData(userId!),
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const error = queryError?.message || null;

  // Save item mutation
  const saveItemMutation = useMutation({
    mutationFn: async ({
      itemToSave,
      originalItemName,
    }: {
      itemToSave: StockItem;
      originalItemName?: string;
    }) => {
      if (!userId) throw new Error('User not authenticated');

      const itemData = {
        user_id: userId,
        item_name: itemToSave.item_name.trim().toLowerCase(),
        quantity: itemToSave.quantity,
        unit: itemToSave.unit || 'units',
        description: itemToSave.description?.trim() || null,
        ...(editingItem ? {} : { created_at: new Date().toISOString() }),
      };

      if (editingItem && originalItemName) {
        const { error } = await supabase
          .from('stock')
          .update(itemData)
          .eq('user_id', userId)
          .eq('item_name', originalItemName.toLowerCase());
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stock')
          .upsert(itemData, { onConflict: 'user_id, item_name' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', userId] });
      queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      // Refresh feed pantry matches specifically
      refreshFeedPantryMatches(queryClient);

      closeManualModal();
    },
    onError: (error: any) => {
      Alert.alert(
        'Save Error',
        error.message || 'Could not save the item. Please try again.',
      );
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemToDelete: StockItem) => {
      if (!userId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('stock')
        .delete()
        .eq('user_id', userId)
        .eq('item_name', itemToDelete.item_name.toLowerCase());

      if (error) throw error;
    },
    onMutate: async itemToDelete => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['stock', userId] });
      const previousStock = queryClient.getQueryData(['stock', userId]);

      queryClient.setQueryData(['stock', userId], (old: StockItem[] = []) =>
        old.filter(item => item.item_name !== itemToDelete.item_name),
      );

      return { previousStock };
    },
    onError: (error: any, itemToDelete, context) => {
      // Rollback on error
      queryClient.setQueryData(['stock', userId], context?.previousStock);
      Alert.alert(
        'Delete Error',
        error.message || 'Could not delete the item. Please try again.',
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', userId] });
      queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });

      // Refresh feed pantry matches specifically
      refreshFeedPantryMatches(queryClient);
    },
  });

  // Modal Handlers
  const openManualModal = useCallback((itemToEdit?: StockItem) => {
    setEditingItem(itemToEdit || null);
    setIsManualModalVisible(true);
  }, []);

  const closeManualModal = useCallback(() => {
    setIsManualModalVisible(false);
    setEditingItem(null);
  }, []);

  const prepareEditItem = useCallback(
    (item: StockItem) => {
      openManualModal(item);
    },
    [openManualModal],
  );

  const handleSaveItem = useCallback(
    async (
      itemToSave: StockItem,
      originalItemName?: string,
    ): Promise<boolean> => {
      if (!itemToSave.item_name?.trim()) {
        Alert.alert('Validation Error', 'Item name is required.');
        return false;
      }

      if (itemToSave.quantity <= 0) {
        Alert.alert('Validation Error', 'Quantity must be greater than 0.');
        return false;
      }

      try {
        await saveItemMutation.mutateAsync({ itemToSave, originalItemName });
        return true;
      } catch {
        return false;
      }
    },
    [saveItemMutation],
  );

  const deleteStockItem = useCallback(
    async (itemToDelete: StockItem) => {
      try {
        await deleteItemMutation.mutateAsync(itemToDelete);
        return true;
      } catch {
        return false;
      }
    },
    [deleteItemMutation],
  );

  return {
    stockData,
    userId,
    isLoading,
    isSaving: saveItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
    error,

    // Manual Add Modal related
    isManualModalVisible,
    openManualModal,
    closeManualModal,
    editingItem,
    prepareEditItem,
    handleSaveItem,

    // Item Operations
    deleteStockItem,
    fetchStock,

    unitOptions: DEFAULT_UNIT_OPTIONS,
  };
};
