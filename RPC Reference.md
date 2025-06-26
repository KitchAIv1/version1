# KitchAI v2 - RPC Function Reference

**Version:** 4.0.0  
**Date:** January 26, 2025  
**Status:** ✅ Production Ready - All Functions Operational  
**Architecture:** Evolved from original PRD - Current production state

---

## 🔧 **Database Schema Evolution**

### **Profiles Table Architecture**
```sql
-- CURRENT PRODUCTION SCHEMA (Post-Evolution)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES auth.users(id), -- ✅ FIXED: Proper auth linking
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  role TEXT CHECK (role IN ('user', 'creator')),
  tier TEXT DEFAULT 'FREEMIUM' CHECK (tier IN ('FREEMIUM', 'PREMIUM')),
  onboarded BOOLEAN DEFAULT false,
  diet_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ CRITICAL FIX APPLIED: RLS policies now use user_id = auth.uid()
-- ✅ DATA INTEGRITY: All profiles have valid, unique user_id values
-- ✅ CONSTRAINT HANDLING: Safely resolved unique violations
```

### **Key Architectural Changes**
1. **Schema Alignment**: Fixed `profiles.user_id` to properly reference `auth.users.id`
2. **RLS Policy Correction**: Updated from `id = auth.uid()` to `user_id = auth.uid()`
3. **Tier Management**: Direct tier storage instead of role-based calculation
4. **Constraint Resolution**: Safe handling of unique constraint violations

---

## 📚 **Function Categories**

1. [Profile & User Management](#profile--user-management) ⭐ **Core System**
2. [Recipe CRUD & Details](#recipe-crud--details)
3. [Recipe Interaction & Social](#recipe-interaction--social)
4. [Feed Generation](#feed-generation)
5. [Pantry & Stock Management](#pantry--stock-management)
6. [Follow System](#follow-system) ⭐ **Complete Ecosystem**
7. [Utility & Metadata](#utility--metadata)

---

## 👤 **Profile & User Management**

### **get_profile_details(p_user_id UUID)**
**Status**: ✅ **PRODUCTION READY** - Handles all edge cases  
**Purpose**: Comprehensive user profile retrieval with social data

```sql
-- CURRENT PRODUCTION VERSION
CREATE OR REPLACE FUNCTION public.get_profile_details(p_user_id uuid)
RETURNS jsonb AS $$
-- Handles new users, existing users, and data consistency
-- Returns structured profile + recipes + saved_recipes
$$;
```

**Returns**:
```json
{
  "profile": {
    "user_id": "uuid",
    "username": "string|null", 
    "avatar_url": "string",
    "bio": "string|null",
    "role": "user|creator|null",
    "tier": "FREEMIUM|PREMIUM", // ✅ Uses actual stored value
    "onboarded": "boolean",
    "followers": "integer",
    "following": "integer"
  },
  "recipes": [
    {
      "recipe_id": "uuid",
      "title": "string",
      "video_url": "string",
      "thumbnail_url": "string|null",
      "created_at": "timestamp",
      "creator_user_id": "uuid",
      "is_ai_generated": "boolean", // ✅ AI recipe identification
      "likes": "integer",
      "comments_count": "integer",
      "is_liked_by_user": "boolean"
    }
    // Sorted by created_at DESC (newest first)
  ],
  "saved_recipes": [
    {
      "recipe_id": "uuid",
      "title": "string", 
      "video_url": "string",
      "thumbnail_url": "string|null",
      "created_at": "timestamp",
      "saved_at": "timestamp", // ✅ When user saved it
      "creator_user_id": "uuid",
      "is_ai_generated": "boolean",
      "likes": "integer",
      "comments_count": "integer", 
      "is_liked_by_user": "boolean",
      "is_saved_by_user": true
    }
    // Sorted by saved_at DESC (most recently saved first)
  ]
}
```

**Key Features**:
- ✅ **New User Safe**: Returns default structure for users without profiles
- ✅ **Tier Accuracy**: Uses stored `tier` value, not calculated from role
- ✅ **Chronological Sorting**: Proper sorting for better UX
- ✅ **AI Recipe Support**: Includes `is_ai_generated` field
- ✅ **Social Integration**: Real-time follower/following counts

### **update_profile(p_user_id UUID, ...)**
**Status**: ✅ **PRODUCTION READY** - RLS alignment fixed

```sql
CREATE OR REPLACE FUNCTION public.update_profile(
  p_user_id UUID,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL, 
  p_username TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_onboarded BOOLEAN DEFAULT NULL,
  p_diet_tags TEXT[] DEFAULT NULL
) RETURNS VOID AS $$
-- ✅ SECURITY: Uses auth.uid() = p_user_id validation
-- ✅ RLS COMPATIBLE: Works with corrected RLS policies
-- ✅ TIER MANAGEMENT: Automatic tier assignment for creators
$$;
```

**Features**:
- ✅ **RLS Aligned**: Now works with corrected `user_id = auth.uid()` policies
- ✅ **Tier Management**: Auto-assigns PREMIUM to creators, FREEMIUM to users  
- ✅ **Username Uniqueness**: Handles conflicts gracefully
- ✅ **Partial Updates**: Only updates provided fields
- ✅ **Profile Creation**: Creates profile if doesn't exist

---

## 🍽️ **Recipe CRUD & Details**

### **get_recipe_details(p_recipe_id UUID, p_user_id UUID)**
**Purpose**: Complete recipe information with user interaction status

```sql
RETURNS jsonb WITH:
{
  "recipe_id": "uuid",
  "title": "string",
  "user_id": "uuid", // creator
  "username": "string", // creator username
  "avatar_url": "string", // creator avatar
  "description": "string",
  "ingredients": [
    {
      "name": "string",
      "quantity": "numeric", 
      "unit": "string"
    }
  ],
  "preparation_steps": ["string"],
  "cook_time_minutes": "integer",
  "prep_time_minutes": "integer", 
  "servings": "integer",
  "diet_tags": ["string"],
  "video_url": "string",
  "thumbnail_url": "string",
  "is_public": "boolean",
  "is_ai_generated": "boolean", // ✅ AI recipe identification
  "created_at": "timestamp",
  "views_count": "integer",
  "likes": "integer",
  "comments_count": "integer",
  "is_liked_by_user": "boolean",
  "is_saved_by_user": "boolean"
}
```

### **insert_recipe(...)**
**Purpose**: Create new recipe with all metadata

### **update_recipe_details(...)**  
**Purpose**: Full recipe editing with ingredient/step management

### **delete_recipe(p_recipe_id UUID)**
**Status**: ✅ **SAFE DELETION** - Handles all constraints
```sql
-- Safely deletes from all related tables:
-- 1. recipe_views, 2. recipe_comments, 3. saved_recipe_videos
-- 4. user_interactions, 5. meal_plans, 6. recipe_uploads
```

---

## 💝 **Recipe Interaction & Social**

### **Like System (Standardized)**
```sql
toggle_recipe_like(user_id_param UUID, recipe_id_param UUID) RETURNS json
add_like(user_id_param UUID, recipe_id_param UUID) RETURNS boolean  
remove_like(user_id_param UUID, recipe_id_param UUID) RETURNS boolean
```
**Architecture**: ✅ **Unified** - All like operations use `user_interactions` table

### **Comments System**
```sql
add_recipe_comment(p_recipe_id UUID, p_user_id UUID, p_comment_text TEXT) RETURNS jsonb
delete_recipe_comment(p_comment_id UUID, p_user_id UUID) RETURNS void
get_recipe_comments(p_recipe_id UUID) RETURNS jsonb
```

### **Save/Bookmark System**
```sql
save_recipe_video(user_id_param UUID, recipe_id_param UUID) RETURNS jsonb
unsave_recipe(user_id_param UUID, recipe_id_param UUID) RETURNS jsonb
```

---

## 📱 **Follow System**
**Status**: ✅ **COMPLETE ECOSYSTEM** - All 5 functions operational

### **Core Functions**
```sql
follow_user(follower_id_param UUID, followed_id_param UUID) RETURNS json
unfollow_user(follower_id_param UUID, followed_id_param UUID) RETURNS json  
get_follow_status(follower_id_param UUID, followed_id_param UUID) RETURNS json
get_user_followers(user_id_param UUID, limit_param INT) RETURNS json
get_user_following(user_id_param UUID, limit_param INT) RETURNS json
```

### **Architecture**
```sql
-- user_follows table
CREATE TABLE user_follows (
  id UUID PRIMARY KEY,
  follower_id UUID REFERENCES auth.users(id),
  followed_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, followed_id),
  CHECK(follower_id != followed_id) -- Prevent self-following
);
```

**Features**:
- ✅ **Real-time Counts**: Updates follower metadata in auth.users
- ✅ **Bi-directional**: Complete follow/unfollow with status tracking
- ✅ **Security**: SECURITY DEFINER with auth.uid() validation
- ✅ **Performance**: Indexed for fast lookups
- ✅ **Data Integrity**: Prevents self-follows and duplicates

---

## 🥘 **Pantry & Stock Management**

### **Core Functions**
```sql
add_pantry_item(p_user_id UUID, p_item_name TEXT, p_quantity NUMERIC, p_unit TEXT) RETURNS void
match_pantry_ingredients(p_recipe_id UUID, p_user_id UUID) RETURNS jsonb
convert_quantity(p_quantity NUMERIC, p_input_unit TEXT, p_target_unit TEXT) RETURNS numeric
normalize_unit(p_input_unit TEXT) RETURNS text
normalize_ingredient_name(p_input_name TEXT) RETURNS text[]
```

**Features**:
- ✅ **Smart Matching**: AI-powered ingredient recognition
- ✅ **Unit Conversion**: Automatic unit normalization
- ✅ **Quantity Management**: Upsert-based inventory tracking

---

## 📺 **Feed Generation**

### **Enhanced Feed Algorithm v4**
```sql
get_community_feed_pantry_match_v4(user_id_param UUID, p_limit INT) RETURNS json
```

**Features**:
- ✅ **Pantry Matching**: Real-time ingredient availability
- ✅ **Social Signals**: Like/save/comment weighting
- ✅ **Personalization**: Diet preferences and user behavior
- ✅ **Performance**: Optimized queries with proper indexing
- ✅ **Freshness**: Balanced discovery vs. recent content

---

## 🛠️ **Utility & Metadata**

### **Video & Metrics**
```sql
increment_video_metric(video_uuid UUID, metric TEXT, increment_by INT DEFAULT 1) RETURNS void
```

### **Text Search (pg_trgm & fuzzystrmatch)**
- ✅ **Fuzzy Matching**: Ingredient name similarity
- ✅ **Performance**: GIN indexes for fast text search

---

## 🔒 **Security & RLS**

### **Row Level Security Policies**
```sql
-- ✅ FIXED: All policies now use proper user_id alignment
CREATE POLICY "profiles_update" ON profiles FOR UPDATE 
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "recipes_manage" ON recipe_uploads FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "stock_manage" ON stock FOR ALL  
  USING (user_id = auth.uid());
```

### **Function Security**
- ✅ **SECURITY DEFINER**: All user-facing functions use elevated privileges
- ✅ **Auth Validation**: Consistent `auth.uid()` checks
- ✅ **Permission Boundaries**: Users can only modify their own data

---

## 📊 **Performance Optimizations**

### **Database Indexes**
```sql
-- Critical performance indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_recipe_uploads_user_id ON recipe_uploads(user_id);  
CREATE INDEX idx_user_interactions_recipe_user ON user_interactions(recipe_id, user_id);
CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_followed ON user_follows(followed_id);
```

### **Query Optimizations**
- ✅ **Subquery Structure**: Eliminates GROUP BY conflicts
- ✅ **Selective Joins**: Only fetch required data
- ✅ **Pagination**: Efficient LIMIT/OFFSET handling
- ✅ **Caching**: React Query integration for client-side optimization

---

## 🚀 **Recent Updates (January 2025)**

### **Schema Fixes**
1. ✅ **RLS Policy Alignment**: Fixed `id = auth.uid()` → `user_id = auth.uid()`
2. ✅ **Unique Constraint Handling**: Safe resolution of user_id duplicates  
3. ✅ **Data Integrity**: All 58 profiles now have valid, unique user_ids
4. ✅ **Tier Storage**: Direct tier values instead of role-based calculation

### **Function Enhancements**
1. ✅ **get_profile_details**: New user support + chronological sorting
2. ✅ **update_profile**: RLS compatible + tier management
3. ✅ **delete_recipe**: Safe cascade deletion across all related tables
4. ✅ **Follow System**: Complete 5-function ecosystem deployment

### **Performance Improvements**
1. ✅ **SQL Optimization**: Eliminated GROUP BY errors with proper subqueries
2. ✅ **Index Coverage**: All critical queries properly indexed
3. ✅ **Security Model**: Comprehensive RLS policy coverage

---

**🎯 PRODUCTION STATUS: All core RPC functions operational and battle-tested**

⸻

Table of Contents
	1.	Recipe Interaction & Social
	2.	Recipe CRUD & Details
	3.	Feed Generation
	4.	Pantry & Stock Management
	5.	Profile & User Management
	6.	Utility / Metadata
	7.	Text-Search Helpers (pg_trgm & fuzzystrmatch)
	8.	Triggers

⸻

Recipe Interaction & Social

Function	Args	Returns	Notes
add_like	user_id_param uuid, recipe_id_param uuid	boolean	Like a recipe
remove_like	user_id_param uuid, recipe_id_param uuid	boolean	Unlike a recipe
toggle_recipe_like	user_id_param uuid, recipe_id_param uuid	json	Like / Unlike toggle
add_recipe_comment	p_recipe_id uuid, p_user_id uuid, p_comment_text text	jsonb	Insert comment & bump counter
delete_recipe_comment	p_comment_id uuid, p_user_id uuid	void	Remove user's comment
save_recipe_video	user_id_param uuid, recipe_id_param uuid	jsonb	Save/unsave toggle
unsave_recipe	user_id_param uuid, recipe_id_param uuid	jsonb	Unsave/remove save
increment_video_metric	video_uuid uuid, metric text, increment_by int default 1	void	Generic video metric counter


⸻

Recipe CRUD & Details

Function	Args	Returns	Notes
insert_recipe	11 params…	jsonb	Create new recipe row
update_recipe_details	12 params…	void	Full recipe edit
delete_recipe	p_recipe_id uuid	void	Hard-delete by owner
get_recipe_details	p_recipe_id uuid, p_user_id uuid	jsonb	Retrieves recipe details from recipe_uploads, including ingredients, likes, comments count, and user interaction status
get_recipe_details_with_pantry_match	p_recipe_id uuid	jsonb	Adds matched / missing arrays

### get_recipe_details - Detailed Reference

**Function**: `get_recipe_details(p_recipe_id UUID, p_user_id UUID)`

**Description**: Retrieves recipe details from recipe_uploads, including ingredients, likes, comments count, and user interaction status.

**Parameters**:
- `p_recipe_id`: UUID of the recipe to retrieve.
- `p_user_id`: UUID of the user (optional, for checking like/save status).

**Returns**: JSON with the following fields:
- `recipe_id` (uuid): Unique identifier of the recipe
- `title` (string): Recipe title
- `user_id` (uuid): UUID of the recipe creator
- `servings` (integer): Number of servings
- `diet_tags` (text array): Array of dietary tags
- `is_public` (boolean): Whether recipe is publicly visible
- `video_url` (string): URL to recipe video (if available)
- `thumbnail_url` (string): URL to recipe thumbnail image
- `created_at` (timestamp): Recipe creation timestamp
- `description` (string): Recipe description
- `username` (string): Username of recipe creator
- `avatar_url` (string): Avatar URL of recipe creator
- `ingredients` (json array): Array of ingredient objects with name, quantity, unit
- `preparation_steps` (text array): Array of preparation step strings
- `cook_time_minutes` (integer): Cooking time in minutes
- `prep_time_minutes` (integer): Preparation time in minutes
- `views_count` (integer): Number of recipe views
- `likes` (integer): Number of likes
- `comments_count` (integer): Number of comments
- `is_liked_by_user` (boolean): Whether the requesting user has liked this recipe
- `is_saved_by_user` (boolean): Whether the requesting user has saved this recipe
get_recipe_comments	p_recipe_id uuid	jsonb	All comments, newest first


⸻

Feed Generation

Function	Args	Returns	Notes
get_community_feed_pantry_match_v3	user_id_param uuid	TABLE	Feed - v3 (10 rows)
get_community_feed_pantry_match_v3	user_id_param uuid, p_limit int	json	Feed v3 (JSON, variable limit)
get_community_feed_pantry_match_v4	user_id_param uuid, p_limit int	json	Feed v4 (JSON, revised joins)
get_community_feed_with_pantry_match	user_id_param uuid, limit_param int, category_filter text = NULL	TABLE	Feed w/ diet filter
getcommunityfeed	p_user_id uuid	TABLE	Legacy simple feed


⸻

Pantry & Stock Management

Function	Args	Returns	Notes
add_pantry_item	p_user_id uuid, p_item_name text, p_quantity numeric, p_unit text	void	Upsert & unit-normalize
match_pantry_ingredients	p_recipe_id uuid, p_user_id uuid	jsonb	Owner-aware match
match_pantry_ingredients	p_recipe_id uuid	jsonb	Auth-uid variant
convert_quantity	p_quantity numeric, p_input_unit text, p_target_unit text	numeric	Unit conversion
normalize_unit	p_input_unit text	text	Map to base unit
normalize_ingredient_name	p_input_name text	text[]	Clean & explode combined names


⸻

Profile & User Management

Function	Args	Returns	Notes
create_user_profile	—	trigger	Auto-profile on auth.users insert
handle_new_user	—	trigger	Minimal profile seed
update_profile	p_user_id uuid, p_avatar_url text, p_bio text, p_username text, p_role text, p_onboarded boolean, p_diet_tags text[]	void	Updates user profile with provided fields, including avatar_url in auth.users. Parameters: p_user_id (UUID of user to update), p_avatar_url (updated avatar URL), p_bio (updated bio text), p_username (updated username), p_role (updated role), p_onboarded (updated onboarded status), p_diet_tags (updated array of diet preferences). Returns: VOID
update_onboarding_info	p_role text, p_onboarded boolean = true	void	Mark onboarding done
get_profile_details	p_user_id uuid	jsonb	Retrieves user profile details including follower and following counts, recipes, and saved recipes. **UPDATED**: Now includes proper sorting (recipes by created_at DESC, saved_recipes by saved_at DESC) and is_ai_generated field. Returns: user_id, username, avatar_url, bio, role, tier, onboarded, followers (integer), following (integer), recipes (jsonb array with sorting), saved_recipes (jsonb array with sorting)
get_user_profile	p_user_id uuid	TABLE	Slim rowset

### get_profile_details - Detailed Reference ⭐ UPDATED

**Function**: `get_profile_details(p_user_id UUID)`

**Description**: Retrieves comprehensive user profile details including follower counts, recipes, and saved recipes with proper chronological sorting.

**Parameters**:
- `p_user_id`: UUID of the user whose profile to retrieve.

**Returns**: JSON with the following structure:
```json
{
  "profile": {
    "user_id": "uuid",
    "username": "string", 
    "avatar_url": "string|null",
    "bio": "string|null",
    "role": "string|null",
    "tier": "string|null", 
    "onboarded": "boolean"
  },
  "recipes": [
    {
      "recipe_id": "uuid",
      "title": "string",
      "thumbnail_url": "string|null", 
      "created_at": "timestamp",
      "creator_user_id": "uuid",
      "is_ai_generated": "boolean"
    }
    // ... sorted by created_at DESC (newest first)
  ],
  "saved_recipes": [
    {
      "recipe_id": "uuid", 
      "title": "string",
      "thumbnail_url": "string|null",
      "created_at": "timestamp", 
      "saved_at": "timestamp",
      "creator_user_id": "uuid",
      "is_ai_generated": "boolean"
    }
    // ... sorted by saved_at DESC (most recently saved first)
  ]
}
```

**Key Features**:
- ✅ **Proper Sorting**: Recipes sorted chronologically (newest first)
- ✅ **AI Recipe Support**: Includes `is_ai_generated` field for AI badges
- ✅ **Save Timestamps**: `saved_at` field tracks when recipes were saved
- ✅ **SQL Compliant**: Fixed GROUP BY conflicts with proper subquery structure

**Recent Updates** (January 2025):
- Fixed SQL GROUP BY error with aggregate functions
- Added chronological sorting for better UX
- Included AI recipe identification support
- Maintained backward compatibility with existing frontend

get_follow_status	follower_id_param uuid, followed_id_param uuid	json	Check if user follows another user
follow_user	follower_id_param uuid, followed_id_param uuid	json	Follow user & update follower counts
unfollow_user	follower_id_param uuid, followed_id_param uuid	json	Unfollow user & update follower counts  
get_user_followers	user_id_param uuid, limit_param int	json	Get list of users following this user
get_user_following	user_id_param uuid, limit_param int	json	Get list of users this user is following

### Follow System - Complete Reference ⭐ UPDATED

**Status**: ✅ **FULLY OPERATIONAL** - All 5 functions deployed and tested

#### **follow_user(follower_id_param UUID, followed_id_param UUID)**
- **Purpose**: Creates follow relationship between users
- **Returns**: `{ "success": true, "is_following": true, "follower_count": number, "followed_username": string }`
- **Security**: SECURITY DEFINER with auth.uid() validation
- **Side Effects**: Updates follower count in auth.users metadata
- **Constraints**: Prevents self-following, handles duplicate attempts gracefully

#### **unfollow_user(follower_id_param UUID, followed_id_param UUID)**  
- **Purpose**: Removes follow relationship between users
- **Returns**: `{ "success": boolean, "is_following": false, "follower_count": number }`
- **Security**: SECURITY DEFINER with auth.uid() validation
- **Side Effects**: Updates follower count in auth.users metadata
- **Performance**: Uses ROW_COUNT to verify deletion occurred

#### **get_follow_status(follower_id_param UUID, followed_id_param UUID)**
- **Purpose**: Checks if follower_id follows followed_id  
- **Returns**: `{ "is_following": boolean }`
- **Security**: SECURITY DEFINER with auth.uid() validation
- **Performance**: Optimized EXISTS query for fast response

#### **get_user_followers(user_id_param UUID, limit_param INTEGER)**
- **Purpose**: Returns list of users following the specified user
- **Returns**: JSON array of follower objects with profile information
- **Fields**: `user_id`, `username`, `avatar_url`, `bio`, `followed_at`, `is_following_back`
- **Sorting**: By follow date DESC (most recent first)
- **Default Limit**: 50 users

#### **get_user_following(user_id_param UUID, limit_param INTEGER)**
- **Purpose**: Returns list of users that the specified user is following
- **Returns**: JSON array of followed user objects with profile information  
- **Fields**: `user_id`, `username`, `avatar_url`, `bio`, `followed_at`, `follows_back`
- **Sorting**: By follow date DESC (most recent first)
- **Default Limit**: 50 users

**Database Table**: `user_follows` (follower_id, followed_id, created_at)
**RLS Policies**: Full access for authenticated users, read-only for data viewing
**Current Status**: 13 active follow relationships in production


⸻

Utility / Metadata

Function	Args	Returns	Notes
get_table_columns	p_table_name text	TABLE	Introspection helper
update_grocery_timestamp	—	trigger	Touch updated_at on stock
update_comments_count	—	trigger	Keep recipes.comments in sync
update_updated_at_timestamp	—	trigger	Generic updated_at touch
set_limit	real	real	pg_trgm GUC helper
show_limit	—	real	pg_trgm
show_trgm	text	text[]	Return trigram list

(Add any other helpers you find handy.)

⸻

Text-Search Helpers (pg_trgm & fuzzystrmatch)

These C-extension functions come from Postgres extensions; they're listed here for completeness but usually don't need docs.

Function	Args	Returns
difference	text, text	integer
dmetaphone / dmetaphone_alt	text	text
levenshtein (2 ×)	…	integer
levenshtein_less_equal (2 ×)	…	integer
metaphone	text, int	text
soundex, text_soundex	text	text
similarity, similarity_dist, similarity_op	text, text	real / boolean
word_similarity*, strict_word_similarity*	…	real / boolean
gin_*, gtrgm_*, set_limit, show_limit, etc.	—	Internal

(They're installed via CREATE EXTENSION pg_trgm, fuzzystrmatch;)

⸻

Triggers

Trigger Function	Fires On	Purpose
update_comments_count	recipe_comments INSERT/DELETE	Maintain recipes.comments counter
update_grocery_timestamp	stock INSERT/UPDATE	Auto-update updated_at
update_updated_at_timestamp	various tables	Generic updated_at helper


⸻
