# 🛡️ SAFE MANUAL RPC ALIGNMENT FIX

**Status:** ✅ All data is safe - the failed script didn't break anything  
**Approach:** Manual execution through Supabase dashboard (much safer)

## 🎯 What We're Fixing

The frontend already uses `user_interactions` for likes, but the backend RPC still uses `recipe_likes`. We just need to align them.

## 📋 Step-by-Step Manual Fix

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**

### Step 2: Drop the Existing Function (Copy & Paste)

```sql
-- Step 1: Drop the existing function first
DROP FUNCTION IF EXISTS get_recipe_details(uuid,uuid);
```

### Step 3: Create the Updated Function (Copy & Paste)

```sql
-- Step 2: Create the updated function
CREATE OR REPLACE FUNCTION get_recipe_details(p_recipe_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  recipe_data JSON;
BEGIN
  SELECT json_build_object(
    'recipe_id', r.id,
    'title', r.title,
    'user_id', r.user_id,
    'servings', r.servings,
    'diet_tags', r.diet_tags,
    'is_public', r.is_public,
    'video_url', r.video_url,
    'thumbnail_url', r.thumbnail_url,
    'created_at', r.created_at,
    'description', r.description,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'ingredients', r.ingredients,
    'preparation_steps', r.preparation_steps,
    'cook_time_minutes', r.cook_time_minutes,
    'prep_time_minutes', r.prep_time_minutes,
    'views_count', r.views_count,
    'likes', COALESCE(r.likes_count, 0),
    'comments_count', COALESCE(
      (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id), 
      0
    ),
    'is_liked_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM user_interactions 
        WHERE recipe_id = r.id 
          AND user_id = p_user_id 
          AND interaction_type = 'like'
      )
    END,
    'is_saved_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM saved_recipe_videos 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END
  ) INTO recipe_data
  FROM recipe_uploads r
  LEFT JOIN profiles p ON r.user_id = p.user_id
  WHERE r.id = p_recipe_id;

  RETURN recipe_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 4: Grant Permissions (Copy & Paste)

```sql
-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION get_recipe_details(UUID, UUID) TO authenticated;
```

### Step 5: Test the Fix

Test with a real recipe ID from your database:

```sql
-- Step 4: Test the updated function (replace with real IDs from your data)
SELECT get_recipe_details(
  '550e8400-e29b-41d4-a716-446655440000'::UUID,
  'cdc87669-6408-48a8-acf9-efd1ed42cab9'::UUID
);
```

## 🔍 What This Fix Does

✅ **Uses `user_interactions`** instead of `recipe_likes` (matches frontend)  
✅ **Uses `saved_recipe_videos`** instead of `saved_recipes` (primary table)  
✅ **Uses `recipe_uploads`** instead of `recipes` (current table)  
✅ **Uses `likes_count`** field from recipe_uploads (proper field name)  
✅ **No data migration** - just fixes the inconsistency  

## 🧪 How to Verify It Worked

1. **Test the app** - like/unlike recipes should work consistently
2. **Check recipe details** - should load without discrepancies
3. **Monitor logs** - no more like count mismatches

## 🚨 If Something Goes Wrong

The original function is backed up in your migration files. You can restore it by running the original migration again.

## 📊 Expected Results

- ✅ Frontend and backend will be aligned
- ✅ Like counts will be consistent
- ✅ Save functionality will use primary table
- ✅ No data loss or corruption
- ✅ App continues working as before, but better

## 🎯 Why This is Safe

1. **No data changes** - only function logic
2. **Matches frontend expectations** - already compatible
3. **Single function update** - minimal risk
4. **Easily reversible** - can restore original
5. **Tested approach** - based on working frontend code

## 📝 Execution Order

**Execute these SQL statements in order:**
1. Drop existing function
2. Create new function  
3. Grant permissions
4. Test the function 