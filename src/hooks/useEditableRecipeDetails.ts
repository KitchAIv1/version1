import { useQuery, QueryKey } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';

// Re-defining Ingredient interface here for clarity, though it might also exist elsewhere
export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

// Defines the data structure specifically for what EditRecipeScreen needs
export interface RecipeEditableData {
  recipe_id: string;
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  diet_tags: string[];
  preparation_steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  video_url: string; // Original video URL, to be passed back if not changed
  thumbnail_url: string | null; // Current thumbnail URL
  is_public: boolean;
}

interface UseEditableRecipeDetailsReturn {
  data: RecipeEditableData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export const useEditableRecipeDetails = (
  recipeId: string | null | undefined,
): UseEditableRecipeDetailsReturn => {
  const { user } = useAuth();
  const userId = user?.id;

  const { data, isLoading, isError, error } = useQuery<
    RecipeEditableData,
    Error,
    RecipeEditableData,
    QueryKey
  >({
    queryKey: ['editableRecipeDetails', recipeId, userId],
    queryFn: async () => {
      if (!recipeId) {
        throw new Error(
          'Recipe ID is required to fetch editable recipe details.',
        );
      }
      if (!userId) {
        throw new Error(
          'User ID is required to fetch editable recipe details.',
        );
      }

      console.log(
        `[useEditableRecipeDetails] Fetching details for recipe ID: ${recipeId} and user ID: ${userId}`,
      );
      // Call get_recipe_details, which returns more fields than needed by RecipeEditableData.
      // We will select/map only the necessary fields.
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_recipe_details',
        { p_recipe_id: recipeId, p_user_id: userId },
      );

      if (rpcError) {
        console.error(
          `[useEditableRecipeDetails] Supabase RPC Error for recipe ${recipeId}:`,
          rpcError,
        );
        throw rpcError;
      }

      if (!rpcData) {
        console.warn(
          `[useEditableRecipeDetails] No data structure returned from RPC for recipe: ${recipeId}.`,
        );
        throw new Error(
          'Editable recipe details not found or RPC returned empty.',
        );
      }

      console.log(
        `[useEditableRecipeDetails] Raw data from RPC for ${recipeId}:`,
        JSON.stringify(rpcData, null, 2),
      );

      const rawRecipe = rpcData as any; // Cast with caution, ensure RPC fields exist

      // Map the RPC response to the RecipeEditableData interface
      // Ensuring type safety and picking only the required fields
      const formattedRecipe: RecipeEditableData = {
        recipe_id: String(rawRecipe.recipe_id),
        title: String(rawRecipe.title),
        description: rawRecipe.description
          ? String(rawRecipe.description)
          : null,
        ingredients: Array.isArray(rawRecipe.ingredients)
          ? rawRecipe.ingredients.map((ing: any) => ({
              name: String(ing.ingredient ?? ing.name ?? ''), // FIX: Map database 'ingredient' field to display 'name' field
              quantity: String(ing.quantity ?? ''),
              unit: String(ing.unit ?? ''),
            }))
          : [],
        diet_tags: Array.isArray(rawRecipe.diet_tags)
          ? rawRecipe.diet_tags.map(String)
          : [],
        preparation_steps: Array.isArray(rawRecipe.preparation_steps)
          ? rawRecipe.preparation_steps.map(String)
          : [],
        prep_time_minutes:
          typeof rawRecipe.prep_time_minutes === 'number'
            ? rawRecipe.prep_time_minutes
            : null,
        cook_time_minutes:
          typeof rawRecipe.cook_time_minutes === 'number'
            ? rawRecipe.cook_time_minutes
            : null,
        servings:
          typeof rawRecipe.servings === 'number' ? rawRecipe.servings : null,
        video_url: String(rawRecipe.video_url ?? ''), // Ensure video_url is a string
        thumbnail_url: rawRecipe.thumbnail_url
          ? String(rawRecipe.thumbnail_url)
          : null,
        is_public:
          typeof rawRecipe.is_public === 'boolean'
            ? rawRecipe.is_public
            : false,
      };

      return formattedRecipe;
    },
    enabled: !!recipeId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetching
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    retry: 1, // Only retry once to prevent multiple requests
    refetchOnWindowFocus: false, // Don't refetch when window gains focus
    refetchOnMount: true, // Always fetch fresh data when component mounts
  });

  return {
    data,
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
  };
};

// No default export needed if only one hook is in the file and it's named export
// export default useEditableRecipeDetails;
