-- ============================================================
-- KITCHAI ENHANCED FEED ALGORITHM V4 (FIXED VERSION)
-- TikTok-inspired personalized feed with NO AI-generated recipes
-- SAFE IMPLEMENTATION: New RPC alongside existing v3
-- SIMPLIFIED STRUCTURE TO AVOID SQL SYNTAX ERRORS
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
  personalized_weight NUMERIC;
  trending_weight NUMERIC;
  discovery_weight NUMERIC;
BEGIN
  -- Get current hour for time-based optimization
  current_hour := EXTRACT(HOUR FROM NOW());
  
  -- Build simplified user behavior profile
  SELECT jsonb_build_object(
    'like_rate', COALESCE(AVG(CASE WHEN ui.interaction_type = 'like' THEN 1 ELSE 0 END), 0.1),
    'save_rate', COALESCE(AVG(CASE WHEN ui.interaction_type = 'save' THEN 1 ELSE 0 END), 0.05),
    'comment_frequency', COALESCE(COUNT(CASE WHEN ui.interaction_type = 'comment' THEN 1 END), 0),
    'following_count', COALESCE((SELECT COUNT(*) FROM user_follows WHERE follower_id = user_id_param), 0),
    'engagement_score', LEAST(
      COALESCE(AVG(CASE WHEN ui.interaction_type = 'like' THEN 1 ELSE 0 END) + 
               AVG(CASE WHEN ui.interaction_type = 'save' THEN 1 ELSE 0 END) * 3, 0), 10)
  ) INTO user_behavior_profile
  FROM user_interactions ui
  WHERE ui.user_id = user_id_param
    AND ui.created_at >= NOW() - INTERVAL '90 days';

  -- Dynamic weights based on time and user behavior
  CASE 
    WHEN time_context = 'morning' THEN 
      personalized_weight := 0.8; trending_weight := 0.1; discovery_weight := 0.1;
    WHEN time_context = 'lunch' THEN 
      personalized_weight := 0.6; trending_weight := 0.3; discovery_weight := 0.1;
    WHEN time_context = 'dinner' THEN 
      personalized_weight := 0.7; trending_weight := 0.2; discovery_weight := 0.1;
    WHEN (user_behavior_profile->>'engagement_score')::NUMERIC > 5 THEN 
      personalized_weight := 0.5; trending_weight := 0.3; discovery_weight := 0.2;
    ELSE 
      personalized_weight := 0.65; trending_weight := 0.25; discovery_weight := 0.1;
  END CASE;

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
        
        -- Basic engagement metrics
        COALESCE(r.views_count, 0)::BIGINT AS views_count,
        COALESCE((SELECT COUNT(*) FROM user_interactions WHERE recipe_id = r.id AND interaction_type = 'like'), 0) AS likes_count,
        COALESCE((SELECT COUNT(*) FROM saved_recipe_videos WHERE recipe_id = r.id), 0) AS saves_count,
        COALESCE((SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id), 0) AS comments_count,
        
        -- User-specific interactions
        EXISTS(SELECT 1 FROM user_interactions ui WHERE ui.user_id = user_id_param AND ui.recipe_id = r.id AND ui.interaction_type = 'like') AS is_liked,
        EXISTS(SELECT 1 FROM saved_recipe_videos srv WHERE srv.user_id = user_id_param AND srv.recipe_id = r.id) AS is_saved,
        EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = user_id_param AND uf.followed_id = r.user_id) AS following_creator,
        
        -- Time relevance
        EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 AS hours_since_creation
        
      FROM recipe_uploads r
      LEFT JOIN auth.users u ON r.user_id = u.id
      LEFT JOIN profiles p ON r.user_id = p.user_id
      WHERE r.is_public = true
        AND r.is_ai_generated = false  -- ❌ CRITICAL: NO AI RECIPES IN FEED
        AND r.created_at >= NOW() - INTERVAL '90 days'
    ),
    
    ScoredRecipes AS (
      SELECT 
        rd.*,
        
        -- ENGAGEMENT VELOCITY SCORE
        CASE 
          WHEN rd.hours_since_creation <= 24 THEN 
            (rd.likes_count * 10 + rd.saves_count * 30 + rd.comments_count * 50) / GREATEST(rd.hours_since_creation, 1)
          WHEN rd.hours_since_creation <= 168 THEN 
            (rd.likes_count * 5 + rd.saves_count * 15 + rd.comments_count * 25) / GREATEST(rd.hours_since_creation / 24, 1)
          ELSE
            (rd.likes_count + rd.saves_count * 3 + rd.comments_count * 5) / GREATEST(rd.hours_since_creation / 168, 1)
        END AS engagement_velocity,
        
        -- PERSONALIZATION SCORE
        (
          CASE WHEN rd.following_creator THEN 50 ELSE 0 END +
          CASE WHEN rd.video_url IS NOT NULL THEN 30 ELSE 0 END +
          CASE WHEN jsonb_array_length(rd.ingredients) >= 4 THEN 20 ELSE 10 END
        ) AS personalization_score,
        
        -- FRESHNESS SCORE
        CASE
          WHEN rd.hours_since_creation <= 24 THEN 100
          WHEN rd.hours_since_creation <= 168 THEN 100 - (rd.hours_since_creation - 24) * 0.4
          ELSE GREATEST(30, 100 - (rd.hours_since_creation - 168) * 0.08)
        END AS freshness_score,
        
        -- QUALITY SCORE (Optimized for human recipes)
        (
          CASE 
            WHEN rd.description IS NOT NULL AND LENGTH(rd.description) > 100 THEN 25
            WHEN rd.description IS NOT NULL AND LENGTH(rd.description) > 50 THEN 20
            WHEN rd.description IS NOT NULL THEN 10
            ELSE 0
          END +
          CASE WHEN rd.video_url IS NOT NULL AND LENGTH(rd.video_url) > 0 THEN 35 ELSE 0 END +
          25 + -- Human authenticity boost
          CASE 
            WHEN jsonb_array_length(rd.ingredients) >= 6 THEN 15
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
        -- COMBINED ALGORITHM SCORE
        (
          sr.engagement_velocity * 0.4 +
          sr.personalization_score * 0.35 +
          sr.freshness_score * 0.15 +
          sr.quality_score * 0.1
        ) AS algorithm_score,
        
        -- Feed type classification
        CASE 
          WHEN sr.personalization_score > 60 THEN 'personalized'
          WHEN sr.engagement_velocity > 50 AND sr.hours_since_creation <= 48 THEN 'trending'
          WHEN sr.following_creator THEN 'following'
          ELSE 'discovery'
        END AS feed_type
        
      FROM ScoredRecipes sr
    ),
    
    -- SIMPLIFIED APPROACH: Single query with weighted random selection
    FinalFeed AS (
      SELECT 
        fsr.*,
        ROW_NUMBER() OVER (
          ORDER BY 
            -- Weight by feed type and algorithm score
            CASE fsr.feed_type
              WHEN 'personalized' THEN fsr.algorithm_score * personalized_weight * 100
              WHEN 'trending' THEN fsr.algorithm_score * trending_weight * 100  
              WHEN 'following' THEN fsr.algorithm_score * 0.2 * 100 -- Always include following
              ELSE fsr.algorithm_score * discovery_weight * 100
            END +
            RANDOM() * 10 DESC -- Add randomness for discovery
        ) as final_position
      FROM FinalScoredRecipes fsr
      ORDER BY final_position
      LIMIT limit_param
      OFFSET feed_position
    )
    
    SELECT jsonb_build_object(
      'recipes', jsonb_agg(
        jsonb_build_object(
          'output_id', ff.id,
          'output_user_id', ff.user_id,
          'output_name', ff.name,
          'output_description', ff.description,
          'output_video_url', ff.video_url,
          'output_comments', ff.comments,
          'output_created_at', ff.created_at,
          'output_dietary_category_ids', ff.diet_tags,
          'user_name', ff.user_name,
          'output_is_liked', ff.is_liked,
          'output_is_saved', ff.is_saved,
          'pantry_match', jsonb_build_object('match_percentage', 0), -- Simplified for now
          'output_feed_type', ff.feed_type,
          'output_comments_count', ff.comments_count,
          'output_likes_count', ff.likes_count,
          'output_saves_count', ff.saves_count,
          'out_creator_avatar_url', ff.creator_avatar_url,
          'output_views_count', ff.views_count,
          'is_ai_generated', false, -- Always false since we exclude AI recipes
          'following_creator', ff.following_creator,
          'algorithm_score', ROUND(ff.algorithm_score, 2),
          'engagement_velocity', ROUND(ff.engagement_velocity, 2)
        )
        ORDER BY ff.final_position
      ),
      'algorithm_metadata', jsonb_build_object(
        'user_behavior_profile', user_behavior_profile,
        'weights', jsonb_build_object(
          'personalized', personalized_weight,
          'trending', trending_weight,
          'discovery', discovery_weight
        ),
        'ai_recipes_excluded', true,
        'human_recipes_only', true,
        'time_context', time_context,
        'current_hour', current_hour,
        'session_context', session_context,
        'algorithm_version', 'enhanced_v4_human_only_simplified'
      )
    ) AS result
    FROM FinalFeed ff
  );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_enhanced_feed_v4(UUID, JSONB, INTEGER, TEXT, INTEGER) TO authenticated;

-- Documentation
COMMENT ON FUNCTION public.get_enhanced_feed_v4(UUID, JSONB, INTEGER, TEXT, INTEGER) IS 
'FIXED: Enhanced feed algorithm - HUMAN RECIPES ONLY
✅ NO AI-generated recipes included  
✅ Simplified SQL structure to avoid syntax errors
✅ TikTok-style engagement velocity tracking
✅ User behavior profiling and adaptation
✅ Safe parallel implementation alongside existing v3';
