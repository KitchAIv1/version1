import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

// Define an expected structure for the data returned by the RPC
// This should be refined based on the actual RPC output
// Placeholder - adjust based on actual 'get_recipe_details_with_pantry_match' return type
export interface RecipeDetailsData {
  output_id: string;
  output_name: string;
  output_video_url: string;
  output_likes: number;
  output_is_liked: boolean;
  output_is_saved: boolean;
  output_pantry_match_pct: number; // Assuming RPC provides this directly or calculate if needed
  // Add ALL other fields returned by the RPC:
  // e.g., ingredients: Array<{ name: string; quantity: number; unit: string }>;
  // e.g., steps: string[];
  // e.g., macros: { calories: number; protein: number; carbs: number; fat: number };
  // e.g., comments: Array<{ userId: string; text: string; createdAt: string }>;
  // e.g., creator_user_id: string;
  // e.g., creator_username: string;
  // e.g., creator_avatar_url: string | null;
  [key: string]: any; // Allow other fields for now
}


export const useRecipeDetails = (id: string | undefined, userId: string | undefined) =>
  useQuery<RecipeDetailsData, Error>({ // Specify return type and error type
    queryKey: ['recipe', id], // Query key uses recipe ID
    queryFn: async () => {
      if (!id || !userId) { // Check if ids are available
        throw new Error('Recipe ID or User ID is required.');
      }
      console.log(`Fetching details for recipe: ${id}, user: ${userId}`);
      const { data, error } = await supabase.rpc(
        'get_recipe_details_with_pantry_match',
        { recipe_id_param: id, user_id_param: userId }
      );
      
      if (error) {
        console.error('Supabase RPC error fetching recipe details:', error);
        throw error;
      }
      
      console.log('Received recipe details data:', data);

      // Check if data is an array and has at least one element
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Recipe details not found or invalid data format.');
      }

      // Assuming the RPC returns an array containing a single object
      // Add type assertion if necessary, after inspecting the actual data structure
      return data[0] as RecipeDetailsData; 
    },
    enabled: !!id && !!userId, // Only run the query if both id and userId are available
    staleTime: 5 * 60 * 1000, // Keep data fresh for 5 minutes
  }); 