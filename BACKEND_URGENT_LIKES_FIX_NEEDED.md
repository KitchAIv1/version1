# 🚨 URGENT: Backend Likes Functionality Broken

## Current Status: Critical Like Issues After Feed Fix

The backend team successfully fixed the `get_community_feed_pantry_match_v3` RPC (no more `r.likes` errors), but this has introduced critical issues with the likes functionality. Here's the complete breakdown:

---

## 🔴 **Issue #1: Like RPC Functions Don't Exist**

### Latest Error (Updated):
```
ERROR [useLikeMutation] Like toggle error: {"code": "PGRST202", "details": "Searched for the function public.toggle_recipe_like with parameters recipe_id_param, user_id_param or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.", "hint": "Perhaps you meant to call the function public.log_recipe_view", "message": "Could not find the function public.toggle_recipe_like(recipe_id_param, user_id_param) in the schema cache"}
```

### Problem:
- **NONE of the documented like RPC functions exist** in the backend schema cache
- `toggle_recipe_like` ❌ - Function not found
- `toggle_like_recipe` ❌ - Has `created_at` column issue
- `add_like` and `remove_like` ❓ - Need to be tested

### Required Investigation:
1. **Check which like functions actually exist:**
```sql
-- List all functions with 'like' in the name
SELECT routines.routine_name, parameters.parameter_name, parameters.data_type 
FROM information_schema.routines 
LEFT JOIN information_schema.parameters ON routines.specific_name=parameters.specific_name 
WHERE routines.routine_name LIKE '%like%' 
ORDER BY routines.routine_name, parameters.ordinal_position;
```

2. **Test the documented functions:**
```sql
-- Test add_like
SELECT add_like('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 'c4ca4238-a0b9-4f5e-b6a3-9e5c6d7e8f90');

-- Test remove_like  
SELECT remove_like('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 'c4ca4238-a0b9-4f5e-b6a3-9e5c6d7e8f90');
```

---

## 🔴 **Issue #2: Missing `created_at` Column in `recipe_likes` Table**

### Error from Previous Session:
```
ERROR [useLikeMutation] Like toggle error: {"code": "P0001", "details": null, "hint": null, "message": "Failed to toggle like: column \"created_at\" of relation \"recipe_likes\" does not exist"}
```

### Problem:
- The `toggle_like_recipe` RPC function is trying to access a `created_at` column that doesn't exist in the `recipe_likes` table
- This completely breaks the like functionality

### Required Fix:
**Option A**: Add `created_at` column to `recipe_likes` table
```sql
ALTER TABLE recipe_likes ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

**Option B**: Update `toggle_like_recipe` RPC to not use `created_at` column

**Option C**: Use the alternative RPC function `toggle_recipe_like` (from RPC Reference)

---

## 🔴 **Issue #2: Missing Like Fields in `get_recipe_details` RPC**

### Current Warning:
```
WARN [fetchRecipeDetails] Like fields missing from get_recipe_details RPC for recipe eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01. This should now be resolved.
```

### Problem:
- `get_recipe_details` RPC is not returning like-related fields:
  - `is_liked_by_user` (boolean)
  - `likes` (integer)

### Current Behavior:
```javascript
// Recipe details always shows:
"recipe_details_likes": 0,
"recipe_details_liked": false
```

### Required Fix:
Add these fields to the `get_recipe_details` RPC:
```sql
-- Add to get_recipe_details RPC SELECT statement:
(SELECT COUNT(*) FROM recipe_likes WHERE recipe_id = r.recipe_id) as likes,
(SELECT EXISTS(SELECT 1 FROM recipe_likes WHERE recipe_id = r.recipe_id AND user_id = p_user_id)) as is_liked_by_user
```

---

## 🔴 **Issue #3: Like Count Always Showing 0**

### Current Status:
```javascript
// Feed data:
"feed_likes": 0,
"feed_liked": true  // Shows user has liked it

// Recipe details:
"recipe_details_likes": 0,
"recipe_details_liked": false  // Shows user hasn't liked it
```

### Problem:
- Both feed and recipe details show `likes: 0` even for recipes that should have likes
- There's inconsistency between feed (`liked: true`) and recipe details (`liked: false`)

### Required Investigation:
1. **Check if `recipe_likes` table has data:**
```sql
SELECT COUNT(*) FROM recipe_likes;
SELECT * FROM recipe_likes LIMIT 5;
```

2. **Check specific test recipe:**
```sql
SELECT * FROM recipe_likes WHERE recipe_id = 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01';
```

---

## 📋 **Available RPC Functions for Likes**

According to the RPC Reference documentation, you have these options:

### Option 1: `add_like` + `remove_like` (Separate functions)
```sql
add_like(user_id_param uuid, recipe_id_param uuid) → boolean
remove_like(user_id_param uuid, recipe_id_param uuid) → boolean
```

### Option 2: `toggle_recipe_like` (Toggle function)
```sql
toggle_recipe_like(user_id_param uuid, recipe_id_param uuid) → json
```

### Option 3: `toggle_like_recipe` (Currently broken)
```sql
toggle_like_recipe(p_user_id uuid, p_recipe_id uuid) → ??? (has created_at issue)
```

---

## 🔧 **Recommended Immediate Actions**

### Priority 1 (Fix Like Functionality):
1. **Choose working RPC function**:
   - Test `toggle_recipe_like` with correct parameters
   - OR fix `toggle_like_recipe` by addressing `created_at` column issue

2. **Update RPC function call format**:
   - If using `toggle_recipe_like`: parameters should be `user_id_param`, `recipe_id_param`
   - If using `toggle_like_recipe`: parameters should be `p_user_id`, `p_recipe_id`

### Priority 2 (Fix Like Counts):
3. **Add like fields to `get_recipe_details` RPC**:
   - Add `likes` count calculation
   - Add `is_liked_by_user` boolean check

4. **Verify like counts in `get_community_feed_pantry_match_v3`**:
   - Ensure `output_likes` is calculated correctly
   - Ensure `output_is_liked` works properly

---

## 🧪 **Testing Commands**

### Test Like RPC Functions:
```sql
-- Test toggle_recipe_like
SELECT toggle_recipe_like('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01');

-- Test toggle_like_recipe (if fixed)
SELECT toggle_like_recipe('9b84ff89-f9e5-4ddb-9de8-9797d272da59', 'eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01');
```

### Check Table Structure:
```sql
-- Check recipe_likes table structure
\d recipe_likes;

-- Check if created_at column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'recipe_likes' AND column_name = 'created_at';
```

### Test Recipe Details:
```sql
-- Test get_recipe_details
SELECT * FROM get_recipe_details('eccbc87e-4b5c-4f6f-b7a4-0a6c7d8e9f01', '9b84ff89-f9e5-4ddb-9de8-9797d272da59');
```

---

## 📱 **Current User Impact**

### What's Working:
- ✅ Feed loads properly (no more `r.likes` errors)
- ✅ Pantry matching works perfectly (60% matches displaying correctly)
- ✅ Recipe detail screens load properly

### What's Broken:
- ❌ **Like button doesn't work** (crashes with `created_at` error)
- ❌ **Like counts always show 0** (even for recipes that should have likes)
- ❌ **Inconsistent like state** (feed shows liked=true, recipe detail shows liked=false)

---

## 📞 **Frontend Workaround Applied**

I've updated the frontend to use separate `add_like` and `remove_like` functions instead of the non-existent toggle functions:

```typescript
// Changed from:
supabase.rpc('toggle_like_recipe', { p_user_id: userId, p_recipe_id: recipeId })

// Then tried:
supabase.rpc('toggle_recipe_like', { user_id_param: userId, recipe_id_param: recipeId })

// Now using:
const rpcFunction = currentlyLiked ? 'remove_like' : 'add_like';
supabase.rpc(rpcFunction, { user_id_param: userId, recipe_id_param: recipeId })
```

**Backend needs to confirm**: 
1. Do `add_like` and `remove_like` functions exist?
2. What are the correct parameter names?
3. Do they work with the current `recipe_likes` table structure?

---

## 🎯 **Expected Results After Fix**

1. **Like button works** without `created_at` errors
2. **Like counts display correctly** (not always 0)
3. **Consistent like state** between feed and recipe details
4. **Proper like persistence** (likes saved to database)

**Please test these specific scenarios:**
- User likes a recipe → count increases, state updates
- User unlikes a recipe → count decreases, state updates
- Like state consistent between feed and recipe detail screens 