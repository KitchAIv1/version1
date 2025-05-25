-- Fix get_recipe_details RPC to include comment counts
-- This eliminates the 1-2 second delay when loading recipe details

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
    'is_liked_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM recipe_likes 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END,
    'is_saved_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM saved_recipes 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END
  ) INTO recipe_data
  FROM recipes r
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_recipe_id;

  -- Return the recipe data
  RETURN recipe_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recipe_details(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_recipe_details(UUID, UUID) IS 'Get complete recipe details including real-time comment count, like status, and save status for a user'; 