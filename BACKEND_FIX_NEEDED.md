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

# Backend Fixes Needed

## 1. Comment Count Issue in Feed RPC (RESOLVED ✅)
The `get_community_feed_pantry_match_v3` RPC function was not returning comment counts, causing delays in the feed display.

**Status**: Fixed by updating the RPC to include comment counts.

## 2. Pantry Scanning Recognition Improvement (PENDING 🔧)

### Issue
The `recognize-stock` edge function is currently recognizing individual ingredients from packaged products instead of treating them as single items. For example, scanning a "box of coffee" returns individual coffee-related ingredients instead of just "coffee".

### Solution
Update the OpenAI prompt in the `recognize-stock` edge function with the following improved prompt:

**Current Prompt:**
```
"Analyze the pantry items in this image. Identify specific ingredients, ignoring background objects and packaging text unless it clearly indicates the food item. For each distinct ingredient, estimate the visible quantity (e.g., count, approximate weight like '500g', volume like '1L', or description like 'half full'). Return a JSON object with a single key 'items' containing an array of objects. Each object in the array must have 'name' (string, lowercase, simple name only - e.g., 'milk' not 'Organic Whole Milk') and 'quantity' (string) fields. Example: { \"items\": [{\"name\": \"eggs\", \"quantity\": \"6\"}, {\"name\": \"milk\", \"quantity\": \"half gallon\"}, {\"name\": \"apples\", \"quantity\": \"3\"}] }."
```

**Updated Prompt:**
```
"Analyze the pantry items in this image. Identify specific ingredients, ignoring background objects and packaging text unless it clearly indicates the food item. Treat packaged products (e.g., a 'box of coffee', 'carton of soup', 'bag of frozen meals') as a single item with a simple name (e.g., 'coffee', 'soup', 'frozen meal') and quantity (e.g., '1 box', '1 carton', '1 bag'), unless the contents are clearly unpackaged and separate (e.g., individual coffee packets scattered on a table). For each distinct item, estimate the visible quantity (e.g., count, approximate weight like '500g', volume like '1L', or description like 'half full'). Return a JSON object with a single key 'items' containing an array of objects. Each object in the array must have 'name' (string, lowercase, simple name only - e.g., 'coffee' not 'Box of Instant Coffee') and 'quantity' (string) fields. Example: { \"items\": [{\"name\": \"coffee\", \"quantity\": \"1 box\"}, {\"name\": \"milk\", \"quantity\": \"1L\"}, {\"name\": \"apples\", \"quantity\": \"3\"}] }."
```

### Priority
🔴 **HIGH** - Users are getting confusing results when scanning packaged products, leading to cluttered pantry with individual ingredients instead of the actual products they scanned. 