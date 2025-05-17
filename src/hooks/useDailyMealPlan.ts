import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';

// Types for our meal plan data
export interface PlannedRecipe {
  recipe_id: string;
  recipe_title?: string; // Optional if joined, or part of the meal_plan_entries table
  recipe_thumbnail_url?: string; // Optional
  // Any other recipe details needed for display in the card
}

export interface DailyMealPlan {
  breakfast?: PlannedRecipe | null;
  lunch?: PlannedRecipe | null;
  dinner?: PlannedRecipe | null;
}

interface AddRecipeVariables {
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipeId: string;
  recipeTitle?: string;
  recipeThumbnailUrl?: string;
}

interface RemoveRecipeVariables {
  slot: 'breakfast' | 'lunch' | 'dinner';
}

// Function to fetch meal plan for a given date
const fetchDailyMealPlan = async (date: string, userId?: string): Promise<DailyMealPlan> => {
  if (!userId) throw new Error('User not authenticated');
  if (!date) throw new Error('Date not provided');

  console.log(`Fetching meal plan for date: ${date}, user: ${userId}`);

  const { data, error } = await supabase
    .rpc('get_meal_plan_for_date', { p_user_id: userId, p_plan_date: date });

  if (error) {
    console.error('Error fetching daily meal plan:', error);
    throw new Error(error.message);
  }

  // Transform the flat array from RPC into the DailyMealPlan structure
  const mealPlan: DailyMealPlan = {};
  if (data) {
    // Ensure data is an array before calling forEach
    if (Array.isArray(data)) {
      data.forEach((item: any) => {
        if (item.slot === 'breakfast') mealPlan.breakfast = { recipe_id: item.recipe_id, recipe_title: item.recipe_title, recipe_thumbnail_url: item.recipe_thumbnail_url };
        if (item.slot === 'lunch') mealPlan.lunch = { recipe_id: item.recipe_id, recipe_title: item.recipe_title, recipe_thumbnail_url: item.recipe_thumbnail_url };
        if (item.slot === 'dinner') mealPlan.dinner = { recipe_id: item.recipe_id, recipe_title: item.recipe_title, recipe_thumbnail_url: item.recipe_thumbnail_url };
      });
    } else {
      console.warn('RPC get_meal_plan_for_date did not return an array:', data);
    }
  }
  console.log('Fetched and transformed meal plan:', mealPlan);
  return mealPlan;
};

export const useDailyMealPlan = (date: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['dailyMealPlan', date, user?.id];

  const { data, isLoading, error, refetch } = useQuery<DailyMealPlan, Error>({
    queryKey,
    queryFn: () => fetchDailyMealPlan(date, user?.id),
    enabled: !!user && !!date, // Only run query if user and date are available
    staleTime: 0, // Consider data stale immediately to encourage refetching
    // placeholderData: { breakfast: null, lunch: null, dinner: null } // Optional: initial structure
  });

  const addRecipeMutation = useMutation<void, Error, AddRecipeVariables>({
    mutationFn: async ({ slot, recipeId, recipeTitle, recipeThumbnailUrl }: AddRecipeVariables) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error: rpcError } = await supabase.rpc('add_recipe_to_meal_slot', {
        p_user_id: user.id,
        p_plan_date: date,
        p_slot: slot,
        p_recipe_id: recipeId,
        p_recipe_title: recipeTitle,
        p_recipe_thumbnail_url: recipeThumbnailUrl,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      console.log('Successfully added/updated recipe, invalidated query:', queryKey);
    },
    onError: (err: Error) => {
      console.error('Error in addRecipeMutation:', err);
      // Potentially show a toast notification to the user
    },
  });

  const removeRecipeMutation = useMutation<void, Error, RemoveRecipeVariables>({
    mutationFn: async ({ slot }: RemoveRecipeVariables) => {
      if (!user?.id) throw new Error('User not authenticated');
      const { error: rpcError } = await supabase.rpc('remove_recipe_from_meal_slot', {
        p_user_id: user.id,
        p_plan_date: date,
        p_slot: slot,
      });
      if (rpcError) throw rpcError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      console.log('Successfully removed recipe, invalidated query:', queryKey);
    },
    onError: (err: Error) => {
      console.error('Error in removeRecipeMutation:', err);
    },
  });

  return {
    dailyMealPlan: data,
    isLoadingDailyMealPlan: isLoading,
    dailyMealPlanError: error,
    refetchDailyMealPlan: refetch,
    addRecipeToSlot: addRecipeMutation.mutateAsync,
    isAddingRecipe: addRecipeMutation.isPending,
    removeRecipeFromSlot: removeRecipeMutation.mutateAsync,
    isRemovingRecipe: removeRecipeMutation.isPending,
  };
}; 