-- =====================================================
-- KITCHAI V2 - USAGE TRACKING RPC FUNCTIONS
-- Fix the missing usage tracking for FREEMIUM users
-- =====================================================

-- 1. Create or update user_usage_limits table
CREATE TABLE IF NOT EXISTS user_usage_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  scan_count INTEGER DEFAULT 0,
  ai_recipe_count INTEGER DEFAULT 0,
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for user_usage_limits
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage limits" ON user_usage_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage limits" ON user_usage_limits
  FOR ALL USING (auth.uid() = user_id);

-- 2. RPC Function: Log AI Recipe Generation
CREATE OR REPLACE FUNCTION log_ai_recipe_generation(
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  v_user_tier TEXT;
BEGIN
  -- Get user tier from profiles
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles
  WHERE user_id = p_user_id;

  -- Only track usage for FREEMIUM users
  IF v_user_tier = 'FREEMIUM' THEN
    -- Insert or update usage limits record
    INSERT INTO user_usage_limits (user_id, ai_recipe_count, scan_count, last_reset)
    VALUES (p_user_id, 1, 0, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      ai_recipe_count = user_usage_limits.ai_recipe_count + 1,
      updated_at = NOW();
      
    -- Log the action for debugging
    RAISE LOG 'AI recipe generation logged for FREEMIUM user %: count now %', 
      p_user_id, 
      (SELECT ai_recipe_count FROM user_usage_limits WHERE user_id = p_user_id);
  ELSE
    -- Log for non-FREEMIUM users (but don't track)
    RAISE LOG 'AI recipe generation for % user % (not tracked)', v_user_tier, p_user_id;
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC Function: Log Pantry Scan
CREATE OR REPLACE FUNCTION log_pantry_scan(
  p_user_id UUID,
  p_items_scanned JSONB DEFAULT '[]'::jsonb,
  p_scan_status TEXT DEFAULT 'success'
)
RETURNS void AS $$
DECLARE
  v_user_tier TEXT;
BEGIN
  -- Get user tier from profiles
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles
  WHERE user_id = p_user_id;

  -- Only track usage for FREEMIUM users
  IF v_user_tier = 'FREEMIUM' THEN
    -- Insert or update usage limits record
    INSERT INTO user_usage_limits (user_id, ai_recipe_count, scan_count, last_reset)
    VALUES (p_user_id, 0, 1, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      scan_count = user_usage_limits.scan_count + 1,
      updated_at = NOW();
      
    -- Log the action for debugging
    RAISE LOG 'Pantry scan logged for FREEMIUM user %: count now %', 
      p_user_id, 
      (SELECT scan_count FROM user_usage_limits WHERE user_id = p_user_id);
  ELSE
    -- Log for non-FREEMIUM users (but don't track)
    RAISE LOG 'Pantry scan for % user % (not tracked)', v_user_tier, p_user_id;
  END IF;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC Function: Get Current Usage Status
CREATE OR REPLACE FUNCTION get_user_usage_status(
  p_user_id UUID
)
RETURNS jsonb AS $$
DECLARE
  v_user_tier TEXT;
  v_usage_record RECORD;
  v_should_reset BOOLEAN := FALSE;
BEGIN
  -- Get user tier from profiles
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles
  WHERE user_id = p_user_id;

  -- For non-FREEMIUM users, return unlimited status
  IF v_user_tier != 'FREEMIUM' THEN
    RETURN jsonb_build_object(
      'tier', v_user_tier,
      'unlimited_access', true,
      'scan_count', 0,
      'ai_recipe_count', 0,
      'scan_limit', 999,
      'ai_recipe_limit', 999,
      'last_reset', NOW()
    );
  END IF;

  -- Get usage record for FREEMIUM user
  SELECT * INTO v_usage_record
  FROM user_usage_limits
  WHERE user_id = p_user_id;

  -- Create record if it doesn't exist
  IF v_usage_record IS NULL THEN
    INSERT INTO user_usage_limits (user_id, ai_recipe_count, scan_count, last_reset)
    VALUES (p_user_id, 0, 0, NOW())
    RETURNING * INTO v_usage_record;
  END IF;

  -- Check if monthly reset is needed (simplified monthly reset logic)
  IF v_usage_record.last_reset IS NULL OR 
     EXTRACT(MONTH FROM v_usage_record.last_reset) != EXTRACT(MONTH FROM NOW()) OR
     EXTRACT(YEAR FROM v_usage_record.last_reset) != EXTRACT(YEAR FROM NOW()) THEN
    v_should_reset := TRUE;
  END IF;

  -- Perform reset if needed
  IF v_should_reset THEN
    UPDATE user_usage_limits 
    SET 
      scan_count = 0,
      ai_recipe_count = 0,
      last_reset = NOW(),
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_usage_record;
    
    RAISE LOG 'Monthly usage reset for user %', p_user_id;
  END IF;

  -- Return current status
  RETURN jsonb_build_object(
    'tier', v_user_tier,
    'unlimited_access', false,
    'scan_count', v_usage_record.scan_count,
    'ai_recipe_count', v_usage_record.ai_recipe_count,
    'scan_limit', 3,
    'ai_recipe_limit', 10,
    'last_reset', v_usage_record.last_reset,
    'scans_remaining', GREATEST(0, 3 - v_usage_record.scan_count),
    'ai_recipes_remaining', GREATEST(0, 10 - v_usage_record.ai_recipe_count)
  );
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION log_ai_recipe_generation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_pantry_scan(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_status(UUID) TO authenticated;

-- 6. Add helpful comments
COMMENT ON FUNCTION log_ai_recipe_generation(UUID) IS 'Tracks AI recipe generation for FREEMIUM users, increments ai_recipe_count';
COMMENT ON FUNCTION log_pantry_scan(UUID, JSONB, TEXT) IS 'Tracks pantry scans for FREEMIUM users, increments scan_count';
COMMENT ON FUNCTION get_user_usage_status(UUID) IS 'Returns current usage status with limits and remaining usage for FREEMIUM users';

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_user_id ON user_usage_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_last_reset ON user_usage_limits(last_reset); 