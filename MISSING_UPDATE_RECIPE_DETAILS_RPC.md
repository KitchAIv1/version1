# 🚨 MISSING: update_recipe_details RPC Function

## 📋 **Problem**
The frontend is calling `update_recipe_details` RPC function but this function **does not exist** in the codebase.

**Frontend Call (EditRecipeScreen.tsx:295):**
```typescript
const { error: updateRpcError } = await supabase.rpc('update_recipe_details', updatedRecipePayload);
```

**Frontend Payload:**
```typescript
const updatedRecipePayload = {
  p_recipe_id: initialRecipeData.recipe_id,
  p_title: title.trim(),
  p_description: description.trim(),
  p_video_url: initialRecipeData.video_url,
  p_thumbnail_url: finalThumbnailUrl,
  p_ingredients: ingredients.filter(ing => ing.name.trim() !== ''),
  p_diet_tags: dietTags,
  p_preparation_steps: preparationSteps.filter(step => step.trim() !== ''), // ⚠️ Expects JSONB now
  p_prep_time_minutes: parseInt(prepTimeMinutes) || null,
  p_cook_time_minutes: parseInt(cookTimeMinutes) || null,
  p_servings: parseInt(servings) || null,
  p_is_public: isPublic,
};
```

## 🔧 **Required Implementation**

### **Create update_recipe_details RPC Function**
```sql
CREATE OR REPLACE FUNCTION update_recipe_details(
  p_recipe_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_ingredients JSONB DEFAULT '[]'::JSONB,
  p_diet_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_preparation_steps TEXT[] DEFAULT ARRAY[]::TEXT[], -- ⚠️ Frontend sends TEXT[], convert to JSONB
  p_prep_time_minutes INTEGER DEFAULT NULL,
  p_cook_time_minutes INTEGER DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the recipe exists and user has permission to edit
  IF NOT EXISTS (
    SELECT 1 FROM recipe_uploads 
    WHERE id = p_recipe_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Recipe not found or permission denied';
  END IF;

  -- Update the recipe with JSONB conversion for preparation_steps
  UPDATE recipe_uploads 
  SET 
    title = p_title,
    description = p_description,
    video_url = p_video_url,
    thumbnail_url = p_thumbnail_url,
    ingredients = p_ingredients,
    diet_tags = p_diet_tags,
    preparation_steps = to_jsonb(p_preparation_steps), -- ✅ Convert TEXT[] to JSONB
    prep_time_minutes = p_prep_time_minutes,
    cook_time_minutes = p_cook_time_minutes,
    servings = p_servings,
    is_public = p_is_public,
    updated_at = NOW()
  WHERE id = p_recipe_id AND user_id = auth.uid();

  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update recipe - no rows affected';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_recipe_details(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, BOOLEAN
) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_recipe_details(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, BOOLEAN
) IS 'Update recipe details with automatic TEXT[] to JSONB conversion for preparation_steps';
```

### **Alternative: Handle Both Formats**
If you want to support both TEXT[] and JSONB inputs:

```sql
CREATE OR REPLACE FUNCTION update_recipe_details(
  p_recipe_id UUID,
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_video_url TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL,
  p_ingredients JSONB DEFAULT '[]'::JSONB,
  p_diet_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_preparation_steps TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_prep_time_minutes INTEGER DEFAULT NULL,
  p_cook_time_minutes INTEGER DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_is_public BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_steps_jsonb JSONB;
BEGIN
  -- Convert preparation_steps to JSONB regardless of input format
  IF p_preparation_steps IS NOT NULL THEN
    v_steps_jsonb := to_jsonb(p_preparation_steps);
  ELSE
    v_steps_jsonb := '[]'::JSONB;
  END IF;

  -- Verify the recipe exists and user has permission to edit
  IF NOT EXISTS (
    SELECT 1 FROM recipe_uploads 
    WHERE id = p_recipe_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Recipe not found or permission denied';
  END IF;

  -- Update the recipe
  UPDATE recipe_uploads 
  SET 
    title = p_title,
    description = p_description,
    video_url = p_video_url,
    thumbnail_url = p_thumbnail_url,
    ingredients = p_ingredients,
    diet_tags = p_diet_tags,
    preparation_steps = v_steps_jsonb, -- ✅ Always JSONB
    prep_time_minutes = p_prep_time_minutes,
    cook_time_minutes = p_cook_time_minutes,
    servings = p_servings,
    is_public = p_is_public,
    updated_at = NOW()
  WHERE id = p_recipe_id AND user_id = auth.uid();

  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update recipe - no rows affected';
  END IF;
END;
$$;
```

## 🔒 **Security Considerations**
- ✅ Uses `auth.uid()` to ensure users can only edit their own recipes
- ✅ Includes permission verification before update
- ✅ Uses `SECURITY DEFINER` for elevated permissions
- ✅ Validates recipe exists before attempting update

## 🧪 **Testing**
```sql
-- Test the function
SELECT update_recipe_details(
  'your-recipe-uuid'::UUID,
  'Updated Recipe Title',
  'Updated description',
  'https://video-url.com',
  'https://thumbnail-url.com',
  '[{"name": "chicken", "quantity": "2", "unit": "breasts"}]'::JSONB,
  ARRAY['healthy', 'protein']::TEXT[],
  ARRAY['Step 1: Prep ingredients', 'Step 2: Cook chicken']::TEXT[],
  15,
  25,
  4,
  true
);
```

## ⏰ **Priority: HIGH**
This is blocking the recipe editing functionality. Users cannot save changes to their recipes. 