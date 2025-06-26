-- Complete get_profile_details fix with cleaner structure and all required fields
-- This replaces the previous function with a better structured version that includes all frontend requirements

-- Drop existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS public.get_profile_details(uuid);

CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  profile_data JSON;
  recipes_data JSON;
  saved_recipes_data JSON;
  followers_count INTEGER;
  following_count INTEGER;
BEGIN
  -- Get follower and following counts
  SELECT COUNT(*) INTO followers_count
  FROM user_follows 
  WHERE followed_id = p_user_id;
  
  SELECT COUNT(*) INTO following_count
  FROM user_follows 
  WHERE follower_id = p_user_id;

  -- Fetch profile data with all required fields
  SELECT json_build_object(
    'user_id', p.user_id,
    'username', COALESCE(p.username, 'Anonymous'),
    'avatar_url', COALESCE(u.raw_user_meta_data ->> 'avatar_url', ''),
    'bio', COALESCE(p.bio, ''),
    'role', CASE 
      WHEN p.role IS NULL OR p.role = '' THEN NULL 
      ELSE p.role 
    END,
    'tier', CASE 
      WHEN p.role = 'creator' THEN 'PREMIUM'
      ELSE 'FREEMIUM'
    END,
    'onboarded', COALESCE(p.onboarded, false),
    'followers', followers_count,
    'following', following_count
  ) INTO profile_data
  FROM profiles p
  LEFT JOIN auth.users u ON p.user_id = u.id
  WHERE p.user_id = p_user_id;

  -- Fetch user's uploaded recipes with all required fields
  SELECT json_agg(
    json_build_object(
      'recipe_id', r.id,
      'title', r.title,
      'video_url', COALESCE(r.video_url, ''),
      'thumbnail_url', COALESCE(r.thumbnail_url, ''),
      'created_at', r.created_at,
      'creator_user_id', r.user_id,
      'is_ai_generated', COALESCE(r.is_ai_generated, false)
    )
  ) INTO recipes_data
  FROM recipe_uploads r
  WHERE r.user_id = p_user_id;

  -- Fetch user's saved recipes with all required fields
  SELECT json_agg(
    json_build_object(
      'recipe_id', r.id,
      'title', r.title,
      'video_url', COALESCE(r.video_url, ''),
      'thumbnail_url', COALESCE(r.thumbnail_url, ''),
      'created_at', r.created_at,
      'saved_at', s.saved_at,
      'creator_user_id', r.user_id,
      'is_ai_generated', COALESCE(r.is_ai_generated, false)
    )
  ) INTO saved_recipes_data
  FROM recipe_uploads r
  JOIN saved_recipe_videos s ON r.id = s.recipe_id
  WHERE s.user_id = p_user_id
  ORDER BY s.saved_at DESC;

  -- Return the new cleaner structure
  RETURN json_build_object(
    'profile', profile_data,
    'recipes', COALESCE(recipes_data, '[]'::json),
    'saved_recipes', COALESCE(saved_recipes_data, '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_profile_details(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_details(UUID) FROM anon, PUBLIC;

-- Add documentation
COMMENT ON FUNCTION public.get_profile_details(UUID) IS 'Retrieve complete profile details with cleaner structure, including uploaded and saved recipes with is_ai_generated field, follower counts, and all required frontend fields'; 