import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase'; // Corrected path to supabase client
import { RecipeItem } from '../types'; // Adjusted type import and path
import { useAuth } from '../providers/AuthProvider'; // Added

// Define an expected structure for the get_user_profile RPC response
interface UserProfile {
  // Add other profile fields if known/needed, otherwise keep minimal
  recipes?: RecipeItem[]; // All user-associated recipes (created, etc.)
  saved_recipes?: RecipeItem[]; // Explicitly saved recipes
  created_recipes?: RecipeItem[]; // Potentially another distinct list if backend provides it
  // If recipes are directly at the root of the data, this structure isn't strictly needed for extraction
}

// Modified to accept userId
const fetchUserRecipes = async (userId?: string): Promise<RecipeItem[]> => {
  console.log(
    '[[USE_USER_RECIPES_HOOK_V2_FETCH_START]] Calling get_profile_details. UserID:',
    userId,
  );
  if (!userId) {
    console.error(
      '[[USE_USER_RECIPES_HOOK_V2_FETCH_ERROR]] User not authenticated for get_profile_details',
    );
    throw new Error('User not authenticated for fetching profile details');
  }

  // Switched to call get_profile_details
  const { data, error } = await supabase.rpc('get_profile_details', {
    p_user_id: userId,
  });

  if (error) {
    console.error(
      '[[USE_USER_RECIPES_HOOK_V2_FETCH_ERROR]] Error fetching profile details:',
      error,
    );
    throw new Error(`Failed to fetch profile details: ${error.message}`);
  }

  console.log(
    '[[USE_USER_RECIPES_HOOK_V2_FETCH_SUCCESS]] Data received from get_profile_details:',
    data,
  );

  const profileData = data as UserProfile; // Or data could be an array, or directly contain recipes

  // Prioritize saved_recipes if it exists and is an array
  if (profileData && Array.isArray(profileData.saved_recipes)) {
    console.log(
      '[[USE_USER_RECIPES_HOOK_V2_FETCH_RETURNING]] from profileData.saved_recipes:',
      profileData.saved_recipes,
    );
    // Ensure the items in saved_recipes conform to RecipeItem, if not, map them here.
    // Assuming they already do based on the log structure provided by the user.
    return profileData.saved_recipes;
  }

  // Fallback or alternative logic if needed (e.g., if saved_recipes isn't always present)
  // For now, if saved_recipes isn't there, we will fall through to the warning.
  // If profileData.recipes was meant as a fallback, that logic could be reinstated here with a different log.

  console.warn(
    '[[USE_USER_RECIPES_HOOK_V2_FETCH_WARN]] No saved_recipes array found in expected format within get_profile_details response',
    data,
  );
  console.log(
    '[[USE_USER_RECIPES_HOOK_V2_FETCH_RETURNING]] Empty array (default from get_profile_details attempt)',
  );
  return [];
};

export const useUserRecipes = () => {
  const { user } = useAuth(); // Get user from AuthProvider

  return useQuery<RecipeItem[], Error>({
    queryKey: ['userSavedRecipes', user?.id], // QueryKey changed to reflect specificity
    queryFn: () => fetchUserRecipes(user?.id), // Pass user?.id to fetch function
    enabled: !!user?.id, // Only run query if user.id is available
  });
};
