-- SAFE RPC ALIGNMENT FIX
-- This aligns the backend RPC with what the frontend is already using
-- No data migration needed - just fixing the inconsistency

-- Fix get_recipe_details RPC to use user_interactions (like frontend already does)
CREATE OR REPLACE FUNCTION get_recipe_details(p_recipe_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  recipe_data JSON;
BEGIN
  -- Get recipe details with comment count included
  SELECT json_build_object(
    'recipe_id', r.id,
    'title', r.title,
    'user_id', r.user_id,
    'servings', r.servings,
    'diet_tags', r.diet_tags,
    'is_public', r.is_public,
    'video_url', r.video_url,
    'thumbnail_url', r.thumbnail_url,
    'created_at', r.created_at,
    'description', r.description,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'ingredients', r.ingredients,
    'preparation_steps', r.preparation_steps,
    'cook_time_minutes', r.cook_time_minutes,
    'prep_time_minutes', r.prep_time_minutes,
    'views_count', r.views_count,
    'likes', COALESCE(r.likes, 0),
    'comments_count', COALESCE(
      (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id), 
      0
    ),
    -- ✅ FIXED: Use user_interactions instead of recipe_likes (matches frontend)
    'is_liked_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM user_interactions 
        WHERE recipe_id = r.id 
          AND user_id = p_user_id 
          AND interaction_type = 'like'
      )
    END,
    -- ✅ FIXED: Use saved_recipe_videos instead of saved_recipes (matches what should be primary)
    'is_saved_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM saved_recipe_videos 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END
  ) INTO recipe_data
  FROM recipe_uploads r  -- ✅ FIXED: Use recipe_uploads instead of recipes (matches frontend)
  LEFT JOIN profiles p ON r.user_id = p.user_id  -- ✅ FIXED: Join on user_id field
  WHERE r.id = p_recipe_id;

  -- Return the recipe data
  RETURN recipe_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recipe_details(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_recipe_details(UUID, UUID) IS 'Get complete recipe details using user_interactions and recipe_uploads tables (aligned with frontend)';

-- Create missing RPC functions that might be needed

-- Function to toggle like status (using user_interactions)
CREATE OR REPLACE FUNCTION toggle_recipe_like(p_recipe_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  is_currently_liked BOOLEAN;
  new_like_count INTEGER;
BEGIN
  -- Check if user already liked this recipe
  SELECT EXISTS(
    SELECT 1 FROM user_interactions 
    WHERE recipe_id = p_recipe_id 
      AND user_id = p_user_id 
      AND interaction_type = 'like'
  ) INTO is_currently_liked;

  IF is_currently_liked THEN
    -- Remove like
    DELETE FROM user_interactions 
    WHERE recipe_id = p_recipe_id 
      AND user_id = p_user_id 
      AND interaction_type = 'like';
  ELSE
    -- Add like
    INSERT INTO user_interactions (user_id, recipe_id, interaction_type, created_at)
    VALUES (p_user_id, p_recipe_id, 'like', NOW())
    ON CONFLICT (user_id, recipe_id, interaction_type) DO NOTHING;
  END IF;

  -- Get updated like count
  SELECT COUNT(*) INTO new_like_count
  FROM user_interactions 
  WHERE recipe_id = p_recipe_id AND interaction_type = 'like';

  -- Return result
  RETURN json_build_object(
    'is_liked', NOT is_currently_liked,
    'likes_count', new_like_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle save status (using saved_recipe_videos)
CREATE OR REPLACE FUNCTION toggle_recipe_save(p_recipe_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  is_currently_saved BOOLEAN;
BEGIN
  -- Check if user already saved this recipe
  SELECT EXISTS(
    SELECT 1 FROM saved_recipe_videos 
    WHERE recipe_id = p_recipe_id AND user_id = p_user_id
  ) INTO is_currently_saved;

  IF is_currently_saved THEN
    -- Remove save
    DELETE FROM saved_recipe_videos 
    WHERE recipe_id = p_recipe_id AND user_id = p_user_id;
  ELSE
    -- Add save
    INSERT INTO saved_recipe_videos (user_id, recipe_id, saved_at)
    VALUES (p_user_id, p_recipe_id, NOW())
    ON CONFLICT (user_id, recipe_id) DO NOTHING;
  END IF;

  -- Return result
  RETURN json_build_object(
    'is_saved', NOT is_currently_saved
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION toggle_recipe_like(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_recipe_save(UUID, UUID) TO authenticated; 