# 🚨 URGENT: AI Recipe Save Functionality Missing

## 📋 **Problem**
The frontend shows "Recipe Saved!" but AI recipes are not actually being saved to the database. Users expect saved AI recipes to appear in their profile.

## 🎯 **Required Backend Implementation**

### **1. Create Save AI Recipe RPC Function**

```sql
CREATE OR REPLACE FUNCTION save_ai_generated_recipe(
  p_user_id UUID,
  p_recipe_data JSONB,
  p_selected_ingredients TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipe_id UUID;
  v_recipe_title TEXT;
  v_ingredients JSONB;
  v_steps JSONB;
  v_prep_time INTEGER;
  v_cook_time INTEGER;
  v_servings INTEGER;
  v_difficulty TEXT;
  v_estimated_cost TEXT;
  v_nutrition_notes TEXT;
BEGIN
  -- Generate new recipe ID
  v_recipe_id := gen_random_uuid();
  
  -- Extract data from AI recipe
  v_recipe_title := p_recipe_data->>'name';
  v_ingredients := p_recipe_data->'ingredients';
  v_steps := p_recipe_data->'steps';
  v_prep_time := (p_recipe_data->>'estimated_time')::INTEGER;
  v_cook_time := 0; -- AI provides total time, split as needed
  v_servings := (p_recipe_data->>'servings')::INTEGER;
  v_difficulty := p_recipe_data->>'difficulty';
  v_estimated_cost := p_recipe_data->>'estimated_cost';
  v_nutrition_notes := p_recipe_data->>'nutrition_notes';
  
  -- Insert into recipe_uploads table
  INSERT INTO recipe_uploads (
    recipe_id,
    user_id,
    title,
    description,
    video_url,
    thumbnail_url,
    ingredients,
    diet_tags,
    preparation_steps,
    prep_time_minutes,
    cook_time_minutes,
    servings,
    is_public,
    is_ai_generated,
    difficulty,
    estimated_cost,
    nutrition_notes,
    created_at,
    updated_at
  ) VALUES (
    v_recipe_id,
    p_user_id,
    v_recipe_title,
    'AI-generated recipe using your pantry ingredients',
    NULL, -- No video for AI recipes
    'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg', -- Default Kitch image
    v_ingredients,
    ARRAY[]::TEXT[], -- No diet tags initially
    v_steps,
    v_prep_time,
    v_cook_time,
    v_servings,
    false, -- Private by default
    true, -- Mark as AI generated
    v_difficulty,
    v_estimated_cost,
    v_nutrition_notes,
    NOW(),
    NOW()
  );
  
  -- Log the save activity
  INSERT INTO user_activity_log (
    user_id,
    activity_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'saved_recipe',
    jsonb_build_object(
      'recipe_id', v_recipe_id,
      'recipe_title', v_recipe_title,
      'is_ai_generated', true,
      'selected_ingredients', to_jsonb(p_selected_ingredients)
    ),
    NOW()
  );
  
  -- Return success with recipe ID
  RETURN jsonb_build_object(
    'success', true,
    'recipe_id', v_recipe_id,
    'message', 'AI recipe saved successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to save AI recipe: %', SQLERRM;
END;
$$;
```

### **2. Update recipe_uploads Table Schema**

```sql
-- Add AI recipe support columns if not exists
ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard'));

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS estimated_cost TEXT;

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS nutrition_notes TEXT;

-- Add index for AI recipe queries
CREATE INDEX IF NOT EXISTS idx_recipe_uploads_ai_generated 
ON recipe_uploads(is_ai_generated, user_id);

-- Add index for user's saved recipes
CREATE INDEX IF NOT EXISTS idx_recipe_uploads_user_saved 
ON recipe_uploads(user_id, created_at DESC);
```

### **3. Create Default AI Recipe Image**

Upload a default Kitch-branded image to Supabase Storage:
- **Path**: `app-assets/kitch-ai-recipe-default.jpg`
- **Content**: Kitch logo with "AI Generated Recipe" text
- **Size**: 400x300px optimized for recipe thumbnails

### **4. Update Profile Query to Include AI Recipes**

Ensure the profile/saved recipes query includes AI-generated recipes:

```sql
-- In your existing profile recipes query, ensure it includes:
SELECT 
  r.*,
  u.username as creator_username,
  u.avatar_url as creator_avatar,
  CASE 
    WHEN r.is_ai_generated = true THEN 'AI Generated'
    ELSE u.username 
  END as display_creator
FROM recipe_uploads r
LEFT JOIN auth.users u ON r.user_id = u.id
WHERE r.user_id = p_user_id
ORDER BY r.created_at DESC;
```

## 🔧 **Frontend Integration**

The frontend will call this RPC when users tap "Save Recipe":

```typescript
const { data, error } = await supabase.rpc('save_ai_generated_recipe', {
  p_user_id: user.id,
  p_recipe_data: currentRecipe,
  p_selected_ingredients: selectedIngredients
});
```

## 🎯 **Expected Result**

After implementation:
1. ✅ Users can save AI recipes to their collection
2. ✅ Saved AI recipes appear in profile "Saved" tab
3. ✅ AI recipes have default Kitch branding image
4. ✅ Activity log tracks AI recipe saves
5. ✅ Proper database relationships maintained

## ⏰ **Priority: HIGH**
This is blocking user workflow - users expect saved recipes to persist. 