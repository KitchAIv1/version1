import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabase'; // Correct path as confirmed by user

// --- Interfaces ---
// Based on usage: item_name, quantity, unit are in input and also in full item.
// 'id' is likely a number from the DB, and user_id is a string (UUID).
export interface GroceryItem {
  id: string; // Changed from number to string for UUID
  user_id: string;
  item_name: string;
  quantity: number | null; // Allow null if quantity is optional
  unit: string | null;     // Allow null if unit is optional
  created_at?: string; // Add created_at as it exists
  is_checked?: boolean; // Add is_checked as it exists
  // Add other fields like 'created_at', 'is_checked' if they exist in your DB table
}

export interface GroceryItemInput {
  item_name: string;
  quantity?: number | null; // Make optional if not always provided
  unit?: string | null;     // Make optional if not always provided
}

// --- Hook Definition ---
export const useGroceryManager = () => {
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Effect to get the current user ID (optional, but common)
  // If you prefer to always pass userId, this can be removed.
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
        setGroceryList([]); // Clear list if no user
        setError("User not authenticated.");
      }
    };
    fetchUser();
  }, []);

  const fetchGroceryList = useCallback(async (userIdToFetch?: string) => {
    const uid = userIdToFetch || currentUserId;
    if (!uid) {
      setError("User ID not available to fetch grocery list.");
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
        .order('created_at', { ascending: true }); // Assuming a 'created_at' field for ordering

      if (dbError) throw dbError;
      setGroceryList(data || []);
    } catch (err: any) {
      console.error("Error fetching grocery list:", err);
      setError(err.message || "Failed to fetch grocery list.");
      setGroceryList([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  // Effect to fetch list when userId changes
  useEffect(() => {
    if (currentUserId) {
      fetchGroceryList(currentUserId);
    }
  }, [currentUserId, fetchGroceryList]);

  const addGroceryItem = async (item: GroceryItemInput, userIdToAdd?: string) => {
    const uid = userIdToAdd || currentUserId;
    if (!uid) {
      throw new Error("User ID not available to add grocery item.");
    }
    
    const { item_name, quantity, unit } = item;
    const itemPayload = {
      user_id: uid,
      item_name,
      quantity: quantity !== undefined ? quantity : 1, // Default quantity to 1 if undefined
      unit: unit !== undefined ? unit : 'units',         // Default unit to 'units' if undefined
      is_checked: false, // Default for new items
      // id is auto-generated (gen_random_uuid())
    };

    const { error: upsertError } = await supabase
      .from('grocery_list')
      .upsert(itemPayload, { onConflict: 'user_id,item_name,unit' }); 

    if (upsertError) {
      console.error("Error adding/upserting grocery item:", upsertError);
      throw upsertError;
    }
    await fetchGroceryList(uid); // Refresh list
  };

  const removeGroceryItem = async (itemId: string, userIdToRemove?: string) => { // itemId changed to string
    const uid = userIdToRemove || currentUserId;
    if (!uid) {
      throw new Error("User ID not available to remove grocery item.");
    }

    const { error: deleteError } = await supabase
      .from('grocery_list')
      .delete()
      .eq('user_id', uid) // Ensure user can only delete their own items (RLS should also enforce this)
      .eq('id', itemId);

    if (deleteError) {
      console.error("Error removing grocery item:", deleteError);
      throw deleteError;
    }
    await fetchGroceryList(uid); // Refresh list
  };
  
  const toggleGroceryItemChecked = async (itemId: string, isChecked: boolean, userIdToUpdate?: string) => { // itemId changed to string
    const uid = userIdToUpdate || currentUserId;
    if (!uid) {
      throw new Error("User ID not available to update grocery item.");
    }

    // Assuming your 'grocery_list' table has an 'is_checked' column (boolean)
    const { error: updateError } = await supabase
      .from('grocery_list')
      .update({ is_checked: isChecked })
      .eq('user_id', uid)
      .eq('id', itemId);

    if (updateError) {
      console.error("Error toggling grocery item checked state:", updateError);
      throw updateError;
    }
    await fetchGroceryList(uid); // Refresh list
  };

  const clearAllItems = async (userIdToClear?: string) => {
    const uid = userIdToClear || currentUserId;
    if (!uid) {
      throw new Error("User ID not available to clear all grocery items.");
    }

    // Consider adding an Alert.prompt or a custom confirmation modal here
    // For simplicity, directly proceeding with deletion.
    // Alert.alert("Confirm", "Are you sure you want to clear all grocery items?", [{text: "Cancel"}, {text: "Clear", onPress: async () => { ... }}]);

    setIsLoading(true);
    setError(null);
    try {
      // This deletes all items for the user. 
      // If you only want to delete items currently in the groceryList state:
      // for (const item of groceryList) {
      //   await removeGroceryItem(item.id, uid); // This would be less efficient
      // }
      // Opting for a direct delete all for the user.
      const { error: deleteAllError } = await supabase
        .from('grocery_list')
        .delete()
        .eq('user_id', uid);

      if (deleteAllError) {
        throw deleteAllError;
      }
      await fetchGroceryList(uid); // Refresh the list (will be empty)
    } catch (err: any) {
      console.error("Error clearing all grocery items:", err);
      setError(err.message || "Failed to clear all grocery items.");
      // Potentially re-fetch to ensure UI consistency if partial delete occurred,
      // though direct delete should be atomic or fail entirely.
      await fetchGroceryList(uid); 
    } finally {
      setIsLoading(false);
    }
  };

  return {
    groceryList,
    isLoading,
    error,
    currentUserId, // Expose currentUserId if needed by UI
    fetchGroceryList,
    addGroceryItem,
    removeGroceryItem,
    toggleGroceryItemChecked, // Added function
    clearAllItems,
  };
}; 