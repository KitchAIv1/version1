# 🚨 AI Recipe Not Showing in Profile Saved Tab - CRITICAL FIX

## 📋 **Problem Identified**

AI recipes are not appearing in the Profile "Saved" tab because of a **missing database relationship**.

**Root Cause**: 
- ✅ AI recipes are saved to `recipe_uploads` table  
- ❌ AI recipes are NOT added to `saved_recipe_videos` table
- 🔍 Profile's "Saved" tab queries `saved_recipe_videos` table

## 🎯 **The Core Issue**

### **Current AI Recipe Save Flow:**
```sql
-- save_ai_generated_recipe RPC only does this:
INSERT INTO recipe_uploads (
  recipe_id, user_id, title, ...
) VALUES (...);
```

### **But Profile Query Expects:**
```sql
-- get_profile_details RPC looks for saved recipes here:
SELECT ... FROM saved_recipe_videos srv
JOIN recipe_uploads r ON srv.recipe_id = r.id  
WHERE srv.user_id = p_user_id
```

## 🔧 **Required Backend Fix**

### **Update `save_ai_generated_recipe` RPC**

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
  v_cook_time := 0;
  v_servings := (p_recipe_data->>'servings')::INTEGER;
  v_difficulty := p_recipe_data->>'difficulty';
  v_estimated_cost := p_recipe_data->>'estimated_cost';
  v_nutrition_notes := p_recipe_data->>'nutrition_notes';
  
  -- 1. Insert into recipe_uploads table (EXISTING)
  INSERT INTO recipe_uploads (
    id,  -- ✅ Use 'id' column, not 'recipe_id'
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
    v_recipe_id,  -- ✅ This becomes the recipe's 'id'
    p_user_id,
    v_recipe_title,
    'AI-generated recipe using your pantry ingredients',
    NULL,
    'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg',
    v_ingredients,
    ARRAY[]::TEXT[],
    v_steps,
    v_prep_time,
    v_cook_time,
    v_servings,
    false,
    true,
    v_difficulty,
    v_estimated_cost,
    v_nutrition_notes,
    NOW(),
    NOW()
  );
  
  -- 2. ✅ NEW: Add to saved_recipe_videos (THE MISSING PIECE!)
  INSERT INTO saved_recipe_videos (
    user_id,
    recipe_id,  -- References recipe_uploads.id
    saved_at
  ) VALUES (
    p_user_id,
    v_recipe_id,  -- ✅ Same ID as recipe_uploads.id
    NOW()
  );
  
  -- 3. Log the save activity
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

### **Ensure `saved_recipe_videos` Table Exists**

```sql
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS saved_recipe_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  recipe_id UUID REFERENCES recipe_uploads(id) ON DELETE CASCADE NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)  -- Prevent duplicate saves
);

-- Add RLS policies
ALTER TABLE saved_recipe_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved recipes" ON saved_recipe_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save recipes" ON saved_recipe_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave their recipes" ON saved_recipe_videos
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_saved_recipe_videos_user_id ON saved_recipe_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipe_videos_saved_at ON saved_recipe_videos(saved_at DESC);
```

## 📊 **Table Relationship Verification**

After the fix, the flow will be:

1. **AI Recipe Generated** → Saved to `recipe_uploads` table ✅
2. **AI Recipe Saved** → Added to `saved_recipe_videos` table ✅  
3. **Profile Query** → Joins both tables correctly ✅
4. **"Saved" Tab** → Shows AI recipes ✅

## 🧪 **Testing Steps**

1. **Generate and save an AI recipe**
2. **Check database:**
   ```sql
   -- Verify recipe exists
   SELECT id, title, is_ai_generated FROM recipe_uploads 
   WHERE user_id = 'USER_ID' AND is_ai_generated = true;
   
   -- Verify saved entry exists  
   SELECT * FROM saved_recipe_videos 
   WHERE user_id = 'USER_ID' AND recipe_id = 'RECIPE_ID';
   ```
3. **Check Profile "Saved" tab** - AI recipes should now appear!

## ⚡ **Priority: CRITICAL**

This fix is essential for AI recipe functionality to work as expected by users. 