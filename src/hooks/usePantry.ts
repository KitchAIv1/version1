import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import uuid from 'react-native-uuid';

// Define a type for the stock item for clarity
export interface PantryItem {
  id: string;
  item_name: string;
  qty: number;
  // Add any other fields that might exist in your 'stock' table
}

export const usePantry = () => {
  const qc = useQueryClient();

  // Adjusted for React Query v5: useQuery takes an object
  const list = useQuery<PantryItem[], Error>({
    queryKey: ['pantry'], 
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('item_name');
      if (error) throw error;
      return data as PantryItem[]; // Assert type if supabase doesn't infer it perfectly
    }
  });

  const upsert = useMutation<
    unknown, // Return type of the mutation
    Error,   // Error type
    { name: string; qty: number }[] // Input type to mutationFn
  >({
    mutationFn: async (items: { name: string; qty: number }[]) => {
      const { data, error } = await supabase.from('stock').upsert(
        items.map((i) => ({
          id: uuid.v4() as string, 
          item_name: i.name,
          qty: i.qty || 1,
        }))
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry'] }); // Adjusted for v5
    },
  });

  const remove = useMutation<
    unknown, 
    Error, 
    string // Input type is id (string)
  >({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('stock').delete().eq('id', id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry'] }); // Adjusted for v5
    },
  });

  return { ...list, upsert, remove };
}; 