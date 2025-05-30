import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';

export interface RecipeMatch {
  id: string;
  title: string;
  description: string;
  image_url: string;
  creator_id: string;
  creator_name: string;
  creator_avatar: string;
  match_percentage: number;
  missing_ingredients: string[];
  total_ingredients: number;
  matched_ingredients: number;
  cook_time: number;
  difficulty: string;
  created_at: string;
}

export interface RecipeSuggestionsResponse {
  recipe_matches: RecipeMatch[];
  total_matches: number;
  user_tier: 'FREEMIUM' | 'PREMIUM';
  suggestions_remaining: number;
  ai_generation_available: boolean;
}

export const useRecipeSuggestions = (selectedIngredients: string[]) => {
  const { user } = useAuth();

  return useQuery<RecipeSuggestionsResponse>({
    queryKey: ['recipe-suggestions', selectedIngredients, user?.id],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('[useRecipeSuggestions] Fetching suggestions for ingredients:', selectedIngredients);
      console.log('[useRecipeSuggestions] User ID:', user.id);
      console.log('[useRecipeSuggestions] Ingredients being sent to backend:', JSON.stringify(selectedIngredients, null, 2));

      const { data, error } = await supabase.rpc('generate_recipe_suggestions', {
        p_user_id: user.id,
        p_selected_ingredients: selectedIngredients,
        p_freemium_limit: 10
      });

      if (error) {
        console.error('[useRecipeSuggestions] RPC Error:', error);
        throw new Error(`Failed to fetch recipe suggestions: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from recipe suggestions API');
      }

      console.log('[useRecipeSuggestions] Successfully fetched suggestions:', data);
      console.log('[useRecipeSuggestions] Raw backend response structure:', JSON.stringify(data, null, 2));
      console.log('[useRecipeSuggestions] Database matches array:', data.database_matches);
      console.log('[useRecipeSuggestions] Number of matches found:', data.database_matches?.length || 0);

      // Map backend response to frontend interface
      const mappedRecipeMatches = (data.database_matches || []).map((match: any) => ({
        id: match.recipe_id,
        title: match.recipe_title,
        description: match.description || '',
        image_url: match.thumbnail_url || '',
        creator_id: match.creator_id || '',
        creator_name: match.creator_username || '',
        creator_avatar: match.creator_avatar || '',
        match_percentage: match.match_percentage || 0,
        missing_ingredients: match.missing_ingredients || [],
        total_ingredients: match.total_ingredients || 0,
        matched_ingredients: match.matched_ingredients || 0,
        cook_time: match.cook_time_minutes || 0,
        difficulty: match.difficulty || 'Medium',
        created_at: match.created_at || new Date().toISOString(),
      }));

      return {
        recipe_matches: mappedRecipeMatches,
        total_matches: data.total_matches_found || data.matches_returned || mappedRecipeMatches.length,
        user_tier: data.user_tier || 'FREEMIUM',
        suggestions_remaining: data.suggestions_remaining || 0,
        ai_generation_available: true,
      };
    },
    enabled: selectedIngredients.length >= 3 && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('not authenticated')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}; 