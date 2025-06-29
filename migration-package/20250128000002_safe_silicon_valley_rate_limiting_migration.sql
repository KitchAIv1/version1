-- =====================================================
-- KITCHAI V2 - SAFE SILICON VALLEY RATE LIMITING MIGRATION
-- Preserves existing data while adding Silicon Valley standards
-- Maintains backward compatibility with existing frontend
-- =====================================================

-- 1. BACKUP EXISTING DATA (Safety First)
CREATE TABLE IF NOT EXISTS user_usage_limits_backup_20250128 AS 
SELECT * FROM user_usage_limits;

-- 2. ADD NEW COLUMNS TO EXISTING TABLE (Non-breaking approach)
DO $$ 
BEGIN
  -- Add limit_type column with default value
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'limit_type') THEN
    ALTER TABLE user_usage_limits ADD COLUMN limit_type TEXT DEFAULT 'ai_recipe';
  END IF;

  -- Add current_usage column (maps to existing usage)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'current_usage') THEN
    ALTER TABLE user_usage_limits ADD COLUMN current_usage INTEGER;
  END IF;

  -- Add limit_value column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'limit_value') THEN
    ALTER TABLE user_usage_limits ADD COLUMN limit_value INTEGER DEFAULT 10;
  END IF;

  -- Add Silicon Valley standard columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'burst_limit') THEN
    ALTER TABLE user_usage_limits ADD COLUMN burst_limit INTEGER DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'window_start') THEN
    ALTER TABLE user_usage_limits ADD COLUMN window_start TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'window_duration') THEN
    ALTER TABLE user_usage_limits ADD COLUMN window_duration INTERVAL DEFAULT '1 month';
  END IF;

  -- Add rate limiting metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'requests_per_minute') THEN
    ALTER TABLE user_usage_limits ADD COLUMN requests_per_minute INTEGER DEFAULT 60;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'requests_per_hour') THEN
    ALTER TABLE user_usage_limits ADD COLUMN requests_per_hour INTEGER DEFAULT 1000;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'requests_per_day') THEN
    ALTER TABLE user_usage_limits ADD COLUMN requests_per_day INTEGER DEFAULT 10000;
  END IF;

  -- Add violation tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'violation_count') THEN
    ALTER TABLE user_usage_limits ADD COLUMN violation_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'last_violation') THEN
    ALTER TABLE user_usage_limits ADD COLUMN last_violation TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'is_temporarily_blocked') THEN
    ALTER TABLE user_usage_limits ADD COLUMN is_temporarily_blocked BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'block_until') THEN
    ALTER TABLE user_usage_limits ADD COLUMN block_until TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- Add compatibility fields for frontend
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_usage_limits' AND column_name = 'used_value') THEN
    ALTER TABLE user_usage_limits ADD COLUMN used_value INTEGER;
  END IF;
END $$;

-- 3. MIGRATE EXISTING DATA TO NEW STRUCTURE
UPDATE user_usage_limits 
SET 
  current_usage = COALESCE(ai_recipe_count, 0),
  used_value = COALESCE(ai_recipe_count, 0),
  limit_value = 10,
  limit_type = 'ai_recipe',
  window_start = COALESCE(last_reset, NOW()),
  last_reset = COALESCE(last_reset, NOW())
WHERE limit_type IS NULL OR limit_type = 'ai_recipe';

-- 4. CREATE SCAN LIMIT RECORDS (Preserve existing scan data)
INSERT INTO user_usage_limits (
  user_id, limit_type, current_usage, used_value, limit_value, 
  scan_count, ai_recipe_count, last_reset, created_at, updated_at,
  window_start, window_duration, requests_per_minute, requests_per_hour, requests_per_day
)
SELECT DISTINCT
  user_id, 
  'scan',
  COALESCE(scan_count, 0),
  COALESCE(scan_count, 0),
  3,
  COALESCE(scan_count, 0),
  COALESCE(ai_recipe_count, 0),
  COALESCE(last_reset, NOW()),
  COALESCE(created_at, NOW()),
  COALESCE(updated_at, NOW()),
  COALESCE(last_reset, NOW()),
  '1 month'::interval,
  60,
  1000,
  10000
FROM user_usage_limits_backup_20250128
WHERE NOT EXISTS (
  SELECT 1 FROM user_usage_limits 
  WHERE user_usage_limits.user_id = user_usage_limits_backup_20250128.user_id 
  AND limit_type = 'scan'
);

-- 5. ADD CONSTRAINTS (Safe approach - only if they don't exist)
DO $$
BEGIN
  -- Add check constraints
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'positive_usage_safe') THEN
    ALTER TABLE user_usage_limits ADD CONSTRAINT positive_usage_safe CHECK (current_usage >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'positive_limits_safe') THEN
    ALTER TABLE user_usage_limits ADD CONSTRAINT positive_limits_safe CHECK (limit_value > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'valid_burst_safe') THEN
    ALTER TABLE user_usage_limits ADD CONSTRAINT valid_burst_safe CHECK (burst_limit IS NULL OR burst_limit >= limit_value);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints 
                 WHERE constraint_name = 'valid_limit_type_safe') THEN
    ALTER TABLE user_usage_limits ADD CONSTRAINT valid_limit_type_safe CHECK (limit_type IN ('scan', 'ai_recipe', 'api_call', 'upload'));
  END IF;
END $$;

-- 6. CREATE PERFORMANCE INDEXES (Safe approach)
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_user_id_safe ON user_usage_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_limit_type_safe ON user_usage_limits(limit_type);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_window_start_safe ON user_usage_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_blocked_safe ON user_usage_limits(is_temporarily_blocked, block_until);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_violations_safe ON user_usage_limits(violation_count, last_violation);
CREATE INDEX IF NOT EXISTS idx_user_usage_limits_active_limits_safe 
ON user_usage_limits(user_id, limit_type, current_usage, limit_value) 
WHERE is_temporarily_blocked = FALSE;

-- 7. ENSURE RLS IS ENABLED
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;

-- 8. CREATE SAFE RLS POLICIES (Drop existing and recreate)
DROP POLICY IF EXISTS "Users can view own usage limits" ON user_usage_limits;
DROP POLICY IF EXISTS "Users can update own usage limits" ON user_usage_limits;
DROP POLICY IF EXISTS "Service role full access for rate limiting" ON user_usage_limits;
DROP POLICY IF EXISTS "Admins can view all usage limits" ON user_usage_limits;

-- User access policy
CREATE POLICY "Users can view own usage limits safe" 
ON user_usage_limits FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- User update policy (limited and safe)
CREATE POLICY "Users can reset own limits under conditions safe" 
ON user_usage_limits FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = user_id 
  AND is_temporarily_blocked = FALSE
  AND current_usage < limit_value
)
WITH CHECK (
  auth.uid() = user_id
  AND current_usage <= NEW.current_usage
);

-- Service role policy (full access for backend operations)
CREATE POLICY "Service role full access for rate limiting safe" 
ON user_usage_limits FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- CORRECTED Admin policy (uses profiles table, not non-existent admin_users)
CREATE POLICY "Admins can view all usage limits safe" 
ON user_usage_limits FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tier IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- 9. CREATE MEMORY-COMPLIANT HELPER FUNCTION
CREATE OR REPLACE FUNCTION ensure_user_usage_limits_safe(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- MEMORY COMPLIANT: Create resources for new users instead of failing
  
  -- Ensure profile exists (create if doesn't exist)
  INSERT INTO profiles (user_id, tier, role, onboarded, username, created_at, updated_at)
  VALUES (p_user_id, 'FREEMIUM', NULL, FALSE, 'user_' || substring(p_user_id::text, 1, 8), NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create AI recipe usage limits for new users
  INSERT INTO user_usage_limits (
    user_id, limit_type, current_usage, used_value, limit_value, 
    ai_recipe_count, scan_count, last_reset, created_at, updated_at,
    window_start, window_duration, requests_per_minute, requests_per_hour, requests_per_day
  )
  VALUES (
    p_user_id, 'ai_recipe', 0, 0, 10,
    0, 0, NOW(), NOW(), NOW(),
    NOW(), '1 month'::interval, 60, 1000, 10000
  )
  ON CONFLICT (user_id, limit_type) DO NOTHING;
  
  -- Create scan usage limits for new users
  INSERT INTO user_usage_limits (
    user_id, limit_type, current_usage, used_value, limit_value, 
    ai_recipe_count, scan_count, last_reset, created_at, updated_at,
    window_start, window_duration, requests_per_minute, requests_per_hour, requests_per_day
  )
  VALUES (
    p_user_id, 'scan', 0, 0, 3,
    0, 0, NOW(), NOW(), NOW(),
    NOW(), '1 month'::interval, 60, 1000, 10000
  )
  ON CONFLICT (user_id, limit_type) DO NOTHING;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. CREATE ENHANCED RATE LIMITING FUNCTION (Silicon Valley Standard)
CREATE OR REPLACE FUNCTION check_rate_limit_v2(
  p_user_id UUID,
  p_limit_type TEXT,
  p_increment INTEGER DEFAULT 1,
  p_respect_blocks BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_user_tier TEXT;
  v_limit_record RECORD;
  v_current_time TIMESTAMPTZ := NOW();
  v_window_expired BOOLEAN := FALSE;
  v_new_usage INTEGER;
  v_result JSONB;
BEGIN
  -- MEMORY COMPLIANT: Ensure user has usage limits
  PERFORM ensure_user_usage_limits_safe(p_user_id);

  -- Get user tier for limit determination
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles WHERE user_id = p_user_id;

  -- Get limit record
  SELECT * INTO v_limit_record
  FROM user_usage_limits
  WHERE user_id = p_user_id AND limit_type = p_limit_type;

  -- Check if user is temporarily blocked
  IF p_respect_blocks AND v_limit_record.is_temporarily_blocked THEN
    IF v_limit_record.block_until IS NULL OR v_current_time < v_limit_record.block_until THEN
      RETURN jsonb_build_object(
        'allowed', FALSE,
        'reason', 'TEMPORARILY_BLOCKED',
        'blocked_until', v_limit_record.block_until,
        'current_usage', v_limit_record.current_usage,
        'limit_value', v_limit_record.limit_value,
        'reset_time', v_limit_record.window_start + v_limit_record.window_duration
      );
    ELSE
      -- Unblock user if block period expired
      UPDATE user_usage_limits 
      SET is_temporarily_blocked = FALSE, block_until = NULL
      WHERE user_id = p_user_id AND limit_type = p_limit_type;
    END IF;
  END IF;

  -- Check if window has expired (monthly reset)
  IF v_current_time >= (v_limit_record.window_start + v_limit_record.window_duration) THEN
    v_window_expired := TRUE;
    
    -- Reset usage for new window
    UPDATE user_usage_limits 
    SET 
      current_usage = 0,
      used_value = 0,
      ai_recipe_count = CASE WHEN p_limit_type = 'ai_recipe' THEN 0 ELSE ai_recipe_count END,
      scan_count = CASE WHEN p_limit_type = 'scan' THEN 0 ELSE scan_count END,
      window_start = v_current_time,
      last_reset = v_current_time,
      violation_count = 0,
      is_temporarily_blocked = FALSE,
      block_until = NULL,
      updated_at = v_current_time
    WHERE user_id = p_user_id AND limit_type = p_limit_type
    RETURNING * INTO v_limit_record;
  END IF;

  -- Calculate new usage
  v_new_usage := v_limit_record.current_usage + p_increment;

  -- Check if limit would be exceeded
  IF v_new_usage > v_limit_record.limit_value THEN
    -- Log violation
    UPDATE user_usage_limits 
    SET 
      violation_count = violation_count + 1,
      last_violation = v_current_time,
      updated_at = v_current_time
    WHERE user_id = p_user_id AND limit_type = p_limit_type;

    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'LIMIT_EXCEEDED',
      'current_usage', v_limit_record.current_usage,
      'limit_value', v_limit_record.limit_value,
      'remaining', 0,
      'reset_time', v_limit_record.window_start + v_limit_record.window_duration,
      'window_expired', v_window_expired
    );
  END IF;

  -- Increment usage
  UPDATE user_usage_limits 
  SET 
    current_usage = v_new_usage,
    used_value = v_new_usage,
    ai_recipe_count = CASE WHEN p_limit_type = 'ai_recipe' THEN v_new_usage ELSE ai_recipe_count END,
    scan_count = CASE WHEN p_limit_type = 'scan' THEN v_new_usage ELSE scan_count END,
    updated_at = v_current_time
  WHERE user_id = p_user_id AND limit_type = p_limit_type;

  -- Return success
  RETURN jsonb_build_object(
    'allowed', TRUE,
    'current_usage', v_new_usage,
    'limit_value', v_limit_record.limit_value,
    'remaining', v_limit_record.limit_value - v_new_usage,
    'reset_time', v_limit_record.window_start + v_limit_record.window_duration,
    'window_expired', v_window_expired,
    'requests_per_minute', v_limit_record.requests_per_minute,
    'requests_per_hour', v_limit_record.requests_per_hour
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. MAINTAIN BACKWARD COMPATIBILITY - Update existing functions to use new system
CREATE OR REPLACE FUNCTION log_ai_recipe_generation(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Use new rate limiting system but maintain compatible return format
  RETURN check_rate_limit_v2(p_user_id, 'ai_recipe', 1, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_pantry_scan(
  p_user_id UUID,
  p_items_scanned JSONB DEFAULT '[]'::jsonb,
  p_scan_status TEXT DEFAULT 'success'
)
RETURNS JSONB AS $$
BEGIN
  -- Use new rate limiting system but maintain compatible return format
  RETURN check_rate_limit_v2(p_user_id, 'scan', 1, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ENHANCED USAGE STATUS FUNCTION (Backward Compatible)
CREATE OR REPLACE FUNCTION get_user_usage_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_tier TEXT;
  v_ai_record RECORD;
  v_scan_record RECORD;
  v_result JSONB;
BEGIN
  -- MEMORY COMPLIANT: Ensure user has usage limits
  PERFORM ensure_user_usage_limits_safe(p_user_id);

  -- Get user tier
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles WHERE user_id = p_user_id;

  -- For non-FREEMIUM users, return unlimited status
  IF v_user_tier != 'FREEMIUM' THEN
    RETURN jsonb_build_object(
      'tier', v_user_tier,
      'unlimited_access', true,
      'scan_count', 0,
      'ai_recipe_count', 0,
      'scan_limit', 999,
      'ai_recipe_limit', 999,
      'last_reset', NOW(),
      'scans_remaining', 999,
      'ai_recipes_remaining', 999
    );
  END IF;

  -- Get AI recipe usage
  SELECT * INTO v_ai_record
  FROM user_usage_limits
  WHERE user_id = p_user_id AND limit_type = 'ai_recipe';

  -- Get scan usage
  SELECT * INTO v_scan_record
  FROM user_usage_limits
  WHERE user_id = p_user_id AND limit_type = 'scan';

  -- Build compatible response
  RETURN jsonb_build_object(
    'tier', v_user_tier,
    'unlimited_access', false,
    'scan_count', COALESCE(v_scan_record.current_usage, v_scan_record.scan_count, 0),
    'ai_recipe_count', COALESCE(v_ai_record.current_usage, v_ai_record.ai_recipe_count, 0),
    'scan_limit', COALESCE(v_scan_record.limit_value, 3),
    'ai_recipe_limit', COALESCE(v_ai_record.limit_value, 10),
    'last_reset', COALESCE(v_ai_record.last_reset, NOW()),
    'scans_remaining', GREATEST(0, COALESCE(v_scan_record.limit_value, 3) - COALESCE(v_scan_record.current_usage, v_scan_record.scan_count, 0)),
    'ai_recipes_remaining', GREATEST(0, COALESCE(v_ai_record.limit_value, 10) - COALESCE(v_ai_record.current_usage, v_ai_record.ai_recipe_count, 0))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION ensure_user_usage_limits_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit_v2(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION log_ai_recipe_generation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_pantry_scan(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_status(UUID) TO authenticated;

-- Grant table permissions
GRANT SELECT ON user_usage_limits TO authenticated;

-- 14. ADD HELPFUL COMMENTS
COMMENT ON TABLE user_usage_limits IS 'Enhanced Silicon Valley standard rate limiting system with backward compatibility';
COMMENT ON FUNCTION ensure_user_usage_limits_safe(UUID) IS 'Memory compliant function that creates resources for new users instead of failing';
COMMENT ON FUNCTION check_rate_limit_v2(UUID, TEXT, INTEGER, BOOLEAN) IS 'Silicon Valley standard rate limiting with comprehensive violation tracking';
COMMENT ON FUNCTION log_ai_recipe_generation(UUID) IS 'Backward compatible AI recipe logging with enhanced rate limiting';
COMMENT ON FUNCTION get_user_usage_status(UUID) IS 'Enhanced usage status with backward compatibility for existing frontend';

-- 15. VERIFY MIGRATION SUCCESS
DO $$
DECLARE
  v_backup_count INTEGER;
  v_current_count INTEGER;
  v_ai_records INTEGER;
  v_scan_records INTEGER;
BEGIN
  -- Count records in backup
  SELECT COUNT(*) INTO v_backup_count FROM user_usage_limits_backup_20250128;
  
  -- Count current records
  SELECT COUNT(*) INTO v_current_count FROM user_usage_limits;
  
  -- Count AI recipe records
  SELECT COUNT(*) INTO v_ai_records FROM user_usage_limits WHERE limit_type = 'ai_recipe';
  
  -- Count scan records
  SELECT COUNT(*) INTO v_scan_records FROM user_usage_limits WHERE limit_type = 'scan';
  
  -- Log migration results
  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '  - Backup records: %', v_backup_count;
  RAISE NOTICE '  - Current records: %', v_current_count;
  RAISE NOTICE '  - AI recipe records: %', v_ai_records;
  RAISE NOTICE '  - Scan records: %', v_scan_records;
  
  -- Verify no data loss
  IF v_current_count < v_backup_count THEN
    RAISE WARNING 'Potential data loss detected! Current count (%) < Backup count (%)', v_current_count, v_backup_count;
  ELSE
    RAISE NOTICE '✅ No data loss detected - migration successful!';
  END IF;
END $$;

-- Migration complete
SELECT 'Safe Silicon Valley Rate Limiting Migration - COMPLETED SUCCESSFULLY' as status; 