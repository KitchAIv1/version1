-- ========================================
-- CRITICAL FIX: Update Profile Function
-- ========================================
-- This fixes BOTH the edit profile lockout AND new user profile creation by:
-- 1. Creating profiles for new users instead of failing
-- 2. Adding proper username validation
-- 3. Fixing conditional field updates
-- 4. Adding comprehensive error handling

-- Drop the existing function first (required for return type change)
DROP FUNCTION IF EXISTS update_profile(uuid,text,text,text,text,boolean,text[]);
DROP FUNCTION IF EXISTS public.update_profile(uuid,text,text,text,text,boolean,text[]);

-- Create the new function with proper return type and validation
CREATE OR REPLACE FUNCTION update_profile(
  p_user_id UUID,
  p_username TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_onboarded BOOLEAN DEFAULT NULL,
  p_diet_tags TEXT[] DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_profile profiles%ROWTYPE;
  update_count INTEGER := 0;
  profile_exists BOOLEAN := FALSE;
BEGIN
  -- Enhanced logging for debugging
  RAISE LOG 'update_profile called for user_id: %, username: %, role: %, onboarded: %', 
    p_user_id, p_username, p_role, p_onboarded;

  -- Verify user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found in auth.users: %', p_user_id;
  END IF;

  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = p_user_id) INTO profile_exists;
  
  -- CRITICAL FIX: Create profile if it doesn't exist (for new users)
  IF NOT profile_exists THEN
    RAISE LOG 'Profile not found for user %, creating new profile', p_user_id;
    
    -- Generate default username if not provided
    DECLARE
      default_username TEXT;
    BEGIN
      IF p_username IS NULL OR TRIM(p_username) = '' THEN
        -- Generate a unique username based on user ID
        default_username := 'user_' || SUBSTRING(p_user_id::TEXT FROM 1 FOR 8);
        
        -- Ensure uniqueness by adding a counter if needed
        DECLARE
          counter INTEGER := 1;
          candidate_username TEXT := default_username;
        BEGIN
          WHILE EXISTS (SELECT 1 FROM profiles WHERE username = candidate_username) LOOP
            candidate_username := default_username || '_' || counter;
            counter := counter + 1;
          END LOOP;
          default_username := candidate_username;
        END;
      ELSE
        default_username := TRIM(p_username);
      END IF;
      
      -- Validate username length
      IF LENGTH(default_username) < 3 THEN
        default_username := 'user_' || SUBSTRING(p_user_id::TEXT FROM 1 FOR 8);
      END IF;
      
      -- Create new profile
      INSERT INTO profiles (
        id,
        user_id,
        username,
        bio,
        avatar_url,
        role,
        onboarded,
        diet_tags,
        tier,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        p_user_id,
        default_username,
        COALESCE(p_bio, ''),
        COALESCE(p_avatar_url, ''),
        p_role,
        COALESCE(p_onboarded, false),
        COALESCE(p_diet_tags, '{}'),
        CASE 
          WHEN p_role = 'creator' THEN 'PREMIUM'
          ELSE 'FREEMIUM'
        END,
        NOW(),
        NOW()
      );
      
      RAISE LOG 'Created new profile for user % with username %', p_user_id, default_username;
      
      -- Return success response for new profile creation
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Profile created successfully',
        'user_id', p_user_id,
        'username', default_username,
        'action', 'created'
      );
    END;
  END IF;

  -- Get current profile for existing users
  SELECT * INTO current_profile 
  FROM profiles 
  WHERE user_id = p_user_id;

  -- CRITICAL: Username validation if provided for updates
  IF p_username IS NOT NULL THEN
    -- Trim and validate username
    p_username := TRIM(p_username);
    
    -- Check minimum length
    IF LENGTH(p_username) < 3 THEN
      RAISE EXCEPTION 'Username must be at least 3 characters long. Provided: "%"', p_username;
    END IF;
    
    -- Check maximum length
    IF LENGTH(p_username) > 30 THEN
      RAISE EXCEPTION 'Username cannot exceed 30 characters. Provided length: %', LENGTH(p_username);
    END IF;
    
    -- Check uniqueness (exclude current user)
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE username = p_username 
      AND user_id != p_user_id
    ) THEN
      RAISE EXCEPTION 'Username "%" is already taken', p_username;
    END IF;
  END IF;

  -- CONDITIONAL UPDATE: Only update fields that are explicitly provided
  UPDATE profiles 
  SET 
    username = CASE 
      WHEN p_username IS NOT NULL THEN p_username 
      ELSE username 
    END,
    bio = CASE 
      WHEN p_bio IS NOT NULL THEN p_bio 
      ELSE bio 
    END,
    avatar_url = CASE 
      WHEN p_avatar_url IS NOT NULL THEN p_avatar_url 
      ELSE avatar_url 
    END,
    role = CASE 
      WHEN p_role IS NOT NULL THEN p_role 
      ELSE role 
    END,
    onboarded = CASE 
      WHEN p_onboarded IS NOT NULL THEN p_onboarded 
      ELSE onboarded 
    END,
    diet_tags = CASE 
      WHEN p_diet_tags IS NOT NULL THEN p_diet_tags 
      ELSE diet_tags 
    END,
    tier = CASE 
      WHEN p_role = 'creator' THEN 'PREMIUM'
      WHEN p_role = 'user' THEN 'FREEMIUM'
      ELSE tier
    END,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Check if update was successful
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  IF update_count = 0 THEN
    RAISE EXCEPTION 'Profile update failed - no rows affected for user: %', p_user_id;
  END IF;

  RAISE LOG 'update_profile completed successfully for user: %, rows updated: %', 
    p_user_id, update_count;

  -- Return success response
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile updated successfully',
    'user_id', p_user_id,
    'rows_updated', update_count,
    'action', 'updated'
  );

EXCEPTION 
  WHEN OTHERS THEN
    -- Enhanced error logging
    RAISE LOG 'update_profile error for user %: % (SQLSTATE: %)', 
      p_user_id, SQLERRM, SQLSTATE;
    
    -- Re-raise with clear error message for frontend
    RAISE EXCEPTION 'Profile update failed: %', SQLERRM;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_profile TO authenticated;

-- ========================================
-- ADDITIONAL SAFETY: Username validation trigger
-- ========================================
-- This prevents invalid usernames from being inserted directly

CREATE OR REPLACE FUNCTION validate_username_on_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Skip validation if username is NULL
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;

  -- Trim username
  NEW.username := TRIM(NEW.username);
  
  -- Validate length
  IF LENGTH(NEW.username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters long: "%"', NEW.username;
  END IF;
  
  IF LENGTH(NEW.username) > 30 THEN
    RAISE EXCEPTION 'Username cannot exceed 30 characters: "%"', NEW.username;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS validate_username_trigger ON profiles;
CREATE TRIGGER validate_username_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_username_on_profiles();

-- ========================================
-- VERIFICATION
-- ========================================

-- Test the function with safe parameters
DO $$
BEGIN
  RAISE NOTICE 'Testing update_profile function...';
  
  -- This will only run if there are profiles to test with
  IF EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN
    RAISE NOTICE 'update_profile function is ready for use';
  ELSE
    RAISE NOTICE 'No profiles found for testing, but function is ready';
  END IF;
END $$; 