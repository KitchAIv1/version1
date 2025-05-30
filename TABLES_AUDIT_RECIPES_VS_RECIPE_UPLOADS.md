# 🔍 **Table Audit: `recipes` vs `recipe_uploads` - Redundancy Analysis**

## 📊 **Executive Summary**
**CRITICAL FINDING**: The codebase has **conflicting table usage** with both `recipes` and `recipe_uploads` tables serving similar purposes, causing data inconsistencies and broken functionality.

---

## 🗄️ **Table Usage Analysis**

### **✅ `recipe_uploads` Table - ACTIVE & FUNCTIONAL**

**Schema Created**: `20240320000000_create_recipe_uploads.sql`
```sql
CREATE TABLE recipe_uploads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  title text not null,
  video_url text,
  thumbnail_url text,
  ingredients jsonb,
  diet_tags text[],
  preparation_steps jsonb, -- Recently changed from TEXT[] to JSONB
  prep_time_minutes integer,
  cook_time_minutes integer,
  servings integer,
  is_public boolean default true,
  likes integer default 0,
  comments jsonb default '[]'::jsonb,
  comments_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**✅ USED BY (Active Functions):**
1. **`get_profile_details` RPC** - Gets user's uploaded & saved recipes
2. **Video Upload System** - Stores new recipes
3. **Frontend Profile Screen** - Displays user recipes 
4. **AI Recipe Save System** - Stores AI-generated recipes
5. **Meal Planner V2** - References recipes for planning
6. **Edit Recipe System** - Updates existing recipes

**✅ FOREIGN KEY RELATIONSHIPS:**
- `meal_plans.recipe_id REFERENCES recipe_uploads(id)`
- `saved_recipe_videos.recipe_id REFERENCES recipe_uploads(id)`

---

### **❌ `recipes` Table - BROKEN & INCONSISTENT**

**Schema**: Not found in migrations (may be legacy or created elsewhere)

**❌ INCORRECTLY USED BY:**
1. **`get_recipe_details` RPC** - ❌ Queries `FROM recipes r` but data is in `recipe_uploads`
2. **`recipe_comments` System** - ❌ References `recipes(id)` but should reference `recipe_uploads(id)`
3. **Recipe Detail Screen** - ❌ Expects data from `recipes` table
4. **Frontend Recipe Details** - ❌ Broken due to table mismatch

**❌ FOREIGN KEY ISSUES:**
- `recipe_comments.recipe_id REFERENCES recipes(id)` - ❌ BROKEN
- Comments system completely non-functional due to this mismatch

---

## 🔍 **RPC Functions Analysis**

### **📋 Functions Using `recipe_uploads` (Correct Table):**

**1. `get_profile_details`** ✅
```sql
FROM public.recipe_uploads r WHERE r.user_id = p_user_id
FROM public.saved_recipe_videos srv JOIN public.recipe_uploads r ON srv.recipe_id = r.id
```
- **Status**: ✅ Working correctly
- **Used by**: ProfileScreen, user recipes display

**2. `save_ai_generated_recipe`** ✅ (Documented)
```sql
INSERT INTO recipe_uploads (..., preparation_steps, ...)
```
- **Status**: ✅ Working correctly
- **Used by**: AI recipe generation system

**3. `update_recipe_details`** ✅ (Missing but documented)
```sql
UPDATE recipe_uploads SET ... WHERE id = p_recipe_id
```
- **Status**: ⚠️ Function missing but needs to use `recipe_uploads`
- **Used by**: EditRecipeScreen

---

### **📋 Functions Using `recipes` (Incorrect Table):**

**1. `get_recipe_details`** ❌ BROKEN
```sql
FROM recipes r  -- ❌ Wrong table!
```
- **Status**: ❌ Completely broken - querying wrong table
- **Used by**: RecipeDetailScreen, recipe detail views
- **Impact**: Recipe details don't load

**2. Comments System** ❌ BROKEN
```sql
CREATE TABLE recipe_comments (
  recipe_id UUID NOT NULL REFERENCES recipes(id)  -- ❌ Wrong table!
)
```
- **Status**: ❌ Completely broken - foreign key to wrong table
- **Used by**: Recipe comments, social features
- **Impact**: Comments system non-functional

---

## 🎯 **Frontend Impact Analysis**

### **✅ Working Features (Using `recipe_uploads`):**
- ✅ Profile Screen recipe display
- ✅ Video recipe uploading  
- ✅ AI recipe generation & saving
- ✅ Recipe editing (when RPC exists)
- ✅ Meal planning integration
- ✅ User recipe management

### **❌ Broken Features (Using `recipes`):**
- ❌ Recipe Detail Screen (main recipe viewing)
- ❌ Recipe comments & social interactions
- ❌ Recipe likes system
- ❌ Recipe sharing functionality
- ❌ Recipe discovery/feed (if using details)

---

## 🛠️ **Consolidation Strategy**

### **RECOMMENDED APPROACH: Standardize on `recipe_uploads`**

**Why `recipe_uploads` Should Be the Single Table:**
1. ✅ **Complete Schema**: Has all necessary fields (ingredients, steps, metadata)
2. ✅ **Active Data**: Contains all current user recipes
3. ✅ **Proper Relationships**: Correctly linked to meal plans, saves, profiles
4. ✅ **Recent Updates**: Just received JSONB preparation_steps improvement
5. ✅ **Frontend Compatibility**: All working features use this table

---

### **🔧 Required Fixes (Priority Order):**

**PRIORITY 1: Fix `get_recipe_details` RPC**
```sql
-- Change FROM recipes r to FROM recipe_uploads r
CREATE OR REPLACE FUNCTION get_recipe_details(p_recipe_id UUID, p_user_id UUID DEFAULT NULL)
RETURNS JSON AS $$
BEGIN
  SELECT json_build_object(...)
  FROM recipe_uploads r  -- ✅ FIXED: Use correct table
  LEFT JOIN profiles p ON r.user_id = p.id
  WHERE r.id = p_recipe_id;
END;
$$;
```

**PRIORITY 2: Fix Comments System**
```sql
-- Update foreign key reference
ALTER TABLE recipe_comments 
DROP CONSTRAINT recipe_comments_recipe_id_fkey;

ALTER TABLE recipe_comments 
ADD CONSTRAINT recipe_comments_recipe_id_fkey 
FOREIGN KEY (recipe_id) REFERENCES recipe_uploads(id) ON DELETE CASCADE;
```

**PRIORITY 3: Create Missing `update_recipe_details` RPC**
```sql
CREATE OR REPLACE FUNCTION update_recipe_details(...)
RETURNS VOID AS $$
BEGIN
  UPDATE recipe_uploads SET ... WHERE id = p_recipe_id;
END;
$$;
```

**PRIORITY 4: Check for Legacy `recipes` Table**
```sql
-- Investigate if recipes table exists and has data
SELECT COUNT(*) FROM recipes;
-- If data exists, migrate to recipe_uploads
-- If empty, drop the table
```

---

## 📈 **Migration Benefits**

**✅ Immediate Fixes:**
- ✅ Recipe Detail Screen works
- ✅ Comments system functional
- ✅ Social features (likes, saves) work
- ✅ Consistent data access across app

**✅ Long-term Benefits:**
- ✅ Single source of truth for recipes
- ✅ Simplified maintenance
- ✅ Improved performance (no duplicate queries)
- ✅ Easier feature development

---

## ⚠️ **Migration Risks & Mitigation**

**⚠️ Risk**: Data loss if `recipes` table has unique data
**🛡️ Mitigation**: Audit both tables, migrate any unique `recipes` data first

**⚠️ Risk**: Frontend cache inconsistencies  
**🛡️ Mitigation**: Clear query caches after backend fixes

**⚠️ Risk**: Broken foreign keys during migration
**🛡️ Mitigation**: Use transactions, fix constraints before data migration

---

## 🏁 **Final Recommendation**

**ELIMINATE `recipes` table entirely** and **standardize on `recipe_uploads`** as the single recipes table.

**Immediate Action Required:**
1. Fix `get_recipe_details` RPC (5 min fix)
2. Fix `recipe_comments` foreign key (2 min fix)  
3. Test Recipe Detail Screen functionality
4. Create missing `update_recipe_details` RPC

**Result**: All recipe features will work consistently with a single, well-designed table structure. 