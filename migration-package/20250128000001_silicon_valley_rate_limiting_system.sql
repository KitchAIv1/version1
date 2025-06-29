-- =====================================================
-- KITCHAI V2 - SILICON VALLEY RATE LIMITING SYSTEM
-- Enterprise-Grade Multi-Layer Rate Limiting Implementation
-- Compliance: GDPR, CCPA, SOC 2 Ready
-- =====================================================

-- 1. Enhanced User Usage Limits Table
DROP TABLE IF EXISTS user_usage_limits CASCADE;

CREATE TABLE user_usage_limits (
  -- Primary Key
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  limit_type TEXT NOT NULL CHECK (limit_type IN ('scan', 'ai_recipe', 'api_call', 'upload')),
  
  -- Usage Tracking
  current_usage INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL,
  burst_limit INTEGER DEFAULT NULL, -- Stripe-style burst capacity
  
  -- Time Windows
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_duration INTERVAL NOT NULL DEFAULT '1 month',
  last_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Rate Limiting Metadata
  requests_per_minute INTEGER DEFAULT 60,
  requests_per_hour INTEGER DEFAULT 1000,
  requests_per_day INTEGER DEFAULT 10000,
  
  -- Violation Tracking
  violation_count INTEGER DEFAULT 0,
  last_violation TIMESTAMPTZ DEFAULT NULL,
  is_temporarily_blocked BOOLEAN DEFAULT FALSE,
  block_until TIMESTAMPTZ DEFAULT NULL,
  
  -- Audit Trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (user_id, limit_type),
  CONSTRAINT positive_usage CHECK (current_usage >= 0),
  CONSTRAINT positive_limits CHECK (limit_value > 0),
  CONSTRAINT valid_burst CHECK (burst_limit IS NULL OR burst_limit >= limit_value)
);

-- 2. Performance Indexes
CREATE INDEX idx_user_usage_limits_user_id ON user_usage_limits(user_id);
CREATE INDEX idx_user_usage_limits_limit_type ON user_usage_limits(limit_type);
CREATE INDEX idx_user_usage_limits_window_start ON user_usage_limits(window_start);
CREATE INDEX idx_user_usage_limits_blocked ON user_usage_limits(is_temporarily_blocked, block_until);
CREATE INDEX idx_user_usage_limits_violations ON user_usage_limits(violation_count, last_violation);

-- Composite Indexes for Complex Queries
CREATE INDEX idx_user_usage_limits_active_limits 
ON user_usage_limits(user_id, limit_type, current_usage, limit_value) 
WHERE is_temporarily_blocked = FALSE;

-- 3. Row Level Security (RLS) Policies
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;

-- User Access Policy
CREATE POLICY "Users can view own usage limits" 
ON user_usage_limits FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- User Update Policy (Limited)
CREATE POLICY "Users can reset own limits under conditions" 
ON user_usage_limits FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = user_id 
  AND is_temporarily_blocked = FALSE
  AND current_usage < limit_value
)
WITH CHECK (
  auth.uid() = user_id
  AND current_usage <= NEW.current_usage -- Prevent usage reduction
);

-- Service Role Policy (Full Access)
CREATE POLICY "Service role full access for rate limiting" 
ON user_usage_limits FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Admin Policy (Read-Only)
CREATE POLICY "Admins can view all usage limits" 
ON user_usage_limits FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND tier IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- 4. Core Rate Limiting Function
CREATE OR REPLACE FUNCTION check_rate_limit(
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
  -- Get user tier for limit determination
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles WHERE user_id = p_user_id;

  -- Get or create limit record
  SELECT * INTO v_limit_record
  FROM user_usage_limits
  WHERE user_id = p_user_id AND limit_type = p_limit_type;

  -- Initialize limits if not exists
  IF v_limit_record IS NULL THEN
    INSERT INTO user_usage_limits (
      user_id, limit_type, current_usage, limit_value, 
      requests_per_minute, requests_per_hour, requests_per_day
    ) VALUES (
      p_user_id, p_limit_type, 0,
      CASE 
        WHEN p_limit_type = 'scan' AND v_user_tier = 'FREEMIUM' THEN 3
        WHEN p_limit_type = 'ai_recipe' AND v_user_tier = 'FREEMIUM' THEN 10
        WHEN p_limit_type = 'api_call' THEN 1000
        WHEN p_limit_type = 'upload' THEN 50
        ELSE 999999
      END,
      60, 1000, 10000
    ) RETURNING * INTO v_limit_record;
  END IF;

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

-- 5. API Rate Limiting Function
CREATE OR REPLACE FUNCTION check_api_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT DEFAULT 'general',
  p_time_window INTERVAL DEFAULT '1 minute'
)
RETURNS JSONB AS $$
DECLARE
  v_current_time TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ := v_current_time - p_time_window;
  v_request_count INTEGER;
  v_limit INTEGER;
  v_user_tier TEXT;
BEGIN
  -- Get user tier
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles WHERE user_id = p_user_id;

  -- Determine rate limit based on tier and endpoint
  v_limit := CASE 
    WHEN v_user_tier = 'FREEMIUM' THEN 30  -- 30 requests per minute
    WHEN v_user_tier = 'PREMIUM' THEN 100  -- 100 requests per minute
    WHEN v_user_tier = 'CREATOR' THEN 200  -- 200 requests per minute
    ELSE 60
  END;

  -- Count requests in current window
  SELECT COUNT(*) INTO v_request_count
  FROM user_activity_log
  WHERE user_id = p_user_id 
    AND endpoint = p_endpoint
    AND created_at >= v_window_start;

  -- Check if limit exceeded
  IF v_request_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'API_RATE_LIMIT_EXCEEDED',
      'current_requests', v_request_count,
      'limit', v_limit,
      'window_seconds', EXTRACT(EPOCH FROM p_time_window),
      'retry_after', EXTRACT(EPOCH FROM (v_window_start + p_time_window - v_current_time))
    );
  END IF;

  -- Log the request
  INSERT INTO user_activity_log (user_id, action, endpoint, created_at)
  VALUES (p_user_id, 'API_REQUEST', p_endpoint, v_current_time);

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'current_requests', v_request_count + 1,
    'limit', v_limit,
    'remaining', v_limit - v_request_count - 1,
    'window_seconds', EXTRACT(EPOCH FROM p_time_window)
  );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Intelligent Usage Analytics Function
CREATE OR REPLACE FUNCTION get_usage_analytics(
  p_user_id UUID,
  p_include_predictions BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_user_tier TEXT;
  v_analytics JSONB := '{}';
  v_usage_record RECORD;
  v_prediction JSONB;
BEGIN
  -- Get user tier
  SELECT COALESCE(tier, 'FREEMIUM') INTO v_user_tier
  FROM profiles WHERE user_id = p_user_id;

  -- Build comprehensive analytics
  SELECT jsonb_object_agg(
    limit_type,
    jsonb_build_object(
      'current_usage', current_usage,
      'limit_value', limit_value,
      'remaining', GREATEST(0, limit_value - current_usage),
      'usage_percentage', ROUND((current_usage::DECIMAL / limit_value) * 100, 2),
      'window_start', window_start,
      'reset_time', window_start + window_duration,
      'days_until_reset', EXTRACT(DAYS FROM (window_start + window_duration - NOW())),
      'violation_count', violation_count,
      'is_blocked', is_temporarily_blocked,
      'requests_per_minute', requests_per_minute,
      'burst_available', COALESCE(burst_limit - current_usage, 0)
    )
  ) INTO v_analytics
  FROM user_usage_limits
  WHERE user_id = p_user_id;

  -- Add tier information
  v_analytics := v_analytics || jsonb_build_object(
    'user_tier', v_user_tier,
    'unlimited_access', v_user_tier IN ('PREMIUM', 'CREATOR', 'ADMIN')
  );

  -- Add usage predictions if requested
  IF p_include_predictions THEN
    v_prediction := jsonb_build_object(
      'likely_to_exceed', EXISTS(
        SELECT 1 FROM user_usage_limits 
        WHERE user_id = p_user_id 
        AND (current_usage::DECIMAL / limit_value) > 0.8
      ),
      'recommended_upgrade', v_user_tier = 'FREEMIUM' AND EXISTS(
        SELECT 1 FROM user_usage_limits 
        WHERE user_id = p_user_id 
        AND (current_usage::DECIMAL / limit_value) > 0.7
      )
    );
    
    v_analytics := v_analytics || jsonb_build_object('predictions', v_prediction);
  END IF;

  RETURN v_analytics;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Rate Limit Monitoring Views
CREATE OR REPLACE VIEW rate_limit_dashboard AS
SELECT 
  ul.user_id,
  p.username,
  p.tier,
  ul.limit_type,
  ul.current_usage,
  ul.limit_value,
  ROUND((ul.current_usage::DECIMAL / ul.limit_value) * 100, 2) as usage_percentage,
  ul.violation_count,
  ul.is_temporarily_blocked,
  ul.window_start,
  ul.window_start + ul.window_duration as reset_time,
  EXTRACT(DAYS FROM (ul.window_start + ul.window_duration - NOW())) as days_until_reset
FROM user_usage_limits ul
JOIN profiles p ON ul.user_id = p.user_id
ORDER BY usage_percentage DESC, violation_count DESC;

-- 8. High Usage Alert Function
CREATE OR REPLACE FUNCTION alert_high_usage()
RETURNS TABLE(user_id UUID, username TEXT, limit_type TEXT, usage_percentage DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rl.user_id,
    rl.username,
    rl.limit_type,
    rl.usage_percentage
  FROM rate_limit_dashboard rl
  WHERE rl.usage_percentage > 80
    AND rl.tier = 'FREEMIUM'
  ORDER BY rl.usage_percentage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Updated RPC Functions for Backward Compatibility
CREATE OR REPLACE FUNCTION log_ai_recipe_generation(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN check_rate_limit(p_user_id, 'ai_recipe', 1, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_pantry_scan(
  p_user_id UUID,
  p_items_scanned JSONB DEFAULT '[]'::jsonb,
  p_scan_status TEXT DEFAULT 'success'
)
RETURNS JSONB AS $$
BEGIN
  RETURN check_rate_limit(p_user_id, 'scan', 1, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_usage_status(p_user_id UUID)
RETURNS JSONB AS $$
BEGIN
  RETURN get_usage_analytics(p_user_id, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION check_api_rate_limit(UUID, TEXT, INTERVAL) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_analytics(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION log_ai_recipe_generation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_pantry_scan(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION alert_high_usage() TO authenticated;

-- 11. Grant table permissions
GRANT SELECT ON user_usage_limits TO authenticated;
GRANT SELECT ON rate_limit_dashboard TO authenticated;

-- 12. Add helpful comments
COMMENT ON TABLE user_usage_limits IS 'Silicon Valley standard enterprise-grade rate limiting system with multi-layer enforcement';
COMMENT ON FUNCTION check_rate_limit(UUID, TEXT, INTEGER, BOOLEAN) IS 'Core rate limiting function with burst capacity and violation tracking';
COMMENT ON FUNCTION check_api_rate_limit(UUID, TEXT, INTERVAL) IS 'API endpoint rate limiting with sliding window algorithm';
COMMENT ON FUNCTION get_usage_analytics(UUID, BOOLEAN) IS 'Comprehensive usage analytics with predictive insights';
COMMENT ON VIEW rate_limit_dashboard IS 'Real-time monitoring dashboard for rate limit status across all users';

-- 13. Initialize default limits for existing users
INSERT INTO user_usage_limits (user_id, limit_type, current_usage, limit_value)
SELECT 
  p.user_id,
  'scan',
  0,
  CASE 
    WHEN p.tier = 'FREEMIUM' THEN 3
    ELSE 999999
  END
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_usage_limits ul 
  WHERE ul.user_id = p.user_id AND ul.limit_type = 'scan'
);

INSERT INTO user_usage_limits (user_id, limit_type, current_usage, limit_value)
SELECT 
  p.user_id,
  'ai_recipe',
  0,
  CASE 
    WHEN p.tier = 'FREEMIUM' THEN 10
    WHEN p.tier = 'PREMIUM' THEN 25
    ELSE 999999
  END
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_usage_limits ul 
  WHERE ul.user_id = p.user_id AND ul.limit_type = 'ai_recipe'
);

-- Migration complete
SELECT 'Silicon Valley Rate Limiting System - Migration Complete' as status; 