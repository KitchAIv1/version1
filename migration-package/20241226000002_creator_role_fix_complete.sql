-- Creator Role Fix - Complete Backend Compromise Solution
-- Fixes user_id: null issue and implements proper role handling

-- Step 1: Fix existing profile data (set user_id = id for all profiles where user_id is null)
UPDATE profiles 
SET user_id = id 
WHERE user_id IS NULL;

-- Step 2: OVERRIDE BROKEN get_profile_details function - fix schema and column issues
-- This completely replaces any previous broken version that references non-existent columns
DROP FUNCTION IF EXISTS public.get_profile_details(uuid);
CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = p_user_id) THEN
    RAISE NOTICE 'No profile found for user_id: %', p_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE NOTICE 'No user found in auth.users for user_id: %', p_user_id;
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'username', COALESCE(p.username, 'Anonymous'),
      'avatar_url', COALESCE(u.raw_user_meta_data ->> 'avatar_url', ''),
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
    LEFT JOIN public.profiles p ON u.id = p.user_id
    WHERE u.id = p_user_id
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in get_profile_details for user_id %: %', p_user_id, SQLERRM;
  RAISE EXCEPTION 'Failed to fetch profile details for user_id %: %', p_user_id, SQLERRM;
END;
$$;

-- Step 3: Drop existing update_profile function variations
DROP FUNCTION IF EXISTS public.update_profile(uuid, text, text, text, text, boolean, text[]);
DROP FUNCTION IF EXISTS public.update_profile(uuid, text, text, text, text, boolean, text[], boolean);

-- Step 4: Create new update_profile function (compromise version - no p_is_creator)
CREATE OR REPLACE FUNCTION public.update_profile(
  p_user_id UUID,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_onboarded BOOLEAN DEFAULT NULL,
  p_diet_tags TEXT[] DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Security: Verify user exists and has permission
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Permission denied: Can only update your own profile';
  END IF;

  -- Validate role (only allow 'user' or 'creator', convert empty string to NULL)
  IF p_role IS NOT NULL AND p_role != '' AND p_role NOT IN ('user', 'creator') THEN
    RAISE EXCEPTION 'Invalid role: %; must be "user" or "creator"', p_role;
  END IF;

  -- Normalize role (convert empty string to NULL)
  p_role := CASE WHEN p_role = '' THEN NULL ELSE p_role END;

  -- Update auth.users.raw_user_meta_data for avatar_url
  IF p_avatar_url IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', p_avatar_url)
    WHERE id = p_user_id;
  END IF;

  -- Update profiles table using user_id
  UPDATE profiles 
  SET 
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    bio = COALESCE(p_bio, bio),
    username = COALESCE(p_username, username),
    role = COALESCE(p_role, role),
    onboarded = COALESCE(p_onboarded, onboarded),
    diet_tags = COALESCE(p_diet_tags, diet_tags),
    tier = CASE 
      WHEN p_role = 'creator' THEN 'PREMIUM'
      WHEN p_role = 'user' THEN 'FREEMIUM'
      ELSE COALESCE(tier, 'FREEMIUM')
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no profile exists, create one
  IF NOT FOUND THEN
    INSERT INTO profiles (id, user_id, username, created_at, updated_at, avatar_url, bio, role, onboarded, diet_tags, tier)
    VALUES (
      gen_random_uuid(),
      p_user_id,
      COALESCE(p_username, 'Anonymous'),
      NOW(),
      NOW(),
      COALESCE(p_avatar_url, ''),
      COALESCE(p_bio, ''),
      p_role,
      COALESCE(p_onboarded, false),
      COALESCE(p_diet_tags, '{}'),
      CASE WHEN p_role = 'creator' THEN 'PREMIUM' ELSE 'FREEMIUM' END
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Grant proper permissions
GRANT EXECUTE ON FUNCTION public.update_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_details(UUID) TO authenticated;

-- Step 6: Verify RLS policies are using user_id (if not, they need to be updated)
-- This is a check - actual RLS updates would need to be done if policies use 'id' instead of 'user_id'

-- Step 7: Fix the specific user mentioned in the backend response
UPDATE profiles 
SET user_id = '4b02a214-8c64-4dea-963e-21ff0b6f77fb'
WHERE id = '4b02a214-8c64-4dea-963e-21ff0b6f77fb' AND user_id IS NULL;

-- Comment: Migration complete
-- This implements the backend's compromise solution:
-- 1. Uses user_id as the join column (not id)
-- 2. Removes p_is_creator parameter to avoid frontend changes
-- 3. Fixes user_id: null data issue
-- 4. Properly handles role validation and empty string conversion
-- 5. Auto-assigns tier based on role (creator = PREMIUM, user = FREEMIUM)
-- 6. Maintains existing frontend parameter compatibility 