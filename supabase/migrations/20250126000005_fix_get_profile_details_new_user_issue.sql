-- Fix get_profile_details function for new user sign-up issues
-- COMPREHENSIVE FIX: Combines ALL functionality from previous migrations with proper new user handling
-- The issue is that migration 20250125000003 changed return type and structure causing white screen

-- Drop the problematic version that changed return type from jsonb to JSON
DROP FUNCTION IF EXISTS public.get_profile_details(uuid);

-- COMPLETE VERSION: Includes ALL fields and features from previous working versions
CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  profile_exists BOOLEAN;
  user_exists BOOLEAN;
  followers_count INTEGER;
  following_count INTEGER;
  profile_data JSONB;
  recipes_data JSONB;
  saved_recipes_data JSONB;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = p_user_id) INTO user_exists;
  
  -- Get follower and following counts (works even for new users)
  SELECT COUNT(*) INTO followers_count
  FROM user_follows 
  WHERE followed_id = p_user_id;
  
  SELECT COUNT(*) INTO following_count
  FROM user_follows 
  WHERE follower_id = p_user_id;

  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = p_user_id) INTO profile_exists;
  
  IF NOT user_exists THEN
    RAISE NOTICE 'No user found in auth.users for user_id: %', p_user_id;
    -- Return default structure for non-existent users
    RETURN jsonb_build_object(
      'profile', jsonb_build_object(
        'user_id', p_user_id,
        'username', null,
        'avatar_url', '',
        'bio', '',
        'role', null,
        'onboarded', false,
        'tier', 'FREEMIUM',
        'followers', followers_count,
        'following', following_count
      ),
      'recipes', '[]'::jsonb,
      'saved_recipes', '[]'::jsonb
    );
  END IF;

  IF NOT profile_exists THEN
    RAISE NOTICE 'No profile found for user_id: %, creating default response with auth data', p_user_id;
    -- Return default structure for new users without profiles 
    SELECT jsonb_build_object(
      'user_id', u.id,
      'username', null,
      'avatar_url', '',  -- FIX: Empty for new users since no profile exists yet
      'bio', '',
      'role', null,
      'onboarded', false,
      'tier', 'FREEMIUM',
      'followers', followers_count,
      'following', following_count
    ) INTO profile_data
    FROM auth.users u
    WHERE u.id = p_user_id;

    RETURN jsonb_build_object(
      'profile', profile_data,
      'recipes', '[]'::jsonb,
      'saved_recipes', '[]'::jsonb
    );
  END IF;

  -- Fetch profile data with all required fields for existing users
  SELECT jsonb_build_object(
    'user_id', u.id,
    'username', COALESCE(p.username, 'Anonymous'),
    'avatar_url', COALESCE(p.avatar_url, ''),
    'bio', COALESCE(p.bio, ''),
    'role', CASE 
      WHEN p.role IS NULL OR p.role = '' THEN NULL 
      ELSE p.role 
    END,
    'tier', COALESCE(p.tier, 
      CASE 
        WHEN p.role = 'creator' THEN 'PREMIUM'
        ELSE 'FREEMIUM'
      END
    ),
    'onboarded', COALESCE(p.onboarded, false),
    'followers', followers_count,
    'following', following_count
  ) INTO profile_data
  FROM profiles p
  LEFT JOIN auth.users u ON p.user_id = u.id
  WHERE p.user_id = p_user_id;

  -- Fetch user's uploaded recipes with all required fields
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'recipe_id', r.id,
      'title', r.title,
      'video_url', COALESCE(r.video_url, ''),
      'thumbnail_url', COALESCE(r.thumbnail_url, ''),
      'created_at', r.created_at,
      'creator_user_id', r.user_id,
      'is_ai_generated', COALESCE(r.is_ai_generated, false)
    ) ORDER BY r.created_at DESC
  ), '[]'::jsonb) INTO recipes_data
  FROM recipe_uploads r
  WHERE r.user_id = p_user_id;

  -- Fetch user's saved recipes with all required fields
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'recipe_id', r.id,
      'title', r.title,
      'video_url', COALESCE(r.video_url, ''),
      'thumbnail_url', COALESCE(r.thumbnail_url, ''),
      'created_at', r.created_at,
      'saved_at', s.saved_at,
      'creator_user_id', r.user_id,
      'is_ai_generated', COALESCE(r.is_ai_generated, false)
    ) ORDER BY s.saved_at DESC
  ), '[]'::jsonb) INTO saved_recipes_data
  FROM recipe_uploads r
  JOIN saved_recipe_videos s ON r.id = s.recipe_id
  WHERE s.user_id = p_user_id;

  -- Return the complete structured data
  RETURN jsonb_build_object(
    'profile', profile_data,
    'recipes', recipes_data,
    'saved_recipes', saved_recipes_data
  );

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_profile_details for user_id %: %', p_user_id, SQLERRM;
  -- Return safe default on any error to prevent white screen
  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'user_id', p_user_id,
      'username', null,
      'avatar_url', '',
      'bio', '',
      'role', null,
      'onboarded', false,
      'tier', 'FREEMIUM',
      'followers', 0,
      'following', 0
    ),
    'recipes', '[]'::jsonb,
    'saved_recipes', '[]'::jsonb
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_profile_details(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_profile_details(UUID) FROM anon, PUBLIC;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_profile_details(UUID) IS 'COMPLETE VERSION: Retrieve profile details with proper new user handling, includes ALL fields from previous migrations - prevents white screen issue'; 