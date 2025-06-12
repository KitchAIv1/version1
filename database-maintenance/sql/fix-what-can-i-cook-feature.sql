-- ============================================================
-- FIX: "What Can I Cook?" Feature - Database Issues
-- ============================================================
-- This script fixes the issues identified after database cleaning:
-- 1. generate_recipe_suggestions RPC using wrong table references
-- 2. Missing user_subscriptions table (should use profiles.tier)
-- 3. Recipe matching using wrong table (should use recipe_uploads)

-- ============================================================
-- STEP 1: Fix generate_recipe_suggestions RPC Function
-- ============================================================

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

  -- Log the suggestion generation for analytics
  INSERT INTO user_activity_log (
    user_id,
    activity_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'recipe_suggestions_generated',
    jsonb_build_object(
      'selected_ingredients', to_jsonb(p_selected_ingredients),
      'total_matches_found', v_total_matches,
      'matches_returned', v_returned_matches,
      'user_tier', v_user_tier
    ),
    NOW()
  );

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
    -- Log the error
    INSERT INTO user_activity_log (
      user_id,
      activity_type,
      metadata,
      created_at
    ) VALUES (
      p_user_id,
      'recipe_suggestions_error',
      jsonb_build_object(
        'error_message', SQLERRM,
        'selected_ingredients', to_jsonb(p_selected_ingredients),
        'user_tier', COALESCE(v_user_tier, 'UNKNOWN')
      ),
      NOW()
    );
    
    RAISE EXCEPTION 'Failed to generate recipe suggestions: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_recipe_suggestions(UUID, TEXT[], INTEGER) TO authenticated;

-- ============================================================
-- STEP 2: Fix save_ai_generated_recipe RPC Function
-- ============================================================

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
  
  -- Log the save activity
  INSERT INTO user_activity_log (
    user_id,
    activity_type,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    'generated_recipe',
    jsonb_build_object(
      'recipe_id', v_recipe_id,
      'recipe_title', v_recipe_title,
      'is_ai_generated', true,
      'selected_ingredients', COALESCE(to_jsonb(p_selected_ingredients), '[]'::jsonb)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION save_ai_generated_recipe(UUID, JSONB, TEXT[]) TO authenticated;

-- ============================================================
-- STEP 3: Ensure Required Columns Exist
-- ============================================================

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

-- ============================================================
-- STEP 4: Ensure user_activity_log Table Exists
-- ============================================================

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

-- ============================================================
-- STEP 5: Test the Functions
-- ============================================================

-- Test generate_recipe_suggestions with sample data
-- This should now work without the user_subscriptions error
-- SELECT generate_recipe_suggestions(
--   'your-user-id'::UUID,
--   ARRAY['chicken', 'rice', 'tomato'],
--   10
-- );

-- ============================================================
-- COMPLETION MESSAGE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ "What Can I Cook?" feature database fixes completed successfully!';
  RAISE NOTICE '📋 Fixed issues:';
  RAISE NOTICE '   1. generate_recipe_suggestions now uses profiles.tier instead of user_subscriptions';
  RAISE NOTICE '   2. Recipe matching now uses recipe_uploads table instead of recipes';
  RAISE NOTICE '   3. save_ai_generated_recipe properly saves to recipe_uploads and saved_recipe_videos';
  RAISE NOTICE '   4. Added missing columns and indexes for AI recipe support';
  RAISE NOTICE '   5. Created user_activity_log table if missing';
  RAISE NOTICE '🚀 The "What Can I Cook?" feature should now work correctly!';
END $$; 