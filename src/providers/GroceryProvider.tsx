import React, {
  createContext,
  useState,
  useCallback,
  useEffect,
  useContext,
  ReactNode,
} from 'react';
import { PostgrestError } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase'; // Adjusted path

// --- Interfaces (copied from original useGroceryManager) ---
export interface GroceryItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  created_at?: string;
  recipe_name?: string | null;
  is_checked?: boolean;
}

export interface GroceryItemInput {
  item_name: string;
  quantity?: number | null;
  unit?: string | null;
  recipeName?: string | null;
}

// --- Context Value Interface ---
export interface GroceryContextValues {
  groceryList: GroceryItem[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string | null; // Keep currentUserId in context if it's useful
  fetchGroceryList: (userIdToFetch?: string) => Promise<void>;
  addGroceryItem: (
    item: GroceryItemInput,
    userIdToAdd?: string,
  ) => Promise<void>;
  removeGroceryItem: (itemId: string, userIdToRemove?: string) => Promise<void>;
  toggleGroceryItemChecked: (
    itemId: string,
    isChecked: boolean,
    userIdToUpdate?: string,
  ) => Promise<void>;
  clearAllItems: (userIdToClear?: string) => Promise<void>;
}

// --- Context Creation ---
// Provide a default stub for the context value to satisfy TypeScript
const defaultContextValue: GroceryContextValues = {
  groceryList: [],
  isLoading: false,
  error: null,
  currentUserId: null,
  fetchGroceryList: async () => {},
  addGroceryItem: async () => {},
  removeGroceryItem: async () => {},
  toggleGroceryItemChecked: async () => {},
  clearAllItems: async () => {},
};

const GroceryContext = createContext<GroceryContextValues>(defaultContextValue);

// --- Custom Hook to consume context (export this for components) ---
export const useGroceryContext = () => {
  const context = useContext(GroceryContext);
  if (context === undefined) {
    throw new Error('useGroceryContext must be used within a GroceryProvider');
  }
  return context;
};

// --- Provider Component ---
interface GroceryProviderProps {
  children: ReactNode;
}

export const GroceryProvider: React.FC<GroceryProviderProps> = ({
  children,
}) => {
  // --- Logic copied and adapted from original useGroceryManager hook ---
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
        setGroceryList([]);
        setError('User not authenticated.');
      }
    };
    fetchUser();
  }, []);

  const fetchGroceryList = useCallback(
    async (userIdToFetch?: string) => {
      const uid = userIdToFetch || currentUserId;
      if (!uid) {
        setError('User ID not available to fetch grocery list.');
        setGroceryList([]);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: dbError } = await supabase
          .from('grocery_list')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: true });
        if (dbError) {
          setError(
            dbError.message || 'Failed to fetch grocery list during operation.',
          );
          throw dbError;
        }
        setGroceryList(data || []);
        console.log(
          '[GroceryProvider] fetchGroceryList: Fetched list length =',
          (data || []).length,
          'for user:',
          uid,
        );
      } catch (err: any) {
        console.error('Error fetching grocery list:', err);
        setError(err.message || 'Failed to fetch grocery list.');
        setGroceryList([]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    if (currentUserId) {
      fetchGroceryList(currentUserId);
    }
  }, [currentUserId, fetchGroceryList]);

  const addGroceryItem = async (
    item: GroceryItemInput,
    userIdToAdd?: string,
  ): Promise<void> => {
    const uid = userIdToAdd || currentUserId;
    if (!uid) {
      setError('User ID not available to add grocery item.');
      throw new Error('User ID not available to add grocery item.');
    }
    const { item_name, quantity, unit, recipeName } = item;
    const itemPayload = {
      user_id: uid,
      item_name,
      quantity: quantity !== undefined ? quantity : 1,
      unit: unit !== undefined ? unit : 'units',
      recipe_name: recipeName !== undefined ? recipeName : null,
      is_checked: false,
    };
    setIsLoading(true);
    setError(null);
    try {
      const { error: upsertError } = await supabase
        .from('grocery_list')
        .upsert(itemPayload, { onConflict: 'user_id,item_name,unit' });
      if (upsertError) {
        setError(upsertError.message || 'Failed to add item.');
        throw upsertError;
      }
      await fetchGroceryList(uid);

      // Invalidate activity feed to show the grocery addition
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['userActivityFeed', uid] });
      }
    } catch (err: any) {
      setError(
        err.message || 'An unexpected error occurred while adding item.',
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const removeGroceryItem = async (
    itemId: string,
    userIdToRemove?: string,
  ): Promise<void> => {
    const uid = userIdToRemove || currentUserId;
    console.log(
      `[GroceryProvider] removeGroceryItem: Initiated for item ID: ${itemId}, User ID: ${uid}`,
    );
    if (!uid) {
      console.error(
        '[GroceryProvider] removeGroceryItem: Aborted - User ID not available.',
      );
      setError('User ID not available to remove grocery item.');
      throw new Error('User ID not available to remove grocery item.');
    }
    setIsLoading(true);
    setError(null);
    try {
      console.log(
        `[GroceryProvider] removeGroceryItem: Attempting to delete item ID: ${itemId} from Supabase.`,
      );
      const { error: deleteError } = await supabase
        .from('grocery_list')
        .delete()
        .eq('user_id', uid)
        .eq('id', itemId);

      if (deleteError) {
        console.error(
          `[GroceryProvider] removeGroceryItem: Supabase delete error for item ID: ${itemId}`,
          deleteError,
        );
        setError(deleteError.message || 'Failed to remove item.');
        throw deleteError;
      }
      console.log(
        `[GroceryProvider] removeGroceryItem: Successfully deleted item ID: ${itemId} from Supabase. Now refetching list.`,
      );
      await fetchGroceryList(uid);
      console.log(
        `[GroceryProvider] removeGroceryItem: Finished refetching list after deleting item ID: ${itemId}.`,
      );
    } catch (err: any) {
      console.error(
        `[GroceryProvider] removeGroceryItem: Catch block error for item ID: ${itemId}`,
        err,
      );
      setError(
        err.message || 'An unexpected error occurred while removing item.',
      );
      throw err;
    } finally {
      setIsLoading(false);
      console.log(
        `[GroceryProvider] removeGroceryItem: Finally block executed for item ID: ${itemId}.`,
      );
    }
  };

  const toggleGroceryItemChecked = async (
    itemId: string,
    isChecked: boolean,
    userIdToUpdate?: string,
  ): Promise<void> => {
    const uid = userIdToUpdate || currentUserId;
    if (!uid) {
      setError('User ID not available to update grocery item.');
      throw new Error('User ID not available to update grocery item.');
    }
    setError(null);
    // No setIsLoading(true) here in original, keeping it that way unless it causes issues
    try {
      const { error: updateError } = await supabase
        .from('grocery_list')
        .update({ is_checked: isChecked })
        .eq('user_id', uid)
        .eq('id', itemId);
      if (updateError) {
        setError(updateError.message || 'Failed to update item status.');
        throw updateError;
      }
      await fetchGroceryList(uid);
    } catch (err: any) {
      setError(
        err.message ||
          'An unexpected error occurred while updating item status.',
      );
      throw err;
    }
    // No setIsLoading(false) here in original
  };

  const clearAllItems = async (userIdToClear?: string): Promise<void> => {
    const uid = userIdToClear || currentUserId;
    if (!uid) {
      setError('User ID not available to clear all grocery items.');
      throw new Error('User ID not available to clear all grocery items.');
    }
    setIsLoading(true);
    setError(null);
    try {
      const { error: deleteAllError } = await supabase
        .from('grocery_list')
        .delete()
        .eq('user_id', uid);
      if (deleteAllError) {
        setError(deleteAllError.message || 'Failed to clear all items.');
        throw deleteAllError;
      }
      await fetchGroceryList(uid);
    } catch (err: any) {
      setError(
        err.message || 'An unexpected error occurred while clearing all items.',
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  // --- End of copied logic ---

  const contextValue = {
    groceryList,
    isLoading,
    error,
    currentUserId,
    fetchGroceryList,
    addGroceryItem,
    removeGroceryItem,
    toggleGroceryItemChecked,
    clearAllItems,
  };

  return (
    <GroceryContext.Provider value={contextValue}>
      {children}
    </GroceryContext.Provider>
  );
};
