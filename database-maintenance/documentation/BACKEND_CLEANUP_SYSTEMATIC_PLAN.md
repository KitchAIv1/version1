# 🔧 **KitchAI v2 - Systematic Backend Cleanup Plan**

**Version:** 1.0  
**Date:** January 2025  
**Purpose:** Systematic approach to resolve table inconsistencies and prepare for deployment  
**Priority:** CRITICAL for deployment readiness

---

## 📋 **EXECUTIVE SUMMARY**

Your backend has **evolved organically** with multiple tables serving similar purposes, causing:
- **71 security warnings** (many redundant)
- **Inconsistent data access patterns**
- **RPC functions querying different tables for same data**
- **Frontend fallback mechanisms masking problems**

**Goal:** Create a **single source of truth** for each data type and eliminate redundancy.

---

## 🗺️ **PHASE 1: TABLE RELATIONSHIP MAPPING - UPDATED WITH REAL DATA**

### **🔍 CONFIRMED TABLE CONFLICTS**

#### **1. RECIPE DATA CONFLICT - CRITICAL**
```
┌─────────────────┬──────────────────┬─────────────────┬──────────────────┐
│ TABLE NAME      │ RECORDS         │ STATUS          │ RECOMMENDATION   │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ recipe_uploads  │ 32 records      │ ✅ ACTIVE       │ KEEP (Primary)   │
│                 │ Modern schema    │ Newer structure │ Frontend uses    │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ recipes         │ 21 records      │ ⚠️ LEGACY       │ MIGRATE & DROP   │
│                 │ Old schema       │ Different fields│ RPC uses this    │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

**CRITICAL ISSUE:** Your RPC functions query `recipes` (21 records) but your frontend expects `recipe_uploads` (32 records). This explains potential missing recipes!

#### **2. USER DATA CONFLICT - MANAGEABLE**
```
┌─────────────────┬──────────────────┬─────────────────┬──────────────────┐
│ TABLE NAME      │ RECORDS         │ STATUS          │ RECOMMENDATION   │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ profiles        │ 22 records      │ ✅ ACTIVE       │ KEEP (Primary)   │
│                 │ Current users    │ Frontend uses   │                  │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ users           │ 3 records       │ ❌ LEGACY       │ MIGRATE & DROP   │
│                 │ Old user data    │ Fallback only   │                  │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

#### **3. SAVED RECIPES - DIFFERENT PURPOSES**
```
┌─────────────────┬──────────────────┬─────────────────┬──────────────────┐
│ TABLE NAME      │ RECORDS         │ STATUS          │ RECOMMENDATION   │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ saved_recipe_   │ 30 records      │ ✅ ACTIVE       │ KEEP (Primary)   │
│ videos          │ Simple saves     │ Profile uses    │                  │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ saved_recipes   │ 2 records       │ ⚠️ DIFFERENT    │ KEEP SEPARATE    │
│                 │ Detailed saves   │ Has ratings     │ (Different use)  │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

#### **4. INTERACTION DATA - BOTH ACTIVE**
```
┌─────────────────┬──────────────────┬─────────────────┬──────────────────┐
│ TABLE NAME      │ RECORDS         │ STATUS          │ RECOMMENDATION   │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ recipe_likes    │ 9 records       │ ✅ ACTIVE       │ KEEP (Primary)   │
├─────────────────┼──────────────────┼─────────────────┼──────────────────┤
│ user_interactions│ 19 records     │ ✅ ACTIVE       │ KEEP (Broader)   │
│                 │ Multiple types   │ More data       │                  │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

---

## 🎯 **PHASE 2: INVESTIGATION COMMANDS**

### **Step 1: Verify Table Existence**
```sql
-- Run this in Supabase SQL Editor
SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_type = 'VIEW' THEN 'VIEW'
    ELSE 'TABLE'
  END as object_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'recipes', 'recipe_uploads',
    'users', 'profiles', 
    'saved_recipes', 'saved_recipe_videos',
    'user_interactions', 'recipe_likes'
  )
ORDER BY table_name;
```

### **Step 2: Check Data Overlap**
```sql
-- Check if recipes and recipe_uploads have same data
SELECT 
  'recipes' as source,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM recipes
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recipes')

UNION ALL

SELECT 
  'recipe_uploads' as source,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM recipe_uploads;
```

### **Step 3: Check Schema Differences**
```sql
-- Compare column structures
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('recipes', 'recipe_uploads')
ORDER BY table_name, ordinal_position;
```

---

## 🔧 **PHASE 3: SYSTEMATIC CLEANUP PLAN - UPDATED**

### **Priority 1: Recipe Data Unification (CRITICAL)**

**Problem:** Frontend expects `recipe_uploads` (32 recipes) but RPC queries `recipes` (21 recipes)

#### **Solution: Migrate `recipes` data to `recipe_uploads`**
```sql
-- Step 1: Backup existing data
CREATE TABLE recipes_backup AS SELECT * FROM recipes;
CREATE TABLE recipe_uploads_backup AS SELECT * FROM recipe_uploads;

-- Step 2: Analyze data overlap
SELECT 
  'recipes_only' as source,
  COUNT(*) as count
FROM recipes r
WHERE r.id NOT IN (SELECT id FROM recipe_uploads)

UNION ALL

SELECT 
  'recipe_uploads_only' as source,
  COUNT(*) as count  
FROM recipe_uploads ru
WHERE ru.id NOT IN (SELECT id FROM recipes)

UNION ALL

SELECT 
  'both_tables' as source,
  COUNT(*) as count
FROM recipes r
INNER JOIN recipe_uploads ru ON r.id = ru.id;

-- Step 3: Migrate unique recipes from 'recipes' to 'recipe_uploads'
-- (This requires manual mapping due to different schemas)
INSERT INTO recipe_uploads (
  id, title, description, ingredients, preparation_steps,
  user_id, video_url, is_public, created_at, updated_at
)
SELECT 
  r.id,
  r.recipe_name as title,
  COALESCE(r.feedback_text, '') as description,
  r.ingredients_json as ingredients,
  r.preparation_steps,
  r.user_id,
  r.video_url,
  true as is_public,
  r.created_at,
  NOW() as updated_at
FROM recipes r
WHERE r.id NOT IN (SELECT id FROM recipe_uploads)
  AND r.recipe_name IS NOT NULL;

-- Step 4: Update RPC functions to use recipe_uploads
-- Step 5: Drop recipes table after verification
```

### **Priority 2: User Data Cleanup (HIGH)**

#### **Migrate `users` data to `profiles`**
```sql
-- Check for users not in profiles
SELECT u.* 
FROM users u 
WHERE u.id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL);

-- Migrate missing users to profiles
INSERT INTO profiles (user_id, username, bio, avatar_url, created_at)
SELECT 
  u.id as user_id,
  COALESCE(u.email, 'user_' || u.id) as username,
  u.bio,
  u.avatar_url,
  u.created_at
FROM users u
WHERE u.id NOT IN (SELECT user_id FROM profiles WHERE user_id IS NOT NULL);

-- Drop users table after verification
DROP TABLE users;
```

### **Priority 3: Keep Both Saved Recipe Tables (REVISED)**

**Decision:** Keep both tables as they serve different purposes:
- `saved_recipe_videos`: Simple saves (30 records) - Primary for profile display
- `saved_recipes`: Detailed saves with ratings (2 records) - Keep for advanced features

### **Priority 4: Standardize Interaction Data (MEDIUM)**

**Decision:** Keep `user_interactions` as primary (19 records vs 9 in recipe_likes)
```sql
-- Migrate recipe_likes to user_interactions if not already there
INSERT INTO user_interactions (user_id, recipe_id, interaction_type, created_at)
SELECT user_id, recipe_id, 'like' as interaction_type, created_at
FROM recipe_likes rl
WHERE NOT EXISTS (
  SELECT 1 FROM user_interactions ui 
  WHERE ui.user_id = rl.user_id 
    AND ui.recipe_id = rl.recipe_id 
    AND ui.interaction_type = 'like'
);

-- Drop recipe_likes after migration
DROP TABLE recipe_likes;
```

---

## 📝 **PHASE 4: RPC FUNCTION UPDATES**

### **Critical RPC Functions to Update**

#### **1. Fix `get_recipe_details`**
```sql
CREATE OR REPLACE FUNCTION get_recipe_details(p_recipe_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  recipe_data JSON;
BEGIN
  SELECT json_build_object(
    'recipe_id', r.id,
    'title', r.title,
    -- ... other fields
  ) INTO recipe_data
  FROM recipe_uploads r  -- ✅ FIXED: Use standardized table
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_recipe_id;

  RETURN recipe_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **2. Create Missing `update_recipe_details`**
```sql
CREATE OR REPLACE FUNCTION update_recipe_details(
  p_recipe_id UUID,
  p_user_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_ingredients JSONB DEFAULT NULL,
  p_preparation_steps JSONB DEFAULT NULL,
  p_prep_time_minutes INTEGER DEFAULT NULL,
  p_cook_time_minutes INTEGER DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_diet_tags TEXT[] DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE recipe_uploads SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    ingredients = COALESCE(p_ingredients, ingredients),
    preparation_steps = COALESCE(p_preparation_steps, preparation_steps),
    prep_time_minutes = COALESCE(p_prep_time_minutes, prep_time_minutes),
    cook_time_minutes = COALESCE(p_cook_time_minutes, cook_time_minutes),
    servings = COALESCE(p_servings, servings),
    diet_tags = COALESCE(p_diet_tags, diet_tags),
    updated_at = NOW()
  WHERE id = p_recipe_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipe not found or access denied';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### **3. Standardize Saved Recipe RPCs**
```sql
-- Update all saved recipe functions to use saved_recipe_videos
CREATE OR REPLACE FUNCTION save_recipe(p_user_id UUID, p_recipe_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO saved_recipe_videos (user_id, recipe_id, saved_at)
  VALUES (p_user_id, p_recipe_id, NOW())
  ON CONFLICT (user_id, recipe_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION unsave_recipe(p_user_id UUID, p_recipe_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM saved_recipe_videos 
  WHERE user_id = p_user_id AND recipe_id = p_recipe_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🛡️ **PHASE 5: SECURITY CLEANUP**

### **Apply RLS Only to Active Tables**

#### **Core Tables (Apply RLS)**
```sql
-- recipe_uploads
ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public recipes" ON recipe_uploads FOR SELECT USING (is_public = true);
CREATE POLICY "Users can manage own recipes" ON recipe_uploads FOR ALL USING (auth.uid() = user_id);

-- profiles  
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR ALL USING (auth.uid() = id);

-- stock
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own stock" ON stock FOR ALL USING (auth.uid() = user_id);

-- recipe_comments
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON recipe_comments FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON recipe_comments FOR INSERT USING (auth.uid() = user_id);

-- saved_recipe_videos
ALTER TABLE saved_recipe_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved recipes" ON saved_recipe_videos FOR ALL USING (auth.uid() = user_id);

-- recipe_likes
ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own likes" ON recipe_likes FOR ALL USING (auth.uid() = user_id);

-- grocery_list
ALTER TABLE grocery_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own grocery list" ON grocery_list FOR ALL USING (auth.uid() = user_id);

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);

-- meal_plans
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meal plans" ON meal_plans FOR ALL USING (auth.uid() = user_id);

-- user_usage_limits
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage limits" ON user_usage_limits FOR ALL USING (auth.uid() = user_id);

-- user_activity_log
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activity" ON user_activity_log FOR ALL USING (auth.uid() = user_id);
```

#### **Remove Redundant Tables (After Migration)**
```sql
-- Only after confirming data migration
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_interactions;
-- DROP TABLE IF EXISTS saved_recipes; (after migration)
-- DROP TABLE IF EXISTS recipes; (if redundant)
```

---

## 📊 **PHASE 6: VERIFICATION & TESTING**

### **Step 1: Data Integrity Check**
```sql
-- Verify no data loss
SELECT 
  'recipe_uploads' as table_name, COUNT(*) as count FROM recipe_uploads
UNION ALL
SELECT 
  'saved_recipe_videos' as table_name, COUNT(*) as count FROM saved_recipe_videos
UNION ALL
SELECT 
  'recipe_likes' as table_name, COUNT(*) as count FROM recipe_likes;
```

### **Step 2: Frontend Testing Checklist**
- [ ] Recipe detail screens load correctly
- [ ] Profile saved recipes display
- [ ] Like/unlike functionality works
- [ ] Save/unsave functionality works
- [ ] Recipe editing works
- [ ] AI recipe generation and saving works
- [ ] Meal planning works
- [ ] Pantry management works

### **Step 3: Security Verification**
```sql
-- Check RLS policies are active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 🚀 **DEPLOYMENT READINESS CHECKLIST**

### **Pre-Deployment**
- [ ] All table relationships mapped and documented
- [ ] Data migration completed and verified
- [ ] RPC functions updated and tested
- [ ] RLS policies applied to active tables only
- [ ] Redundant tables removed
- [ ] Frontend functionality verified
- [ ] Security warnings reduced to <10

### **Post-Deployment Monitoring**
- [ ] Monitor error logs for missing table references
- [ ] Verify all user flows work correctly
- [ ] Check performance improvements from reduced table count
- [ ] Confirm security warnings eliminated

---

## ⏱️ **ESTIMATED TIMELINE**

- **Phase 1-2 (Investigation):** 2-4 hours
- **Phase 3 (Data Cleanup):** 4-6 hours  
- **Phase 4 (RPC Updates):** 2-3 hours
- **Phase 5 (Security):** 1-2 hours
- **Phase 6 (Testing):** 2-3 hours

**Total:** 11-18 hours for complete cleanup

---

## 🎯 **SUCCESS METRICS**

- **Security Warnings:** From 71 → <10
- **Table Count:** Reduced by 30-50%
- **RPC Consistency:** 100% using standardized tables
- **Frontend Stability:** No broken functionality
- **Performance:** Improved query performance

---

**This systematic approach will give you a clean, secure, deployment-ready backend with clear data relationships and minimal redundancy.** 