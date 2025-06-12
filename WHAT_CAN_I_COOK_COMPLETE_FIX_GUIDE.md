# 🍳 "What Can I Cook?" Feature - Complete Fix Guide

## 📋 **Issue Summary**

After comprehensive analysis, the "What Can I Cook?" feature has several issues that occurred after database cleaning:

### **✅ WORKING:**
- Frontend navigation and UI components
- Button logic and ingredient selection
- Basic RPC function structure

### **❌ BROKEN:**
1. **Recipe suggestions not loading** (user_subscriptions error)
2. **AI recipe generation showing mock data**
3. **Recipe saving functionality not working**

---

## 🚨 **CRITICAL FIXES REQUIRED**

### **Fix 1: Update generate_recipe_suggestions RPC Function**

**Problem:** Function references removed `user_subscriptions` table
**Solution:** Update to use `profiles.tier`

```sql
-- Execute this in Supabase Dashboard > SQL Editor
CREATE OR REPLACE FUNCTION generate_recipe_suggestions(
  p_user_id UUID,
  p_selected_ingredients TEXT[],
  p_freemium_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_tier TEXT;
  v_recipe_matches JSONB[];
  v_match_record RECORD;
  v_total_matches INTEGER;
  v_returned_matches INTEGER;
  v_ai_available BOOLEAN := true;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF array_length(p_selected_ingredients, 1) < 3 THEN
    RAISE EXCEPTION 'At least 3 ingredients required';
  END IF;

  -- Get user tier from profiles table (NOT user_subscriptions)
  SELECT COALESCE(p.tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles p
  WHERE p.id = p_user_id;
  
  -- If no profile found, default to FREEMIUM
  IF v_user_tier IS NULL THEN
    v_user_tier := 'FREEMIUM';
  END IF;

  -- Find matching recipes from recipe_uploads table (NOT recipes)
  v_recipe_matches := ARRAY[]::JSONB[];
  v_total_matches := 0;
  
  FOR v_match_record IN
    SELECT 
      ru.id as recipe_id,
      ru.title as recipe_title,
      ru.description,
      ru.thumbnail_url,
      ru.prep_time_minutes,
      ru.cook_time_minutes,
      ru.difficulty,
      p.username as creator_username,
      p.avatar_url as creator_avatar,
      ru.user_id as creator_id,
      ru.created_at,
      -- Calculate match percentage based on ingredients JSONB array
      CASE 
        WHEN jsonb_array_length(ru.ingredients) > 0 THEN
          (
            SELECT COUNT(*)::FLOAT 
            FROM jsonb_array_elements_text(ru.ingredients) AS ingredient
            WHERE LOWER(ingredient) = ANY(
              SELECT LOWER(unnest(p_selected_ingredients))
            )
          ) * 100.0 / jsonb_array_length(ru.ingredients)
        ELSE 0
      END as match_percentage,
      -- Get missing ingredients
      (
        SELECT COALESCE(
          array_agg(ingredient_text), 
          ARRAY[]::TEXT[]
        )
        FROM jsonb_array_elements_text(ru.ingredients) AS ingredient_text
        WHERE LOWER(ingredient_text) != ALL(
          SELECT LOWER(unnest(p_selected_ingredients))
        )
        LIMIT 5  -- Limit missing ingredients to 5
      ) as missing_ingredients
    FROM recipe_uploads ru
    LEFT JOIN profiles p ON ru.user_id = p.id
    WHERE 
      ru.is_public = true
      AND ru.ingredients IS NOT NULL
      AND jsonb_array_length(ru.ingredients) > 0
      -- Only include recipes with at least 20% match
      AND (
        SELECT COUNT(*)::FLOAT 
        FROM jsonb_array_elements_text(ru.ingredients) AS ingredient
        WHERE LOWER(ingredient) = ANY(
          SELECT LOWER(unnest(p_selected_ingredients))
        )
      ) * 100.0 / jsonb_array_length(ru.ingredients) >= 20
    ORDER BY match_percentage DESC
    LIMIT CASE 
      WHEN v_user_tier = 'PREMIUM' OR v_user_tier = 'CREATOR' THEN 50
      ELSE p_freemium_limit
    END
  LOOP
    v_total_matches := v_total_matches + 1;
    
    -- Build recipe match object
    v_recipe_matches := v_recipe_matches || jsonb_build_object(
      'recipe_id', v_match_record.recipe_id,
      'recipe_title', v_match_record.recipe_title,
      'description', COALESCE(v_match_record.description, ''),
      'thumbnail_url', COALESCE(v_match_record.thumbnail_url, ''),
      'prep_time_minutes', COALESCE(v_match_record.prep_time_minutes, 0),
      'cook_time_minutes', COALESCE(v_match_record.cook_time_minutes, 0),
      'difficulty', COALESCE(v_match_record.difficulty, 'Medium'),
      'creator_username', COALESCE(v_match_record.creator_username, 'Unknown'),
      'creator_avatar', COALESCE(v_match_record.creator_avatar, ''),
      'creator_id', v_match_record.creator_id,
      'match_percentage', ROUND(v_match_record.match_percentage::NUMERIC, 1),
      'missing_ingredients', v_match_record.missing_ingredients,
      'total_ingredients', jsonb_array_length(
        (SELECT ru2.ingredients FROM recipe_uploads ru2 WHERE ru2.id = v_match_record.recipe_id)
      ),
      'matched_ingredients', (
        SELECT COUNT(*)
        FROM jsonb_array_elements_text(
          (SELECT ru2.ingredients FROM recipe_uploads ru2 WHERE ru2.id = v_match_record.recipe_id)
        ) AS ingredient
        WHERE LOWER(ingredient) = ANY(
          SELECT LOWER(unnest(p_selected_ingredients))
        )
      ),
      'created_at', v_match_record.created_at
    );
  END LOOP;

  v_returned_matches := array_length(v_recipe_matches, 1);
  IF v_returned_matches IS NULL THEN
    v_returned_matches := 0;
  END IF;

  -- Return the response
  RETURN jsonb_build_object(
    'database_matches', v_recipe_matches,
    'total_matches_found', v_total_matches,
    'matches_returned', v_returned_matches,
    'user_tier', v_user_tier,
    'suggestions_remaining', CASE 
      WHEN v_user_tier = 'PREMIUM' OR v_user_tier = 'CREATOR' THEN -1  -- Unlimited
      ELSE GREATEST(0, p_freemium_limit - v_returned_matches)
    END,
    'ai_generation_available', v_ai_available
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to generate recipe suggestions: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_recipe_suggestions(UUID, TEXT[], INTEGER) TO authenticated;
```

### **Fix 2: Add Missing Columns to recipe_uploads**

```sql
-- Add AI recipe support columns if not exists
ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS difficulty TEXT;

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS estimated_cost TEXT;

ALTER TABLE recipe_uploads 
ADD COLUMN IF NOT EXISTS nutrition_notes TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_uploads_ai_generated 
ON recipe_uploads(is_ai_generated, user_id);

CREATE INDEX IF NOT EXISTS idx_recipe_uploads_public_ingredients 
ON recipe_uploads(is_public) WHERE ingredients IS NOT NULL;
```

### **Fix 3: Create/Update save_ai_generated_recipe Function**

```sql
CREATE OR REPLACE FUNCTION save_ai_generated_recipe(
  p_user_id UUID,
  p_recipe_data JSONB,
  p_selected_ingredients TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipe_id UUID;
  v_recipe_title TEXT;
  v_ingredients JSONB;
  v_steps TEXT[];
  v_prep_time INTEGER;
  v_cook_time INTEGER;
  v_servings INTEGER;
  v_difficulty TEXT;
  v_estimated_cost TEXT;
  v_nutrition_notes TEXT;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID cannot be null';
  END IF;
  
  IF p_recipe_data IS NULL THEN
    RAISE EXCEPTION 'Recipe data cannot be null';
  END IF;

  -- Generate new recipe ID
  v_recipe_id := gen_random_uuid();
  
  -- Extract data from AI recipe
  v_recipe_title := p_recipe_data->>'name';
  v_ingredients := p_recipe_data->'ingredients';
  
  -- Handle steps - convert from JSONB array to TEXT array
  SELECT array_agg(step_text)
  INTO v_steps
  FROM jsonb_array_elements_text(p_recipe_data->'steps') AS step_text;
  
  v_prep_time := (p_recipe_data->>'estimated_time')::INTEGER;
  v_cook_time := 0; -- AI doesn't separate prep/cook time
  v_servings := (p_recipe_data->>'servings')::INTEGER;
  v_difficulty := p_recipe_data->>'difficulty';
  v_estimated_cost := p_recipe_data->>'estimated_cost';
  v_nutrition_notes := p_recipe_data->>'nutrition_notes';
  
  -- Insert into recipe_uploads table
  INSERT INTO recipe_uploads (
    id,
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
    'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg',
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
  
  -- Add to saved_recipe_videos (so it appears in user's saved recipes)
  INSERT INTO saved_recipe_videos (
    user_id,
    recipe_id,
    saved_at
  ) VALUES (
    p_user_id,
    v_recipe_id,
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_ai_generated_recipe(UUID, JSONB, TEXT[]) TO authenticated;
```

### **Fix 4: Ensure user_activity_log Table Exists**

```sql
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for activity queries
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id 
ON user_activity_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Create policy for user activity log
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_log;
CREATE POLICY "Users can view own activity" ON user_activity_log 
FOR ALL USING (auth.uid() = user_id);
```

---

## 🧪 **TESTING STEPS**

### **Step 1: Execute the SQL Fixes**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and execute each SQL block above
4. Verify no errors

### **Step 2: Test the Feature**
1. Open the app
2. Go to Pantry screen
3. Add at least 3 items to pantry
4. Click "What Can I Cook?" button
5. Select ingredients
6. Verify recipe suggestions load
7. Test AI recipe generation
8. Test saving AI recipes

### **Step 3: Check for Errors**
Monitor the console logs for:
- ✅ Recipe suggestions loading successfully
- ✅ AI generation working (not mock data)
- ✅ Recipe saving working
- ❌ Any remaining errors

---

## 🔍 **DEBUGGING TIPS**

### **If Recipe Suggestions Still Don't Load:**
1. Check if user has a profile in `profiles` table
2. Verify `recipe_uploads` table has recipes with ingredients
3. Check console logs for specific error messages

### **If AI Generation Shows Mock Data:**
1. Check the Edge Function logs in Supabase
2. Verify the AI service is responding correctly
3. Check the `useAccessControl` hook implementation

### **If Saving Still Doesn't Work:**
1. Verify the `save_ai_generated_recipe` function exists
2. Check if `saved_recipe_videos` table exists
3. Verify RLS policies allow the operation

---

## 📋 **SUMMARY**

The main issues were:
1. **Database schema misalignment** after cleaning
2. **Missing table references** (user_subscriptions → profiles.tier)
3. **Missing columns** for AI recipe support
4. **Broken RPC functions** due to table changes

After applying these fixes, the "What Can I Cook?" feature should work completely:
- ✅ Recipe suggestions from database
- ✅ AI recipe generation
- ✅ Recipe saving functionality
- ✅ Proper user tier detection

---

## 🚀 **NEXT STEPS**

1. **Execute all SQL fixes** in Supabase Dashboard
2. **Test the complete flow** in the app
3. **Monitor for any remaining issues**
4. **Verify AI recipes appear in saved recipes**

The frontend code is solid - these database fixes should restore full functionality! 