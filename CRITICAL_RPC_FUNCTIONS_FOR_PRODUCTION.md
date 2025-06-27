# Critical RPC Functions for KitchAI v2 Production

**Date**: January 26, 2025  
**Priority**: LAUNCH BLOCKER - These functions are required for basic app functionality

## 🚨 Critical RPC Functions (Must Implement)

### 1. User Management (Launch Blockers)
```sql
-- Profile creation/update during onboarding
CREATE OR REPLACE FUNCTION get_profile_details(p_user_id UUID)
RETURNS jsonb AS $$
-- Implementation needed for user authentication flow
$$;

CREATE OR REPLACE FUNCTION update_profile(
  p_user_id UUID,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL, 
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_onboarded BOOLEAN DEFAULT NULL,
  p_diet_tags TEXT[] DEFAULT NULL
)
RETURNS void AS $$
-- Implementation needed for onboarding flow
$$;
```

### 2. Feed Algorithm (Core Feature)
```sql
-- Main feed algorithm - core app functionality
CREATE OR REPLACE FUNCTION get_enhanced_feed_v4(
  user_id_param UUID,
  session_context jsonb DEFAULT '{}',
  feed_position INTEGER DEFAULT 0,
  time_context TEXT DEFAULT 'general',
  limit_param INTEGER DEFAULT 50
)
RETURNS jsonb AS $$
-- Implementation needed for main feed screen
$$;

-- Recipe details with user interaction status
CREATE OR REPLACE FUNCTION get_recipe_details(
  p_recipe_id UUID,
  p_user_id UUID
)
RETURNS json AS $$
-- Implementation needed for recipe detail view
$$;
```

### 3. Social Interactions (Core Features)
```sql
-- Like/unlike functionality
CREATE OR REPLACE FUNCTION toggle_recipe_like(
  user_id_param UUID,
  recipe_id_param UUID
)
RETURNS json AS $$
-- Implementation needed for like button
$$;

-- Save/unsave recipes
CREATE OR REPLACE FUNCTION save_recipe_video(
  user_id_param UUID,
  recipe_id_param UUID
)
RETURNS jsonb AS $$
-- Implementation needed for save functionality
$$;

CREATE OR REPLACE FUNCTION unsave_recipe(
  user_id_param UUID,
  recipe_id_param UUID
)
RETURNS jsonb AS $$
-- Implementation needed for unsave functionality
$$;
```

### 4. Comments System
```sql
-- Get recipe comments
CREATE OR REPLACE FUNCTION get_recipe_comments(p_recipe_id UUID)
RETURNS jsonb AS $$
-- Implementation needed for comments tab
$$;
```

### 5. Pantry Management
```sql
-- Stock aging for smart notifications
CREATE OR REPLACE FUNCTION get_stock_aging(p_user_id UUID)
RETURNS TABLE() AS $$
-- Implementation needed for pantry aging features
$$;

-- Access control logging
CREATE OR REPLACE FUNCTION log_pantry_scan(
  p_user_id UUID,
  p_context TEXT
)
RETURNS void AS $$
-- Implementation needed for scan access control
$$;
```

### 6. Meal Planning
```sql
-- Get daily meal plan
CREATE OR REPLACE FUNCTION get_meal_plan_for_date(
  p_user_id UUID,
  p_plan_date TEXT
)
RETURNS TABLE() AS $$
-- Implementation needed for meal planner
$$;

-- Add recipe to meal slot
CREATE OR REPLACE FUNCTION add_recipe_to_meal_slot(
  p_user_id UUID,
  p_plan_date TEXT,
  p_slot TEXT,
  p_recipe_id UUID,
  p_recipe_title TEXT,
  p_recipe_thumbnail_url TEXT
)
RETURNS void AS $$
-- Implementation needed for meal planning
$$;

-- Remove recipe from meal slot
CREATE OR REPLACE FUNCTION remove_recipe_from_meal_slot(
  p_user_id UUID,
  p_plan_date TEXT,
  p_slot TEXT
)
RETURNS void AS $$
-- Implementation needed for meal planning
$$;
```

## 🔶 Important RPC Functions (Should Implement)

### Follow System
```sql
CREATE OR REPLACE FUNCTION follow_user(follower_id_param UUID, followed_id_param UUID) RETURNS json;
CREATE OR REPLACE FUNCTION unfollow_user(follower_id_param UUID, followed_id_param UUID) RETURNS json;
CREATE OR REPLACE FUNCTION get_follow_status(follower_id_param UUID, followed_id_param UUID) RETURNS json;
CREATE OR REPLACE FUNCTION get_user_followers(user_id_param UUID, limit_param INTEGER) RETURNS json;
CREATE OR REPLACE FUNCTION get_user_following(user_id_param UUID, limit_param INTEGER) RETURNS json;
```

### Recipe Management
```sql
CREATE OR REPLACE FUNCTION update_recipe_details(...) RETURNS void;
CREATE OR REPLACE FUNCTION delete_recipe(p_recipe_id UUID) RETURNS void;
```

### Activity Logging
```sql
CREATE OR REPLACE FUNCTION log_recipe_view(p_user_id UUID, p_recipe_id UUID, p_context TEXT) RETURNS void;
CREATE OR REPLACE FUNCTION get_user_activity_feed(p_user_id UUID, p_limit INTEGER) RETURNS TABLE();
```

## 🔷 Enhanced Features (Can Implement Later)

### AI Recipe Generation
```sql
CREATE OR REPLACE FUNCTION generate_recipe_suggestions(p_user_id UUID, p_selected_ingredients TEXT[], p_freemium_limit INTEGER) RETURNS jsonb;
CREATE OR REPLACE FUNCTION save_ai_generated_recipe(p_user_id UUID, p_recipe_data jsonb) RETURNS void;
```

### Pantry Matching
```sql
CREATE OR REPLACE FUNCTION match_pantry_ingredients(p_user_id UUID, p_recipe_id UUID) RETURNS jsonb;
```

---

## 🎯 Implementation Priority

1. **CRITICAL (Launch Blockers)**: Must implement for app to function
   - User management functions
   - Feed algorithm  
   - Social interactions
   - Comments system
   - Basic pantry features
   - Meal planning

2. **IMPORTANT**: Should implement for full features
   - Follow system
   - Recipe management
   - Activity logging

3. **ENHANCED**: Can implement in future updates
   - AI recipe generation
   - Advanced pantry matching

---

## 🚀 Backend Team Action Items

1. **Export current development schema** from `btpmaqffdmxhugvybgfn.supabase.co`
2. **Identify which RPC functions exist** in current development environment
3. **Document actual function signatures** and implementations
4. **Create migration scripts** for missing functions
5. **Test all critical functions** in production environment
6. **Provide production API keys** to development team

**Total Functions Needed**: ~25 RPC functions for full feature parity
