

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
get_recipe_details	p_recipe_id uuid, p_user_id uuid	jsonb	Core details (w/ save flag)
get_recipe_details_with_pantry_match	p_recipe_id uuid	jsonb	Adds matched / missing arrays
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
get_profile_details	p_user_id uuid	jsonb	Retrieves user profile details including follower and following counts, recipes, and saved recipes. Returns: user_id, username, avatar_url, bio, role, tier, onboarded, followers (integer), following (integer), recipes (jsonb array), saved_recipes (jsonb array)
get_user_profile	p_user_id uuid	TABLE	Slim rowset
get_follow_status	follower_id_param uuid, followed_id_param uuid	jsonb	Check if user follows another
follow_user	follower_id_param uuid, followed_id_param uuid	jsonb	Follow user & update counts
unfollow_user	follower_id_param uuid, followed_id_param uuid	jsonb	Unfollow user & update counts
get_user_followers	user_id_param uuid, limit_param int	TABLE	Get user's followers list
get_user_following	user_id_param uuid, limit_param int	TABLE	Get user's following list


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
