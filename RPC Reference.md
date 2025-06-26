

Kitch AI RPC Reference

Legend

Column	Meaning
Function	Exact SQL function / trigger name
Args	Parameter list (order preserved)
Returns	Declared return type
Notes	Quick purpose / grouping hint (edit as you wish)


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
delete_recipe_comment	p_comment_id uuid, p_user_id uuid	void	Remove user’s comment
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

These C-extension functions come from Postgres extensions; they’re listed here for completeness but usually don’t need docs.

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

(They’re installed via CREATE EXTENSION pg_trgm, fuzzystrmatch;)

⸻

Triggers

Trigger Function	Fires On	Purpose
update_comments_count	recipe_comments INSERT/DELETE	Maintain recipes.comments counter
update_grocery_timestamp	stock INSERT/UPDATE	Auto-update updated_at
update_updated_at_timestamp	various tables	Generic updated_at helper


⸻
