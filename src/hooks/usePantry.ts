import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import uuid from 'react-native-uuid';

// Define a type for the stock item for clarity
export interface PantryItem {
  id: string;
  user_id: string; // Added user_id
  item_name: string;
  quantity: number;
  expiry_date?: string | null; // Add optional expiry_date (string or null)
  // Add any other fields that might exist in your 'stock' table
}

export const usePantry = () => {
  const qc = useQueryClient();

  // Adjusted for React Query v5: useQuery takes an object
  const list = useQuery<PantryItem[], Error>({
    queryKey: ['pantry'], 
    queryFn: async () => {
      // Ensure RLS policy for SELECT allows fetching user's own items
      // Example: ( (uid() = user_id) AND (deleted_at IS NULL) )
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        // .eq('user_id', (await supabase.auth.getUser()).data.user?.id) // Optional: if RLS is not enough or for specific filtering
        .order('item_name');
      if (error) throw error;
      return data as PantryItem[]; // Assert type if supabase doesn't infer it perfectly
    }
  });

  const upsert = useMutation<
    unknown, // Return type of the mutation
    Error,   // Error type
    { name: string; quantity: number }[] // Input type to mutationFn
  >({
    mutationFn: async (items: { name: string; quantity: number }[]) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Pantry upsert: User not authenticated', authError);
        throw authError || new Error('User not authenticated for upsert');
      }

      const itemsToUpsert = items.map((i) => ({
        // id: uuid.v4() as string, // id is not part of the conflict resolution, and should be handled by DB or omitted if PK is user_id, item_name
        user_id: user.id, 
        item_name: i.name,
        quantity: i.quantity || 1,
      }));
      console.log("Upserting items with onConflict:", JSON.stringify(itemsToUpsert, null, 2));
      
      // Specify onConflict to update existing records if user_id and item_name match
      const { data, error } = await supabase.from('stock').upsert(itemsToUpsert, {
        onConflict: 'user_id, item_name', // Assuming these are the columns in your unique constraint
        // ignoreDuplicates: false, // Default: ensures it updates on conflict rather than skipping
      });

      if (error) {
        console.error("Upsert error (unique constraint?):", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pantry'] }); // Adjusted for v5
    },
    onError: (error) => {
      // Log mutation errors specifically
      console.error("Pantry upsert mutation error (unique constraint?):", error);
    }
  });

  const remove = useMutation<
    unknown, 
    Error, 
    string // Input type is id (string)
  >({
    mutationFn: async (id: string) => {
      // Ensure RLS policy for DELETE allows deleting user's own items
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