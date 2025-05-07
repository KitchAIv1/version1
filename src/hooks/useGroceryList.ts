import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import uuid from 'react-native-uuid';

// Define a type for the grocery item
export interface GroceryListItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  added_at?: string; // Assuming added_at is set by db
  is_checked?: boolean; // From IngredientsTab usage
  // Add any other fields from your 'grocery_list' table
}

export const useGroceryList = () => {
  const qc = useQueryClient();

  const list = useQuery<GroceryListItem[], Error>({
    queryKey: ['grocery'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grocery_list')
        .select('*')
        .order('added_at'); // Ensure this column exists and is sortable
      if (error) throw error;
      return data as GroceryListItem[];
    }
  });

  // Renamed items to inputItems to avoid conflict with potential future variable name
  const insert = useMutation<
    unknown, 
    Error, 
    { name: string; qty: number; unit?: string }[] // Input items
  >({
    mutationFn: async (inputItems: { name: string; qty: number; unit?: string }[]) => {
      const { data, error } = await supabase.from('grocery_list').insert(
        inputItems.map((i) => ({
          id: uuid.v4() as string,
          name: i.name,
          qty: i.qty || 1,
          unit: i.unit || '',
          // added_at is likely handled by the database default
          is_checked: false, // Default for new items
        }))
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grocery'] });
    },
  });

  // Assuming toggleDone means deleting the item from the list once checked
  // If it means updating an is_checked field, the mutationFn would be different (an update operation)
  const toggleDone = useMutation<
    unknown, 
    Error, 
    string // id of the item
  >({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('grocery_list').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grocery'] });
    },
  });

  return { ...list, insert, toggleDone };
}; 