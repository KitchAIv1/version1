-- Fix generate_recipe_suggestions RPC Function
-- This fixes the permission denied error and ensures proper implementation

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

  -- Get user tier from profiles table
  SELECT COALESCE(p.tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles p
  WHERE p.id = p_user_id;
  
  -- If no profile found, default to FREEMIUM
  IF v_user_tier IS NULL THEN
    v_user_tier := 'FREEMIUM';
  END IF;

  -- Find matching recipes from recipe_uploads table
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

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION generate_recipe_suggestions(UUID, TEXT[], INTEGER) TO authenticated;

-- Grant permissions to anon users (for testing)
GRANT EXECUTE ON FUNCTION generate_recipe_suggestions(UUID, TEXT[], INTEGER) TO anon;

-- Grant permissions to service_role
GRANT EXECUTE ON FUNCTION generate_recipe_suggestions(UUID, TEXT[], INTEGER) TO service_role; 