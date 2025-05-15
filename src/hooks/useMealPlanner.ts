import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../providers/AuthProvider';
import { startOfWeek, endOfWeek, format, addDays, parseISO } from 'date-fns'; // Date utility library

// Define types for meal plan items, slots, etc.
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface MealPlanItem {
  id: string; // meal_plans table PK
  user_id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipe_id: string;
  // Potentially include basic recipe info like name/thumbnail for display
  recipe_name?: string;
  recipe_thumbnail_url?: string;
}

// For aggregated ingredients
export interface AggregatedIngredient {
  name: string;
  // For simplicity, quantities are kept as an array of strings with their units
  // e.g., [{ quantity: "2", unit: "cups" }, { quantity: "100", unit: "g" }]
  // True aggregation (e.g., "2 cups" + "240g" if they are the same ingredient) is complex and out of scope for now.
  appearances: Array<{ quantity: string | null; unit: string | null; recipe_name: string }>;
  // recipe_ids: string[]; // To trace back which recipes use this ingredient
}

export interface UseMealPlannerReturn {
  mealPlan: Record<string, Partial<Record<MealSlot, MealPlanItem | null>>>; // Date string as key
  loading: boolean;
  error: any | null;
  fetchMealPlanForDateRange: (startDate: Date, endDate: Date) => Promise<void>;
  addRecipeToSlot: (date: string, slot: MealSlot, recipeId: string, recipeName?: string, recipeThumbnailUrl?: string) => Promise<MealPlanItem | null>;
  removeRecipeFromSlot: (mealPlanItemId: string) => Promise<void>;
  getIngredientsForMealPlanRange: (startDate: Date, endDate: Date) => Promise<AggregatedIngredient[]>;
  // TODO: exportToGroceryList: (startDate: Date, endDate: Date) => Promise<void>;
}

const useMealPlanner = (): UseMealPlannerReturn => {
  const { user } = useAuth();
  const [mealPlan, setMealPlan] = useState<UseMealPlannerReturn['mealPlan']>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any | null>(null);

  const fetchMealPlanForDateRange = useCallback(async (startDate: Date, endDate: Date) => {
    if (!user) {
      setError(new Error('User not authenticated'));
      setMealPlan({});
      return;
    }
    setLoading(true);
    setError(null);

    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');

    console.log(`[useMealPlanner] Fetching meal plan from ${formattedStartDate} to ${formattedEndDate} for user ${user.id}`);

    try {
      const { data, error: fetchError } = await supabase
        .from('meal_plans')
        .select(`
          id,
          date,
          slot,
          recipe_id,
          recipe_uploads (title, thumbnail_url)
        `)
        .eq('user_id', user.id)
        .gte('date', formattedStartDate)
        .lte('date', formattedEndDate)
        .order('date', { ascending: true });

      if (fetchError) {
        console.error('[useMealPlanner] Supabase fetch error:', fetchError);
        throw fetchError;
      }

      const newMealPlan: UseMealPlannerReturn['mealPlan'] = {};
      // Initialize meal plan with all days in the range, even if no items exist
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        newMealPlan[dateKey] = {
          breakfast: null,
          lunch: null,
          dinner: null,
          snack: null,
        };
        currentDate = addDays(currentDate, 1);
      }
      
      if (data) {
        data.forEach((item: any) => {
          const dateKey = item.date; // Assumes date from DB is already YYYY-MM-DD string
          if (!newMealPlan[dateKey]) {
            // This case should ideally not happen if we pre-initialize, but as a safeguard:
            newMealPlan[dateKey] = {}; 
          }
          newMealPlan[dateKey][item.slot as MealSlot] = {
            id: item.id,
            user_id: user.id, // Already known, but good to have in the object
            date: item.date,
            slot: item.slot,
            recipe_id: item.recipe_id,
            recipe_name: item.recipe_uploads?.title,
            recipe_thumbnail_url: item.recipe_uploads?.thumbnail_url,
          };
        });
      }
      console.log('[useMealPlanner] Fetched and processed meal plan:', JSON.stringify(newMealPlan, null, 2));
      setMealPlan(newMealPlan);
    } catch (e) {
      console.error('[useMealPlanner] Error in fetchMealPlanForDateRange:', e);
      setError(e);
      setMealPlan({}); // Clear meal plan on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addRecipeToSlot = useCallback(async (date: string, slot: MealSlot, recipeId: string, recipeName?: string, recipeThumbnailUrl?: string): Promise<MealPlanItem | null> => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return null;
    }
    setLoading(true);
    setError(null);
    console.log(`[useMealPlanner] Adding recipe ${recipeId} to ${date} [${slot}] for user ${user.id}`);

    try {
      // Check if an item already exists for this date and slot
      const { data: existing, error: selectError } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('slot', slot)
        .maybeSingle(); // Returns one row or null

      if (selectError) {
        console.error('[useMealPlanner] Error checking for existing meal item:', selectError);
        throw selectError;
      }

      let mealPlanItemId: string;
      let operationSucceeded = false;

      if (existing) {
        // Update existing item
        const { data: updateData, error: updateError } = await supabase
          .from('meal_plans')
          .update({ recipe_id: recipeId })
          .eq('id', existing.id)
          .select('id')
          .single(); 
        if (updateError) throw updateError;
        mealPlanItemId = updateData.id;
        operationSucceeded = true;
        console.log(`[useMealPlanner] Updated meal item ${mealPlanItemId}`);
      } else {
        // Insert new item
        const { data: insertData, error: insertError } = await supabase
          .from('meal_plans')
          .insert({ user_id: user.id, date, slot, recipe_id: recipeId })
          .select('id')
          .single();
        if (insertError) throw insertError;
        mealPlanItemId = insertData.id;
        operationSucceeded = true;
        console.log(`[useMealPlanner] Inserted new meal item ${mealPlanItemId}`);
      }

      if (operationSucceeded) {
        // Optimistically update local state or refetch
        // For now, let's create the item for optimistic update
        const newItem: MealPlanItem = {
          id: mealPlanItemId,
          user_id: user.id,
          date,
          slot,
          recipe_id: recipeId,
          recipe_name: recipeName, // Use provided name, or it will be fetched next time
          recipe_thumbnail_url: recipeThumbnailUrl, // Use provided thumbnail, or it will be fetched
        };

        setMealPlan(prevMealPlan => {
          const updatedPlan = { ...prevMealPlan };
          if (!updatedPlan[date]) updatedPlan[date] = {};
          updatedPlan[date][slot] = newItem;
          return updatedPlan;
        });
        return newItem;
      }
      return null;
    } catch (e) {
      console.error('[useMealPlanner] Error in addRecipeToSlot:', e);
      setError(e);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const removeRecipeFromSlot = useCallback(async (mealPlanItemId: string) => {
    if (!user) {
      setError(new Error('User not authenticated'));
      return;
    }
    setLoading(true);
    setError(null);
    console.log(`[useMealPlanner] Removing meal plan item ${mealPlanItemId} for user ${user.id}`);

    try {
      // Find the item to get its date and slot for optimistic update
      let itemDate: string | null = null;
      let itemSlot: MealSlot | null = null;

      for (const dateKey in mealPlan) {
        for (const slotKey in mealPlan[dateKey]) {
          const item = mealPlan[dateKey][slotKey as MealSlot];
          if (item && item.id === mealPlanItemId) {
            itemDate = dateKey;
            itemSlot = slotKey as MealSlot;
            break;
          }
        }
        if (itemDate) break;
      }

      const { error: deleteError } = await supabase
        .from('meal_plans')
        .delete()
        .eq('id', mealPlanItemId)
        .eq('user_id', user.id); // Ensure user can only delete their own items

      if (deleteError) {
        console.error('[useMealPlanner] Supabase delete error:', deleteError);
        throw deleteError;
      }

      console.log(`[useMealPlanner] Successfully deleted meal plan item ${mealPlanItemId}`);
      // Optimistically update local state
      if (itemDate && itemSlot) {
        const dateStr = itemDate; // Already a string
        const slotStr = itemSlot; // Already a MealSlot
        setMealPlan(prevMealPlan => {
          const updatedPlan = { ...prevMealPlan };
          if (updatedPlan[dateStr] && updatedPlan[dateStr][slotStr]) {
            updatedPlan[dateStr][slotStr] = null; 
          }
          return updatedPlan;
        });
      } else {
        // If not found in local state (should be rare), refetch might be an option
        // For now, we assume it was found or the UI will eventually reflect change on next full fetch
        console.warn(`[useMealPlanner] Item ${mealPlanItemId} not found in local state for optimistic update after deletion.`);
      }

    } catch (e) {
      console.error('[useMealPlanner] Error in removeRecipeFromSlot:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [user, mealPlan]); // Added mealPlan to dependencies for optimistic update

  const getIngredientsForMealPlanRange = useCallback(async (startDate: Date, endDate: Date): Promise<AggregatedIngredient[]> => {
    if (!user) {
      console.warn('[useMealPlanner:getIngredients] User not authenticated');
      return [];
    }
    console.log(`[useMealPlanner:getIngredients] Attempting to get ingredients for meal plan from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')} for user ${user.id}`);

    try {
      // 1. Fetch meal plan items for the range
      console.log('[useMealPlanner:getIngredients] Step 1: Fetching meal plan items...');
      const { data: planItems, error: planError } = await supabase
        .from('meal_plans')
        .select('recipe_id, recipe_uploads(title)') 
        .eq('user_id', user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (planError) {
        console.error('[useMealPlanner:getIngredients] CRITICAL: Error fetching meal plan items:', JSON.stringify(planError, null, 2));
        throw planError;
      }

      console.log('[useMealPlanner:getIngredients] Successfully fetched planItems. Raw data:', JSON.stringify(planItems, null, 2));

      if (!planItems || planItems.length === 0) {
        console.log('[useMealPlanner:getIngredients] No plan items found for this date range. Returning empty array.');
        return []; 
      }

      // 2. Get unique recipe IDs
      console.log('[useMealPlanner:getIngredients] Step 2: Processing planItems to get unique recipe IDs...');
      const recipeIdToNameMap = new Map<string, string>();
      planItems.forEach((item, idx) => {
        console.log(`[useMealPlanner:getIngredients] Processing planItem ${idx}:`, JSON.stringify(item, null, 2));
        
        // Handle a more complex type for recipe_uploads which might be an object or an array
        let recipeTitle: string | null | undefined = null;
        if (item.recipe_uploads) {
          if (Array.isArray(item.recipe_uploads)) {
            // If it's an array, take title from the first element if it exists
            recipeTitle = item.recipe_uploads[0]?.title;
          } else if (typeof item.recipe_uploads === 'object' && item.recipe_uploads !== null) {
            // If it's a non-null object, assume it has a title property
            // Cast to any to access title, as TS might still think it's an array based on broader schema types
            recipeTitle = (item.recipe_uploads as any).title;
          }
        }
        
        if (item.recipe_id && recipeTitle && typeof recipeTitle === 'string') {
            recipeIdToNameMap.set(item.recipe_id, recipeTitle);
            console.log(`[useMealPlanner:getIngredients] Added to recipeIdToNameMap: ID=${item.recipe_id}, Title=${recipeTitle}`);
        } else {
            console.warn(`[useMealPlanner:getIngredients] Skipping planItem ${idx} due to missing recipe_id or title. Recipe ID: ${item.recipe_id}, Title: ${recipeTitle}`);
        }
      });
      const uniqueRecipeIds = Array.from(recipeIdToNameMap.keys());
      console.log('[useMealPlanner:getIngredients] Finished processing planItems. Unique recipe IDs found:', JSON.stringify(uniqueRecipeIds, null, 2));
      
      if (uniqueRecipeIds.length === 0) {
        console.log('[useMealPlanner:getIngredients] No unique recipe IDs with titles found after processing. Returning empty array.');
        return [];
      }

      // 3. Fetch details (specifically ingredients) for each unique recipe
      console.log('[useMealPlanner:getIngredients] Step 3: Fetching details for unique recipe IDs:', JSON.stringify(uniqueRecipeIds, null, 2));
      const recipeDetailsPromises = uniqueRecipeIds.map(id => 
        supabase.rpc('get_recipe_details', { p_recipe_id: id, p_user_id: user.id })
      );
      
      const recipeDetailsResults = await Promise.all(recipeDetailsPromises);

      // 4. Aggregate ingredients
      const aggregatedIngredientsMap = new Map<string, AggregatedIngredient>();

      recipeDetailsResults.forEach((result, index) => {
        const recipeId = uniqueRecipeIds[index];
        const recipeName = recipeIdToNameMap.get(recipeId) || 'Unknown Recipe';

        if (result.error) {
          console.warn(`[useMealPlanner:getIngredients] Error fetching details for recipe ${recipeId}:`, result.error.message);
          return; // Skip this recipe if details fetch failed
        }

        // Handle cases where RPC might return data as an array (e.g., [{...recipe_details...}])
        // or as a direct object if the function returns a single composite type.
        const recipeData = Array.isArray(result.data) ? result.data[0] : result.data;
        
        if (!recipeData || !Array.isArray(recipeData.ingredients)) {
          console.warn(`[useMealPlanner:getIngredients] No ingredients data or malformed data for recipe ${recipeId}. Data received:`, recipeData);
          return; // Skip if no ingredients
        }

        recipeData.ingredients.forEach((ing: { name: string; quantity: string | null; unit: string | null }) => {
          const ingredientName = ing.name.trim().toLowerCase(); // Normalize name
          if (!ingredientName) return; // Skip if ingredient name is empty

          if (!aggregatedIngredientsMap.has(ingredientName)) {
            aggregatedIngredientsMap.set(ingredientName, {
              name: ing.name.trim(), // Store original casing for display
              appearances: [],
              // recipe_ids: []
            });
          }
          const existingEntry = aggregatedIngredientsMap.get(ingredientName)!;
          existingEntry.appearances.push({
            quantity: ing.quantity,
            unit: ing.unit,
            recipe_name: recipeName
          });
          // if (!existingEntry.recipe_ids.includes(recipeId)) {
          //   existingEntry.recipe_ids.push(recipeId);
          // }
        });
      });
      
      const finalAggregatedList = Array.from(aggregatedIngredientsMap.values());
      console.log('[useMealPlanner:getIngredients] Aggregated ingredients:', JSON.stringify(finalAggregatedList, null, 2));
      return finalAggregatedList;

    } catch (e) {
      console.error('[useMealPlanner:getIngredients] Error:', e);
      return []; // Return empty on error
    }
  }, [user]);

  return {
    mealPlan,
    loading,
    error,
    fetchMealPlanForDateRange,
    addRecipeToSlot,
    removeRecipeFromSlot,
    getIngredientsForMealPlanRange,
  };
};

export default useMealPlanner; 