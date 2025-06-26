-- Fix tier assignment for creators to ensure they get PREMIUM tier
-- The issue is that the tier logic needs to check the profile's role, not just the update parameters

DROP FUNCTION IF EXISTS public.update_profile(uuid, text, text, text, text, boolean, text[]);

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
DECLARE
  v_current_role TEXT;
  v_final_role TEXT;
  v_final_tier TEXT;
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

  -- Get current role from database
  SELECT role INTO v_current_role 
  FROM profiles 
  WHERE user_id = p_user_id;

  -- Determine final role (use new role if provided, otherwise keep current)
  v_final_role := COALESCE(p_role, v_current_role);

  -- Determine final tier based on final role
  v_final_tier := CASE 
    WHEN v_final_role = 'creator' THEN 'PREMIUM'
    WHEN v_final_role = 'user' THEN 'FREEMIUM'
    ELSE 'FREEMIUM'  -- Default to FREEMIUM if no role
  END;

  -- Update auth.users.raw_user_meta_data for avatar_url
  IF p_avatar_url IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', p_avatar_url)
    WHERE id = p_user_id;
  END IF;

  -- Build dynamic UPDATE statement to avoid touching username when it's NULL
  UPDATE profiles 
  SET 
    avatar_url = CASE WHEN p_avatar_url IS NOT NULL THEN p_avatar_url ELSE avatar_url END,
    bio = CASE WHEN p_bio IS NOT NULL THEN p_bio ELSE bio END,
    username = CASE WHEN p_username IS NOT NULL THEN p_username ELSE username END,
    role = CASE WHEN p_role IS NOT NULL THEN p_role ELSE role END,
    onboarded = CASE WHEN p_onboarded IS NOT NULL THEN p_onboarded ELSE onboarded END,
    diet_tags = CASE WHEN p_diet_tags IS NOT NULL THEN p_diet_tags ELSE diet_tags END,
    tier = v_final_tier,  -- Always set tier based on final role
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- If no profile exists, create one with a truly unique username
  IF NOT FOUND THEN
    DECLARE
      unique_username TEXT;
      counter INTEGER := 1;
      base_username TEXT;
    BEGIN
      -- Generate a unique username
      base_username := COALESCE(p_username, 'user_' || SUBSTRING(p_user_id::text FROM 1 FOR 8));
      unique_username := base_username;
      
      -- Keep trying until we find a unique username
      WHILE EXISTS (SELECT 1 FROM profiles WHERE username = unique_username) LOOP
        unique_username := base_username || '_' || counter;
        counter := counter + 1;
        -- Safety valve - don't loop forever
        IF counter > 1000 THEN
          unique_username := 'user_' || EXTRACT(EPOCH FROM NOW())::bigint;
          EXIT;
        END IF;
      END LOOP;

      INSERT INTO profiles (id, user_id, username, created_at, updated_at, avatar_url, bio, role, onboarded, diet_tags, tier)
      VALUES (
        gen_random_uuid(),
        p_user_id,
        unique_username,
        NOW(),
        NOW(),
        COALESCE(p_avatar_url, ''),
        COALESCE(p_bio, ''),
        p_role,
        COALESCE(p_onboarded, false),
        COALESCE(p_diet_tags, '{}'),
        v_final_tier  -- Use the calculated tier
      );
    END;
  END IF;

  -- Log the tier assignment for debugging
  RAISE NOTICE 'update_profile: user_id=%, final_role=%, final_tier=%', p_user_id, v_final_role, v_final_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_profile(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT[]) TO authenticated;

-- Also fix any existing creator profiles that might have wrong tier
UPDATE profiles 
SET tier = 'PREMIUM' 
WHERE role = 'creator' AND tier != 'PREMIUM'; 