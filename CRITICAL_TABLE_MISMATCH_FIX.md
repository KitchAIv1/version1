# 🚨 CRITICAL: Table Name Mismatch in get_recipe_details RPC

## 📋 **Problem**
The `get_recipe_details` RPC function is querying `FROM recipes r` but the schema change to `preparation_steps` was made on the `recipe_uploads` table.

**Current Code (BROKEN):**
```sql
-- In supabase/migrations/20241225000001_fix_recipe_details_comments.sql
FROM recipes r  -- ❌ WRONG TABLE
LEFT JOIN profiles p ON r.user_id = p.id
WHERE r.id = p_recipe_id;
```

**Schema Change Made To:**
```sql
ALTER TABLE recipe_uploads  -- ✅ CORRECT TABLE
ADD COLUMN preparation_steps JSONB;
```

## 🔧 **Required Fix**

### **Option 1: Update RPC to Use recipe_uploads Table**
```sql
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
    'preparation_steps', r.preparation_steps,  -- ✅ Now returns JSONB array
    'cook_time_minutes', r.cook_time_minutes,
    'prep_time_minutes', r.prep_time_minutes,
    'views_count', r.views_count,
    'likes', COALESCE(r.likes, 0),
    'comments_count', COALESCE(
      (SELECT COUNT(*) FROM recipe_comments WHERE recipe_id = r.id), 
      0
    ),
    'is_liked_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM recipe_likes 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END,
    'is_saved_by_user', CASE 
      WHEN p_user_id IS NULL THEN false
      ELSE EXISTS(
        SELECT 1 FROM saved_recipes 
        WHERE recipe_id = r.id AND user_id = p_user_id
      )
    END
  ) INTO recipe_data
  FROM recipe_uploads r  -- ✅ FIXED: Use correct table
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_recipe_id;

  RETURN recipe_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **Option 2: Update recipes Table Schema (If Both Tables Exist)**
If both `recipes` and `recipe_uploads` tables exist and serve different purposes:

```sql
-- Update recipes table to match
ALTER TABLE recipes 
ALTER COLUMN preparation_steps TYPE JSONB 
USING array_to_json(preparation_steps)::JSONB;
```

## 🔍 **Investigation Needed**

1. **Verify which table is the source of truth:**
   ```sql
   -- Check if both tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('recipes', 'recipe_uploads');
   
   -- Check table schemas
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name IN ('recipes', 'recipe_uploads')
   ORDER BY table_name, ordinal_position;
   ```

2. **Check data consistency:**
   ```sql
   -- Count records in each table
   SELECT 'recipes' as table_name, COUNT(*) as record_count FROM recipes
   UNION ALL
   SELECT 'recipe_uploads' as table_name, COUNT(*) as record_count FROM recipe_uploads;
   ```

## ⏰ **Priority: URGENT**
This mismatch means the frontend cannot access the updated `preparation_steps` JSONB data, potentially breaking recipe display functionality.

## 🎯 **Recommended Action**
1. **Immediate**: Update `get_recipe_details` RPC to query `recipe_uploads` table
2. **Verify**: Check if `recipes` table is still needed or can be deprecated
3. **Update**: All other RPCs that might have the same table name mismatch 