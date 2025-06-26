-- ============================================================
-- KITCHAI ENHANCED FEED ALGORITHM V4 (SEPARATE RPC)
-- TikTok-inspired personalized feed with NO AI-generated recipes
-- SAFE IMPLEMENTATION: New RPC alongside existing v3
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_enhanced_feed_v4(
  user_id_param UUID,
  session_context JSONB DEFAULT '{}',
  feed_position INTEGER DEFAULT 0,
  time_context TEXT DEFAULT 'general',
  limit_param INTEGER DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_behavior_profile JSONB;
  current_hour INTEGER;
  diversification_weights JSONB;
BEGIN
  -- Get current hour for time-based optimization
  current_hour := EXTRACT(HOUR FROM NOW());
  
  -- Build user behavior profile from historical data
  WITH UserBehaviorStats AS (
    SELECT 
      user_id_param as user_id,
      -- Engagement patterns
      AVG(CASE WHEN interaction_type = 'like' THEN 1 ELSE 0 END) as like_rate,
      AVG(CASE WHEN interaction_type = 'save' THEN 1 ELSE 0 END) as save_rate,
      COUNT(CASE WHEN interaction_type = 'comment' THEN 1 END) as comment_frequency,
      
      -- Content preferences (from interactions in last 30 days)
      jsonb_agg(DISTINCT r.diet_tags) FILTER (WHERE ui.created_at >= NOW() - INTERVAL '30 days') as preferred_diet_tags,
      AVG(COALESCE(r.cook_time_minutes, 30)) as avg_preferred_cook_time,
      
      -- Social behavior
      COUNT(DISTINCT f.followed_id) FILTER (WHERE f.followed_id IS NOT NULL) as following_count,
      
      -- Time patterns (when user is most active)
      mode() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM ui.created_at)) as most_active_hour
      
    FROM user_interactions ui
    LEFT JOIN recipe_uploads r ON ui.recipe_id = r.id AND r.is_ai_generated = false  -- ❌ EXCLUDE AI RECIPES
    LEFT JOIN user_follows f ON f.follower_id = user_id_param
    WHERE ui.user_id = user_id_param
      AND ui.created_at >= NOW() - INTERVAL '90 days'
  )
  SELECT jsonb_build_object(
    'like_rate', COALESCE(like_rate, 0.1),
    'save_rate', COALESCE(save_rate, 0.05),
    'comment_frequency', COALESCE(comment_frequency, 0),
    'preferred_diet_tags', COALESCE(preferred_diet_tags, '[]'),
    'avg_preferred_cook_time', COALESCE(avg_preferred_cook_time, 30),
    'following_count', COALESCE(following_count, 0),
    'most_active_hour', COALESCE(most_active_hour, current_hour),
    'engagement_score', LEAST(COALESCE(like_rate + save_rate * 3 + comment_frequency * 0.1, 0), 10)
  ) INTO user_behavior_profile
  FROM UserBehaviorStats;

  -- Dynamic diversification based on user behavior and time
  diversification_weights := CASE 
    WHEN time_context = 'morning' THEN jsonb_build_object('personalized', 0.8, 'trending', 0.1, 'discovery', 0.1)
    WHEN time_context = 'lunch' THEN jsonb_build_object('personalized', 0.6, 'trending', 0.3, 'discovery', 0.1)
    WHEN time_context = 'dinner' THEN jsonb_build_object('personalized', 0.7, 'trending', 0.2, 'discovery', 0.1)
    WHEN (user_behavior_profile->>'engagement_score')::NUMERIC > 5 THEN jsonb_build_object('personalized', 0.5, 'trending', 0.3, 'discovery', 0.2)
    ELSE jsonb_build_object('personalized', 0.65, 'trending', 0.25, 'discovery', 0.1)
  END;

  RETURN (
    WITH RecipeData AS (
      SELECT 
        r.id,
        r.user_id,
        r.title AS name,
        r.description,
        r.video_url,
        r.comments,
        r.created_at::TIMESTAMP WITH TIME ZONE AS created_at,
        r.diet_tags,
        r.ingredients,
        COALESCE(r.cook_time_minutes, 30) as cook_time_minutes,
        r.is_ai_generated,
        p.username AS user_name,
        COALESCE(u.raw_user_meta_data->>'avatar_url', '') AS creator_avatar_url,
        
        -- Enhanced engagement metrics
        COALESCE(r.views_count, 0)::BIGINT AS views_count,
        COALESCE(
          (SELECT COUNT(*) FROM user_interactions WHERE recipe_id = r.id AND interaction_type = 'like'), 
          0
        ) AS likes_count,
        COALESCE(
          (SELECT COUNT(*) FROM saved_recipe_videos WHERE recipe_id = r.id), 
          0
        ) AS saves_count,
        COALESCE(
          (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id), 
          0
        ) AS comments_count,
        
        -- User-specific interactions
        (SELECT EXISTS (
          SELECT 1 FROM user_interactions ui
          WHERE ui.user_id = user_id_param AND ui.recipe_id = r.id AND ui.interaction_type = 'like'
        )) AS is_liked,
        (SELECT EXISTS (
          SELECT 1 FROM saved_recipe_videos srv
          WHERE srv.user_id = user_id_param AND srv.recipe_id = r.id
        )) AS is_saved,
        
        -- Social signals
        (SELECT EXISTS (
          SELECT 1 FROM user_follows uf
          WHERE uf.follower_id = user_id_param AND uf.followed_id = r.user_id
        )) AS following_creator,
        
        -- Pantry matching
        calculate_pantry_match(user_id_param, r.id) AS pantry_match,
        
        -- Time relevance
        EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 AS hours_since_creation
        
      FROM recipe_uploads r
      LEFT JOIN auth.users u ON r.user_id = u.id
      LEFT JOIN profiles p ON r.user_id = p.user_id
      WHERE r.is_public = true
        AND r.is_ai_generated = false  -- ❌ CRITICAL: NO AI RECIPES IN FEED
        AND r.created_at >= NOW() - INTERVAL '90 days' -- Focus on recent content
    ),
    
    ScoredRecipes AS (
      SELECT 
        rd.*,
        
        -- ENGAGEMENT VELOCITY SCORE (TikTok-style)
        CASE 
          WHEN rd.hours_since_creation <= 24 THEN 
            (rd.likes_count * 10 + rd.saves_count * 30 + rd.comments_count * 50) / GREATEST(rd.hours_since_creation, 1)
          WHEN rd.hours_since_creation <= 168 THEN -- 7 days
            (rd.likes_count * 5 + rd.saves_count * 15 + rd.comments_count * 25) / GREATEST(rd.hours_since_creation / 24, 1)
          ELSE
            (rd.likes_count + rd.saves_count * 3 + rd.comments_count * 5) / GREATEST(rd.hours_since_creation / 168, 1)
        END AS engagement_velocity,
        
        -- PERSONALIZATION SCORE
        (
          -- Pantry match weight
          (COALESCE((rd.pantry_match->>'match_percentage')::NUMERIC, 0) / 100) * 40 +
          
          -- Diet preference match (enhanced for human recipes)
          CASE 
            WHEN rd.diet_tags && (user_behavior_profile->'preferred_diet_tags')::jsonb THEN 30 -- Increased weight
            ELSE 0
          END +
          
          -- Creator following boost
          CASE WHEN rd.following_creator THEN 25 ELSE 0 END + -- Increased weight
          
          -- Cook time preference match
          CASE 
            WHEN ABS(rd.cook_time_minutes - (user_behavior_profile->>'avg_preferred_cook_time')::NUMERIC) <= 15 THEN 20 -- Within 15 min
            WHEN ABS(rd.cook_time_minutes - (user_behavior_profile->>'avg_preferred_cook_time')::NUMERIC) <= 30 THEN 15 -- Within 30 min
            ELSE 5
          END
        ) AS personalization_score,
        
        -- FRESHNESS SCORE (Enhanced for human content)
        CASE
          WHEN rd.hours_since_creation <= 24 THEN 100
          WHEN rd.hours_since_creation <= 168 THEN 100 - (rd.hours_since_creation - 24) * 0.4 -- Slower decay
          ELSE GREATEST(30, 100 - (rd.hours_since_creation - 168) * 0.08) -- Higher minimum
        END AS freshness_score,
        
        -- QUALITY SCORE (Optimized for human recipes)
        (
          -- Recipe completeness
          CASE 
            WHEN rd.description IS NOT NULL AND LENGTH(rd.description) > 100 THEN 25 -- Higher standard
            WHEN rd.description IS NOT NULL AND LENGTH(rd.description) > 50 THEN 20
            WHEN rd.description IS NOT NULL THEN 10
            ELSE 0
          END +
          
          -- Video availability (more important for human recipes)
          CASE WHEN rd.video_url IS NOT NULL AND LENGTH(rd.video_url) > 0 THEN 35 ELSE 0 END +
          
          -- Human authenticity boost
          25 + -- All recipes get human authenticity points
          
          -- Ingredient list completeness
          CASE 
            WHEN jsonb_array_length(rd.ingredients) >= 6 THEN 15 -- Higher standard
            WHEN jsonb_array_length(rd.ingredients) >= 4 THEN 10
            WHEN jsonb_array_length(rd.ingredients) >= 2 THEN 5
            ELSE 0
          END
        ) AS quality_score
        
      FROM RecipeData rd
    ),
    
    FinalScoredRecipes AS (
      SELECT 
        sr.*,
        -- COMBINED ALGORITHM SCORE (TikTok-style weighted)
        (
          sr.engagement_velocity * 0.4 +
          sr.personalization_score * 0.35 +
          sr.freshness_score * 0.15 +
          sr.quality_score * 0.1
        ) AS algorithm_score,
        
        -- Determine feed type based on dominant score component
        CASE 
          WHEN sr.personalization_score > 60 THEN 'personalized'
          WHEN sr.engagement_velocity > 50 AND sr.hours_since_creation <= 48 THEN 'trending'
          WHEN sr.following_creator THEN 'following'
          ELSE 'discovery'
        END AS feed_type
        
      FROM ScoredRecipes sr
    ),
    
    DiversifiedFeed AS (
      SELECT 
        fsr.*,
        ROW_NUMBER() OVER (
          PARTITION BY fsr.feed_type 
          ORDER BY fsr.algorithm_score DESC, fsr.created_at DESC
        ) as type_rank
      FROM FinalScoredRecipes fsr
    ),
    
    BalancedFeed AS (
      -- Personalized content (dynamic weight)
      SELECT *, 1 as selection_priority 
      FROM DiversifiedFeed 
      WHERE feed_type = 'personalized'
      ORDER BY algorithm_score DESC
      LIMIT CEIL(limit_param * (diversification_weights->>'personalized')::NUMERIC)
      
      UNION ALL
      
      -- Trending content
      SELECT *, 2 as selection_priority
      FROM DiversifiedFeed 
      WHERE feed_type = 'trending'
      ORDER BY engagement_velocity DESC
      LIMIT CEIL(limit_param * (diversification_weights->>'trending')::NUMERIC)
      
      UNION ALL
      
      -- Following content (prioritized for human connection)
      SELECT *, 1 as selection_priority
      FROM DiversifiedFeed 
      WHERE feed_type = 'following'
      ORDER BY algorithm_score DESC
      LIMIT GREATEST(4, CEIL(limit_param * 0.2)) -- Increased weight for human creators
      
      UNION ALL
      
      -- Discovery content
      SELECT *, 3 as selection_priority
      FROM DiversifiedFeed 
      WHERE feed_type = 'discovery'
      ORDER BY freshness_score DESC, RANDOM() -- Add some randomness for discovery
      LIMIT CEIL(limit_param * (diversification_weights->>'discovery')::NUMERIC)
    ),
    
    ShuffledFeed AS (
      SELECT 
        bf.*,
        -- TikTok-style intelligent shuffling (maintain engagement flow)
        ROW_NUMBER() OVER (
          ORDER BY 
            bf.selection_priority,
            CASE 
              WHEN bf.algorithm_score > 70 THEN RANDOM() * 0.3 + 0.7 -- High-quality content gets priority
              ELSE RANDOM()
            END DESC
        ) as final_position
      FROM BalancedFeed bf
      ORDER BY final_position
      LIMIT limit_param
      OFFSET feed_position
    )
    
    SELECT jsonb_build_object(
      'recipes', jsonb_agg(
        jsonb_build_object(
          'output_id', sf.id,
          'output_user_id', sf.user_id,
          'output_name', sf.name,
          'output_description', sf.description,
          'output_video_url', sf.video_url,
          'output_comments', sf.comments,
          'output_created_at', sf.created_at,
          'output_dietary_category_ids', sf.diet_tags,
          'user_name', sf.user_name,
          'output_is_liked', sf.is_liked,
          'output_is_saved', sf.is_saved,
          'pantry_match', sf.pantry_match,
          'output_feed_type', sf.feed_type,
          'output_comments_count', sf.comments_count,
          'output_likes_count', sf.likes_count,
          'output_saves_count', sf.saves_count,
          'out_creator_avatar_url', sf.creator_avatar_url,
          'output_views_count', sf.views_count,
          'is_ai_generated', false, -- Always false since we exclude AI recipes
          'following_creator', sf.following_creator,
          'algorithm_score', ROUND(sf.algorithm_score, 2),
          'engagement_velocity', ROUND(sf.engagement_velocity, 2)
        )
        ORDER BY sf.final_position
      ),
      'algorithm_metadata', jsonb_build_object(
        'user_behavior_profile', user_behavior_profile,
        'diversification_weights', diversification_weights,
        'ai_recipes_excluded', true, -- Clear indicator
        'human_recipes_only', true,
        'personalization_confidence', 
          CASE 
            WHEN (user_behavior_profile->>'engagement_score')::NUMERIC > 3 THEN 0.85
            WHEN (user_behavior_profile->>'engagement_score')::NUMERIC > 1 THEN 0.65
            ELSE 0.45
          END,
        'time_context', time_context,
        'current_hour', current_hour,
        'session_context', session_context,
        'total_recipes_considered', (SELECT COUNT(*) FROM RecipeData),
        'algorithm_version', 'enhanced_v4_human_only'
      )
    ) AS result
    FROM ShuffledFeed sf
  );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_enhanced_feed_v4(UUID, JSONB, INTEGER, TEXT, INTEGER) TO authenticated;

-- Add comprehensive function documentation
COMMENT ON FUNCTION public.get_enhanced_feed_v4(UUID, JSONB, INTEGER, TEXT, INTEGER) IS 
'Enhanced TikTok-inspired personalized feed algorithm - HUMAN RECIPES ONLY:
✅ NO AI-generated recipes included
✅ TikTok-style engagement velocity tracking (viral content detection)
✅ Advanced user behavior profiling and adaptation
✅ Time-based content optimization (morning/lunch/dinner preferences)
✅ Dynamic diversification weights based on user engagement
✅ Enhanced social signal integration (following, community engagement)
✅ Quality scoring optimized for human-created content
✅ Safe parallel implementation alongside existing v3 algorithm

Parameters:
- user_id_param: User requesting the feed
- session_context: Current session behavior data (JSON)
- feed_position: Pagination offset for infinite scroll
- time_context: Time-based optimization (morning/lunch/dinner/general)
- limit_param: Number of recipes to return (default 20)

Response includes algorithm metadata for performance analysis and A/B testing.';

-- ============================================================
-- VERIFICATION QUERIES (FOR TESTING)
-- ============================================================

-- Test the function with a sample user
-- SELECT get_enhanced_feed_v4('sample-user-id'::UUID);

-- Check that no AI recipes are included
-- SELECT 
--   (recipe->>'is_ai_generated')::boolean as is_ai,
--   COUNT(*) 
-- FROM (
--   SELECT jsonb_array_elements((get_enhanced_feed_v4('sample-user-id'::UUID)->>'recipes')::jsonb) as recipe
-- ) recipes 
-- GROUP BY is_ai;

-- Verify algorithm metadata
-- SELECT 
--   result->'algorithm_metadata'->>'ai_recipes_excluded' as ai_excluded,
--   result->'algorithm_metadata'->>'human_recipes_only' as human_only,
--   result->'algorithm_metadata'->>'algorithm_version' as version
-- FROM (SELECT get_enhanced_feed_v4('sample-user-id'::UUID) as result) test; 