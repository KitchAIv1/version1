Meal Planner V2 RPC Documentation
This document describes the Supabase RPC functions implemented for the Meal Planner V2 feature in the KitchAI v2 app. These functions manage meal plan entries for users, allowing them to plan recipes for specific meal slots on specific dates. The functions interact with the meal_plans table, which stores meal plan entries, and are secured with Row-Level Security (RLS) policies to ensure users can only access their own data.
Table: meal_plans
The meal_plans table stores meal plan entries, associating recipes with meal slots for a user on a specific date.
Columns

id: UUID (Primary Key, auto-generated using uuid_generate_v4()).
user_id: UUID (Foreign Key referencing auth.users(id)).
date: DATE (The date of the meal plan).
slot: TEXT (The meal slot, e.g., 'breakfast', 'lunch', 'dinner').
recipe_id: UUID (Foreign Key referencing recipe_uploads(id)).
recipe_title: TEXT (Optional, denormalized title of the recipe for display).
recipe_thumbnail_url: TEXT (Optional, denormalized thumbnail URL for display).
created_at: TIMESTAMP WITH TIME ZONE (Default: now()).
updated_at: TIMESTAMP WITH TIME ZONE (Default: now()).

Indexes

(user_id, date): For efficient querying of a user's daily plan.
(user_id, date, slot): For the unique constraint.

Constraints

Unique constraint on (user_id, date, slot): Ensures a user can only have one recipe per slot per day.

RLS Policies

SELECT: USING (auth.uid() = user_id)
INSERT: WITH CHECK (auth.uid() = user_id)
UPDATE: USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
DELETE: USING (auth.uid() = user_id)


RPC Functions
1. get_meal_plan_for_date
Purpose
Fetches all planned meals for a given user on a specific date, returning an array of meal slot entries with associated recipe details.
Parameters

p_user_id: UUID (The ID of the logged-in user).
p_plan_date: DATE (The date to fetch the meal plan for).

Returns

Type: JSON
Structure: An array of objects, where each object represents a meal slot and its planned recipe (or null if no recipe is planned).
Example Output:[
  {
    "slot": "breakfast",
    "recipe_id": null,
    "recipe_title": null,
    "recipe_thumbnail_url": null
  },
  {
    "slot": "dinner",
    "recipe_id": "550e8400-e29b-41d4-a716-446655440000",
    "recipe_title": "Test Recipe",
    "recipe_thumbnail_url": "https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/..."
  }
]



Logic

Selects entries from meal_plans for the given p_user_id and p_plan_date.
Joins with recipe_uploads to fetch recipe_title and recipe_thumbnail_url if not denormalized.
Returns a JSON array of slot entries.

Example Usage
SELECT get_meal_plan_for_date('03b1ede6-5dfd-44dd-9ca5-a0fa8f3f77e8', '2025-05-17');


2. add_recipe_to_meal_slot
Purpose
Adds a recipe to a specific meal slot for a user on a given date. If an entry already exists for that user, date, and slot, it updates the existing entry (upsert behavior).
Parameters

p_user_id: UUID (The ID of the logged-in user).
p_plan_date: DATE (The date to plan the meal for).
p_slot: TEXT (The meal slot, e.g., 'breakfast', 'lunch', 'dinner').
p_recipe_id: UUID (The ID of the recipe to add).
p_recipe_title: TEXT (Optional, the title of the recipe for denormalization; default: NULL).
p_recipe_thumbnail_url: TEXT (Optional, the thumbnail URL of the recipe for denormalization; default: NULL).

Returns

Type: JSON
Structure: An object representing the created or updated meal plan entry.
Example Output:{
  "slot": "dinner",
  "recipe_id": "550e8400-e29b-41d4-a716-446655440000",
  "recipe_title": "Test Recipe",
  "recipe_thumbnail_url": "https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/..."
}



Logic

Performs an INSERT ... ON CONFLICT operation on meal_plans.
If a conflict occurs on (user_id, date, slot), updates the existing entry with the new recipe_id, recipe_title, and recipe_thumbnail_url.
Sets created_at and updated_at to the current timestamp.
Returns the resulting entry as a JSON object.

Example Usage
SELECT add_recipe_to_meal_slot(
  '03b1ede6-5dfd-44dd-9ca5-a0fa8f3f77e8',
  '2025-05-17',
  'dinner',
  '550e8400-e29b-41d4-a716-446655440000',
  'Test Recipe',
  'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/...'
);


3. remove_recipe_from_meal_slot
Purpose
Removes a recipe from a specific meal slot for a user on a given date.
Parameters

p_user_id: UUID (The ID of the logged-in user).
p_plan_date: DATE (The date of the meal plan).
p_slot: TEXT (The meal slot, e.g., 'breakfast', 'lunch', 'dinner').

Returns

Type: JSON
Structure: An object indicating the success of the operation and a message.
Example Output:{
  "success": true,
  "message": "Recipe removed from meal slot"
}

or{
  "success": false,
  "message": "No recipe found to remove"
}



Logic

Deletes the entry from meal_plans where user_id, date, and slot match the inputs.
Returns a JSON object with a success boolean and a message based on whether a row was deleted.

Example Usage
SELECT remove_recipe_from_meal_slot('03b1ede6-5dfd-44dd-9ca5-a0fa8f3f77e8', '2025-05-17', 'dinner');


Usage Notes

Authentication: These RPCs rely on Supabase Auth for user context (auth.uid()). Ensure the user is authenticated when calling these functions.
RLS: RLS policies ensure users can only access their own meal plans. Verify policies are correctly applied if you encounter access issues.
Error Handling: Each RPC includes exception handling, logging errors with RAISE NOTICE and throwing a user-friendly error message.

Example Frontend Integration
The following TypeScript hooks demonstrate how to use these RPCs in the frontend:
useMealPlanner Hook
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MealPlanEntry {
  slot: string;
  recipe_id: string | null;
  recipe_title: string | null;
  recipe_thumbnail_url: string | null;
}

const useMealPlanner = (userId: string, planDate: string) => {
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>([]);

  const fetchMealPlan = async () => {
    const { data, error } = await supabase.rpc('get_meal_plan_for_date', {
      p_user_id: userId,
      p_plan_date: planDate,
    });

    if (error) {
      console.error('Error fetching meal plan:', error.message);
      return;
    }

    setMealPlan(data || []);
  };

  useEffect(() => {
    fetchMealPlan();
  }, [userId, planDate]);

  const addRecipeToMealSlot = async (slot: string, recipeId: string, recipeTitle: string, recipeThumbnailUrl: string) => {
    const { data, error } = await supabase.rpc('add_recipe_to_meal_slot', {
      p_user_id: userId,
      p_plan_date: planDate,
      p_slot: slot,
      p_recipe_id: recipeId,
      p_recipe_title: recipeTitle,
      p_recipe_thumbnail_url: recipeThumbnailUrl,
    });

    if (error) {
      console.error('Error adding recipe to meal slot:', error.message);
      return { success: false, error: error.message };
    }

    await fetchMealPlan();
    return { success: true, data };
  };

  const removeRecipeFromMealSlot = async (slot: string) => {
    const { data, error } = await supabase.rpc('remove_recipe_from_meal_slot', {
      p_user_id: userId,
      p_plan_date: planDate,
      p_slot: slot,
    });

    if (error) {
      console.error('Error removing recipe from meal slot:', error.message);
      return { success: false, error: error.message };
    }

    await fetchMealPlan();
    return { success: true, data };
  };

  return {
    mealPlan,
    addRecipeToMealSlot,
    removeRecipeFromMealSlot,
  };
};

export default useMealPlanner;

This documentation provides a comprehensive guide for using the Meal Planner V2 RPCs in the KitchAI v2 app, ensuring developers can integrate and maintain the feature effectively.
