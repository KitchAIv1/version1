# Backend Fix Required: get_recipe_details RPC Function

## Issue
The `get_recipe_details` RPC function is missing like-related fields that are present in `get_community_feed_pantry_match_v3`, causing inconsistent like state between FeedScreen and RecipeDetailScreen.

## Current State
- ✅ `get_community_feed_pantry_match_v3` returns: `output_is_liked`, `output_likes`
- ❌ `get_recipe_details` returns: `undefined` for like fields

## Required Fix
The `get_recipe_details` RPC function needs to be updated to include:

```sql
-- Add these fields to the get_recipe_details RPC function:
is_liked_by_user BOOLEAN,  -- Whether the current user has liked this recipe
likes INTEGER              -- Total number of likes for this recipe
```

## Expected Behavior
After the fix, `get_recipe_details` should return:
```json
{
  "recipe_id": "...",
  "title": "...",
  "is_liked_by_user": true/false,  ← ADD THIS
  "likes": 123,                    ← ADD THIS
  "other_fields": "..."
}
```

## Implementation Notes
1. The RPC should check if `p_user_id` has liked the recipe (similar to feed RPC)
2. The RPC should count total likes for the recipe
3. Both fields should be included in the SELECT statement
4. Handle null `p_user_id` gracefully (return `is_liked_by_user: false`)

## Test Cases
- User who has liked the recipe should see `is_liked_by_user: true`
- User who hasn't liked should see `is_liked_by_user: false`
- Anonymous users (null user_id) should see `is_liked_by_user: false`
- `likes` count should match the actual number of likes in the database

## Priority
🔴 **HIGH** - This is causing user confusion and inconsistent UI state across the app. 