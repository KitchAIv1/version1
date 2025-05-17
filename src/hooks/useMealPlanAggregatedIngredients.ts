import { supabase } from '../services/supabase';
import { format } from 'date-fns';

// Define types for aggregated ingredients
export interface AggregatedIngredient {
  name: string;
  appearances: Array<{ quantity: string | null; unit: string | null; recipe_name: string }>;
}

export const getIngredientsForMealPlanRange = async (
  startDate: Date, 
  endDate: Date, 
  userId?: string // Accept userId as a parameter
): Promise<AggregatedIngredient[]> => {
  if (!userId) {
    console.warn('[getIngredientsForMealPlanRange] User ID not provided');
    return [];
  }
  console.log(`[getIngredientsForMealPlanRange] Attempting to get ingredients for meal plan from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')} for user ${userId}`);

  try {
    // 1. Fetch meal plan items for the range
    console.log('[getIngredientsForMealPlanRange] Step 1: Fetching meal plan items...');
    const { data: planItems, error: planError } = await supabase
      .from('meal_plans')
      .select('recipe_id, recipe_uploads(title)') 
      .eq('user_id', userId)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'));

    if (planError) {
      console.error('[getIngredientsForMealPlanRange] CRITICAL: Error fetching meal plan items:', JSON.stringify(planError, null, 2));
      throw planError;
    }

    console.log('[getIngredientsForMealPlanRange] Successfully fetched planItems. Raw data:', JSON.stringify(planItems, null, 2));

    if (!planItems || planItems.length === 0) {
      console.log('[getIngredientsForMealPlanRange] No plan items found for this date range. Returning empty array.');
      return []; 
    }

    // 2. Get unique recipe IDs
    console.log('[getIngredientsForMealPlanRange] Step 2: Processing planItems to get unique recipe IDs...');
    const recipeIdToNameMap = new Map<string, string>();
    planItems.forEach((item, idx) => {
      console.log(`[getIngredientsForMealPlanRange] Processing planItem ${idx}:`, JSON.stringify(item, null, 2));
      
      let recipeTitle: string | null | undefined = null;
      if (item.recipe_uploads) {
        if (Array.isArray(item.recipe_uploads)) {
          recipeTitle = item.recipe_uploads[0]?.title;
        } else if (typeof item.recipe_uploads === 'object' && item.recipe_uploads !== null) {
          recipeTitle = (item.recipe_uploads as any).title;
        }
      }
      
      if (item.recipe_id && recipeTitle && typeof recipeTitle === 'string') {
          recipeIdToNameMap.set(item.recipe_id, recipeTitle);
          console.log(`[getIngredientsForMealPlanRange] Added to recipeIdToNameMap: ID=${item.recipe_id}, Title=${recipeTitle}`);
      } else {
          console.warn(`[getIngredientsForMealPlanRange] Skipping planItem ${idx} due to missing recipe_id or title. Recipe ID: ${item.recipe_id}, Title: ${recipeTitle}`);
      }
    });
    const uniqueRecipeIds = Array.from(recipeIdToNameMap.keys());
    console.log('[getIngredientsForMealPlanRange] Finished processing planItems. Unique recipe IDs found:', JSON.stringify(uniqueRecipeIds, null, 2));
    
    if (uniqueRecipeIds.length === 0) {
      console.log('[getIngredientsForMealPlanRange] No unique recipe IDs with titles found after processing. Returning empty array.');
      return [];
    }

    // 3. Fetch details (specifically ingredients) for each unique recipe
    console.log('[getIngredientsForMealPlanRange] Step 3: Fetching details for unique recipe IDs:', JSON.stringify(uniqueRecipeIds, null, 2));
    const recipeDetailsPromises = uniqueRecipeIds.map(id => 
      supabase.rpc('get_recipe_details', { p_recipe_id: id, p_user_id: userId })
    );
    
    const recipeDetailsResults = await Promise.all(recipeDetailsPromises);

    // 4. Aggregate ingredients
    const aggregatedIngredientsMap = new Map<string, AggregatedIngredient>();

    recipeDetailsResults.forEach((result, index) => {
      const recipeId = uniqueRecipeIds[index];
      const recipeName = recipeIdToNameMap.get(recipeId) || 'Unknown Recipe';

      if (result.error) {
        console.warn(`[getIngredientsForMealPlanRange] Error fetching details for recipe ${recipeId}:`, result.error.message);
        return; // Skip this recipe if details fetch failed
      }

      const recipeData = Array.isArray(result.data) ? result.data[0] : result.data;
      
      if (!recipeData || !Array.isArray(recipeData.ingredients)) {
        console.warn(`[getIngredientsForMealPlanRange] No ingredients data or malformed data for recipe ${recipeId}. Data received:`, recipeData);
        return; // Skip if no ingredients
      }

      recipeData.ingredients.forEach((ing: { name: string; quantity: string | null; unit: string | null }) => {
        const ingredientName = ing.name.trim().toLowerCase(); // Normalize name
        if (!ingredientName) return; // Skip if ingredient name is empty

        if (!aggregatedIngredientsMap.has(ingredientName)) {
          aggregatedIngredientsMap.set(ingredientName, {
            name: ing.name.trim(), // Store original casing for display
            appearances: [],
          });
        }
        const existingEntry = aggregatedIngredientsMap.get(ingredientName)!;
        existingEntry.appearances.push({
          quantity: ing.quantity,
          unit: ing.unit,
          recipe_name: recipeName
        });
      });
    });
    
    const finalAggregatedList = Array.from(aggregatedIngredientsMap.values());
    console.log('[getIngredientsForMealPlanRange] Aggregated ingredients:', JSON.stringify(finalAggregatedList, null, 2));
    return finalAggregatedList;

  } catch (e) {
    console.error('[getIngredientsForMealPlanRange] Error:', e);
    return []; // Return empty on error
  }
}; 