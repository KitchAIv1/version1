import { supabase } from './supabase';

// Define the expected structure for an item returned by the recognize-stock function
interface PantryItem {
  name: string;
  quantity: string; // Changed from qty: number to quantity: string
}

export async function pantryScan(base64: string): Promise<PantryItem[]> {
  const { data, error } = await supabase.functions.invoke('recognize-stock', {
    // Changed function name
    body: { image: base64 }, // Body remains the same
  });

  if (error) {
    console.error('Error calling recognize-stock function:', error);
    throw error;
  }

  // Assuming the Edge Function returns a structure like { items: PantryItem[] }
  // or if it directly returns PantryItem[] under data.
  // Based on the edge function code, it returns { items: [...] }
  if (data && Array.isArray(data.items)) {
    return data.items as PantryItem[];
  }

  // Fallback or error if the structure is not as expected
  console.warn('Unexpected response structure from recognize-stock:', data);
  return []; // Return empty array or throw a more specific error
}
