import { useQueries } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

// Define the RecipeDetailsData interface for type safety
export interface RecipeDetailsData {
  recipe_id: string;
  title: string;
  user_id: string;
  servings: number | null;
  diet_tags: string[] | null;
  is_public: boolean;
  video_url: string | null;
  created_at: string;
  description: string | null;
  username?: string | null;
  avatar_url?: string | null;
  ingredients: Array<{ name: string; unit: string | null; quantity: string | null }>;
  comments_count: number;
  cook_time_minutes: number | null;
  prep_time_minutes: number | null;
  preparation_steps: string[];
  likes: number;
  matched_ingredients?: string[];
  missing_ingredient_names?: string[];
  missing_ingredients?: string[];
}

// Define the hook's return type
interface UseRecipeDetailsResult {
  data: RecipeDetailsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useRecipeDetails = (recipeId: string | undefined, userId?: string) => {
  const results = useQueries({
    queries: [
      {
        queryKey: ['recipeDetails', recipeId],
        queryFn: async () => {
          if (!recipeId) throw new Error('Recipe ID is required');
          const { data, error } = await supabase.rpc('get_recipe_details', { p_recipe_id: recipeId });
          if (error) throw error;
          if (!data) throw new Error('Recipe not found');
          // Clean up preparation_steps (remove extra quotes and trim)
          const cleanedSteps = (data.preparation_steps || []).map(
            (step: string) => step.replace(/^"+|"+$/g, '').trim()
          );
          return {
            ...data,
            preparation_steps: cleanedSteps,
            ingredients: data.ingredients || [],
            diet_tags: data.diet_tags || [],
            description: data.description || '',
            servings: data.servings ?? null,
            prep_time_minutes: data.prep_time_minutes ?? null,
            cook_time_minutes: data.cook_time_minutes ?? null,
            video_url: data.video_url ?? null,
            likes: data.likes ?? 0,
            comments_count: data.comments_count ?? 0,
          };
        },
        enabled: !!recipeId,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
      {
        queryKey: ['pantryMatch', recipeId, userId],
        queryFn: async () => {
          if (!recipeId || !userId) return { matched_ingredients: [], missing_ingredients: [] };
          const { data, error } = await supabase.rpc('match_pantry_ingredients', {
            p_recipe_id: recipeId,
            p_user_id: userId
          });

          if (error) {
            console.error('RPC Error Details (match_pantry_ingredients):', error);
            throw new Error('Failed to fetch pantry match: ' + error.message);
          }

          if (!data) {
            console.warn('No data returned from match_pantry_ingredients');
            throw new Error('No pantry match data found');
          }

          console.log('DEBUG: useRecipeDetails - pantryQuery.data:', data);
          return {
            matched_ingredients: data?.matched_ingredients || [],
            missing_ingredients: data?.missing_ingredients || [],
          };
        },
        enabled: !!recipeId && !!userId,
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    ],
  });

  const recipeResult = results[0];
  const pantryResult = results[1];

  const isLoading = recipeResult.isLoading || pantryResult.isLoading;
  const error = recipeResult.error || pantryResult.error;

  let data: RecipeDetailsData | null = null;
  if (recipeResult.data) {
    data = {
      ...recipeResult.data,
      matched_ingredients: pantryResult.data?.matched_ingredients || [],
      missing_ingredients: pantryResult.data?.missing_ingredients || [],
      missing_ingredient_names: pantryResult.data?.missing_ingredients || [],
    };
    console.log('DEBUG: useRecipeDetails - final combined data:', data);
  }

  return {
    data,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch: () => {
      recipeResult.refetch();
      pantryResult.refetch();
    },
  };
};

export default useRecipeDetails; 