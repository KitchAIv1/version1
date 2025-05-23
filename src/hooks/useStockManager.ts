import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useGroceryContext } from '../providers/GroceryProvider';

// Define basic types within the hook for now, can be moved to a types file later
export interface StockItem {
  id?: string | number;
  item_name: string;
  quantity: number;
  unit: string;
  description?: string | null;
  user_id?: string;
  created_at?: string;
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

export const useStockManager = () => {
  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { removeGroceryItem: removeGroceryItemFromList } = useGroceryContext();

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Modal Visibility States
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);

  // Editing State
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Fetch user ID on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error fetching session:', sessionError.message);
        setError('Failed to initialize user session.');
        return;
      }
      if (session?.user) {
        setUserId(session.user.id);
      } else {
        console.warn('No active user session.');
        setError('No active user session. Please login.');
      }
    };
    fetchUser();
  }, []);

  // Fetch Stock Data
  const fetchStock = useCallback(async (currentUserId?: string | null) => {
    const idToUse = currentUserId || userId;
    if (!idToUse) {
      setError("User ID not available. Cannot fetch stock.");
      console.warn("[useStockManager] fetchStock aborted: No user ID.");
      return;
    }

    console.log(`[useStockManager] Fetching stock for user: ${idToUse}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('stock')
        .select('id, item_name, quantity, unit, description, created_at')
        .eq('user_id', idToUse)
        .order('created_at', { ascending: false });

      if (dbError) throw dbError;

      console.log("[useStockManager] Raw stock data received:", data);
      const formattedData = data?.map((item: RawStockItem) => ({ 
          ...item, 
          quantity: Number(item.quantity) 
        })) || [];
      setStockData(formattedData);
    } catch (err: any) {
      console.error("[useStockManager] Error fetching stock:", err);
      setError(err.message || "Failed to load stock data.");
      setStockData([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Effect to fetch stock when userId is set
  useEffect(() => {
    if (userId) {
      fetchStock(userId);
    }
  }, [userId, fetchStock]);

  // Modal Handlers
  const openManualModal = (itemToEdit?: StockItem) => {
    setEditingItem(itemToEdit || null);
    setIsManualModalVisible(true);
  };

  const closeManualModal = () => {
    setIsManualModalVisible(false);
    setEditingItem(null);
  };

  const prepareEditItem = (item: StockItem) => {
    console.log("[useStockManager] Preparing to edit item:", item);
    openManualModal(item);
  };

  const handleSaveItem = async (itemToSave: StockItem, originalItemName?: string): Promise<boolean> => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return false;
    }

    if (!itemToSave.item_name?.trim()) {
      Alert.alert("Validation Error", "Item name is required.");
      return false;
    }

    if (itemToSave.quantity <= 0) {
      Alert.alert("Validation Error", "Quantity must be greater than 0.");
      return false;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const itemData = {
        user_id: userId,
        item_name: itemToSave.item_name.trim().toLowerCase(),
        quantity: itemToSave.quantity,
        unit: itemToSave.unit || 'units',
        description: itemToSave.description?.trim() || null,
        ...(editingItem ? {} : { created_at: new Date().toISOString() }) // Only set created_at for new items
      };

      if (editingItem && originalItemName) {
        // Update existing item
        const { error: updateError } = await supabase
          .from('stock')
          .update(itemData)
          .eq('user_id', userId)
          .eq('item_name', originalItemName.toLowerCase());

        if (updateError) throw updateError;
        console.log("[useStockManager] Item updated successfully");
      } else {
        // Create new item or upsert
        const { error: upsertError } = await supabase
          .from('stock')
          .upsert(itemData, { onConflict: 'user_id, item_name' });

        if (upsertError) throw upsertError;
        console.log("[useStockManager] Item saved successfully");
      }

      fetchStock();
      queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      closeManualModal();
      return true;

    } catch (err: any) {
      console.error("[useStockManager] Error saving item:", err);
      setSaveError(err.message || "Failed to save item.");
      Alert.alert("Save Error", err.message || "Could not save the item. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteStockItem = async (itemToDelete: StockItem) => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated.");
      return false;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error: deleteError } = await supabase
        .from('stock')
        .delete()
        .eq('user_id', userId)
        .eq('item_name', itemToDelete.item_name.toLowerCase());

      if (deleteError) throw deleteError;

      console.log('[useStockManager] Item deleted successfully. Refreshing stock...');
      fetchStock();
      queryClient.invalidateQueries({ queryKey: ['pantryMatch'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      return true;
    } catch (err: any) {
      console.error("[useStockManager] Error deleting item:", err);
      setDeleteError(err.message || "Failed to delete item.");
      Alert.alert("Delete Error", err.message || "Could not delete the item. Please try again.");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    stockData,
    userId,
    isLoading,
    isSaving,
    isDeleting,
    error,
    saveError,
    deleteError,

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

