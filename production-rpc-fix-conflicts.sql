-- =====================================================
-- KITCHAI V2 - FIX FUNCTION CONFLICTS
-- Drop existing functions that have return type conflicts
-- Run this FIRST before running the other migration scripts
-- =====================================================

-- Drop conflicting functions that already exist with different return types
DROP FUNCTION IF EXISTS get_recipe_comments(uuid);
DROP FUNCTION IF EXISTS unsave_recipe(uuid,uuid);
DROP FUNCTION IF EXISTS save_ai_generated_recipe(uuid,jsonb);

-- Drop all other functions to ensure clean migration
DROP FUNCTION IF EXISTS get_profile_details(uuid);
DROP FUNCTION IF EXISTS update_profile(uuid, text, text, text, text, boolean, text[]);
DROP FUNCTION IF EXISTS get_enhanced_feed_v4(uuid, text, text, integer, integer);
DROP FUNCTION IF EXISTS get_recipe_details(uuid, uuid);
DROP FUNCTION IF EXISTS log_recipe_view(uuid, uuid);
DROP FUNCTION IF EXISTS toggle_recipe_like(uuid, uuid);
DROP FUNCTION IF EXISTS save_recipe_video(uuid, uuid);
DROP FUNCTION IF EXISTS follow_user(uuid, uuid);
DROP FUNCTION IF EXISTS unfollow_user(uuid, uuid);
DROP FUNCTION IF EXISTS get_follow_status(uuid, uuid);
DROP FUNCTION IF EXISTS get_user_followers(uuid, integer);
DROP FUNCTION IF EXISTS get_user_following(uuid, integer);
DROP FUNCTION IF EXISTS add_recipe_to_meal_slot(uuid, date, text, uuid, text, text);
DROP FUNCTION IF EXISTS get_meal_plan_for_date(uuid, date);
DROP FUNCTION IF EXISTS remove_recipe_from_meal_slot(uuid, date, text);
DROP FUNCTION IF EXISTS match_pantry_ingredients(uuid, uuid);
DROP FUNCTION IF EXISTS log_pantry_scan(uuid, text);
DROP FUNCTION IF EXISTS get_stock_aging(uuid);
DROP FUNCTION IF EXISTS generate_recipe_suggestions(uuid, text[], integer);
DROP FUNCTION IF EXISTS delete_recipe(uuid);
DROP FUNCTION IF EXISTS update_recipe_details(uuid, text, text, text, text, jsonb, text[], jsonb, integer, integer, integer, boolean);
DROP FUNCTION IF EXISTS get_user_activity_feed(uuid, integer, integer);

-- Also drop any variations with different parameter signatures
DROP FUNCTION IF EXISTS get_recipe_comments(uuid) CASCADE;
DROP FUNCTION IF EXISTS unsave_recipe(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS save_ai_generated_recipe(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS get_stock_aging() CASCADE;
DROP FUNCTION IF EXISTS match_pantry_ingredients(uuid, uuid, text[]) CASCADE;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '🧹 CLEANUP COMPLETE: All existing RPC functions dropped to prevent conflicts';
  RAISE NOTICE '▶️  Now run the migration scripts in order: Part 1 → Part 2 → Part 3 → Part 4 → Missing Functions';
END $$; 