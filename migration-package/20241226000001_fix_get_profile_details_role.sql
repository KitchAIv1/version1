-- Fix get_profile_details RPC to return NULL instead of empty string for role
-- This prevents role validation issues in the frontend

CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE NOTICE 'No profile found for user_id: %', p_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE NOTICE 'No user found in auth.users for user_id: %', p_user_id;
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'username', COALESCE(p.username, 'Anonymous'),
      'avatar_url', COALESCE(u.raw_user_meta_data->>'avatar_url', ''),
      'bio', COALESCE(p.bio, ''),
      'role', CASE 
        WHEN p.role IS NULL OR p.role = '' THEN NULL 
        ELSE p.role 
      END,
      'onboarded', COALESCE(p.onboarded, false),
      'tier', CASE 
        WHEN p.role = 'creator' THEN 'PREMIUM'
        ELSE 'FREEMIUM'
      END,
      'followers', COALESCE((
        SELECT COUNT(*) 
        FROM user_follows 
        WHERE followed_id = p_user_id
      ), 0),
      'following', COALESCE((
        SELECT COUNT(*) 
        FROM user_follows 
        WHERE follower_id = p_user_id
      ), 0),
      'recipes', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'recipe_id', r.id,
            'title', r.title,
            'video_url', r.video_url,
            'thumbnail_url', COALESCE(r.thumbnail_url, ''),
            'created_at', r.created_at
          )
        )
        FROM public.recipe_uploads r
        WHERE r.user_id = p_user_id
      ), '[]'::jsonb),
      'saved_recipes', COALESCE((
        SELECT jsonb_agg(saved_recipe)
        FROM (
          SELECT
            jsonb_build_object(
              'recipe_id', r.id,
              'title', r.title,
              'video_url', r.video_url,
              'thumbnail_url', COALESCE(r.thumbnail_url, ''),
              'created_at', r.created_at,
              'saved_at', srv.saved_at
            ) AS saved_recipe
          FROM public.saved_recipe_videos srv
          JOIN public.recipe_uploads r ON srv.recipe_id = r.id
          WHERE srv.user_id = p_user_id
          ORDER BY srv.saved_at DESC
        ) AS ordered_saved_recipes
      ), '[]'::jsonb)
    )
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE u.id = p_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_profile_details for user_id %: %', p_user_id, SQLERRM;
  RAISE EXCEPTION 'Failed to fetch profile details for user_id %: %', p_user_id, SQLERRM;
END;
$$; 