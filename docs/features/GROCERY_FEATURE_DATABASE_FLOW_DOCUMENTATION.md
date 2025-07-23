# GROCERY FEATURE DATABASE FLOW DOCUMENTATION
## Complete Database Paths & Dependencies

> **Purpose**: Document the exact database flow for the grocery feature that was working before database cleaning, so backend can verify what paths were broken and need restoration.

---

## 🔄 **GROCERY FEATURE WORKFLOW**

### **User Action**: "Add missing items to grocery list"
**Trigger**: User taps "Add to Grocery" button on missing ingredients in recipe details

### **Code Flow Path**:
```
IngredientsTab.tsx → GroceryProvider.tsx → useMealPlanAggregatedIngredients.ts → Database
```

---

## 📊 **DATABASE DEPENDENCIES & PATHS**

### **1. MEAL PLAN AGGREGATION** 
**File**: `src/hooks/useMealPlanAggregatedIngredients.ts`

#### **Primary Query** (Line 33):
```sql
SELECT recipe_id, recipe_uploads(title)
FROM meal_plans 
WHERE user_id = ? 
  AND date >= ? 
  AND date <= ?
```

#### **Required Tables & Columns**:
- **`meal_plans`**:
  - `recipe_id` (UUID, references recipe table)
  - `user_id` (UUID)
  - `date` (DATE)

- **`recipe_uploads`** (or whatever the recipe table is called):
  - `id` (UUID, primary key)
  - `title` (TEXT)

#### **Join Relationship**:
```sql
meal_plans.recipe_id → recipe_uploads.id
```

---

### **2. RECIPE DETAILS FETCHING**
**File**: `src/hooks/useMealPlanAggregatedIngredients.ts` (Line 111)

#### **RPC Function Call**:
```sql
SELECT * FROM get_recipe_details(p_recipe_id, p_user_id)
```

#### **Required RPC Function**: `get_recipe_details`
**Expected to return**:
- `ingredients` (JSONB array or similar structure)
- Recipe metadata

#### **Ingredients Structure Expected**:
```json
[
  {
    "name": "ingredient_name",
    "quantity": "1",
    "unit": "cup"
  }
]
```

---

### **3. GROCERY LIST STORAGE**
**File**: `src/providers/GroceryProvider.tsx` (Line 168)

#### **Insert Query**:
```sql
INSERT INTO grocery_list (user_id, item_name, quantity, unit, recipe_name, is_checked)
VALUES (?, ?, ?, ?, ?, false)
ON CONFLICT (user_id, item_name, unit) DO UPDATE SET ...
```

#### **Required Table & Columns**:
- **`grocery_list`**:
  - `user_id` (UUID)
  - `item_name` (TEXT)
  - `quantity` (INTEGER or NUMERIC)
  - `unit` (TEXT)
  - `recipe_name` (TEXT, nullable)
  - `is_checked` (BOOLEAN, default false)

#### **Unique Constraint**:
```sql
UNIQUE(user_id, item_name, unit)
```

---

### **4. USER ACTIVITY LOGGING** 
**File**: `src/providers/GroceryProvider.tsx` (Line 185)

#### **Query Client Invalidation**:
```sql
-- Triggers refresh of user activity feed
queryKey: ['userActivityFeed', user_id]
```

#### **Potential Table Dependency**:
- **`user_activity_log`** or similar activity tracking table

---

## 🔍 **CRITICAL DATABASE PATHS TO VERIFY**

### **Path 1: Meal Plans → Recipe Join**
```
meal_plans.recipe_id → [RECIPE_TABLE].id
```
**❓ Questions for Backend**:
1. Does `meal_plans` table still exist?
2. What is the actual name of the recipe table? (`recipes` vs `recipe_uploads`)
3. Does the foreign key relationship still exist?
4. Are there any RLS policies blocking the join?

### **Path 2: Recipe Details RPC**
```
get_recipe_details(recipe_id, user_id) → recipe data with ingredients
```
**❓ Questions for Backend**:
1. Does `get_recipe_details` RPC function still exist?
2. Does it reference the correct recipe table name?
3. Does it return ingredients in the expected format?

### **Path 3: Grocery List Table**
```
INSERT INTO grocery_list → storage of grocery items
```
**❓ Questions for Backend**:
1. Does `grocery_list` table still exist with all required columns?
2. Is the unique constraint still in place?
3. Are RLS policies allowing inserts for authenticated users?

---

## 📋 **VERIFICATION CHECKLIST FOR BACKEND**

### **✅ Tables to Verify Exist**:
- [ ] `meal_plans`
- [ ] `recipe_uploads` OR `recipes` (whichever is the current recipe table)
- [ ] `grocery_list`
- [ ] `profiles` (for user data)

### **✅ Columns to Verify Exist**:

**meal_plans**:
- [ ] `recipe_id` (UUID)
- [ ] `user_id` (UUID) 
- [ ] `date` (DATE)

**[recipe_table]**:
- [ ] `id` (UUID, primary key)
- [ ] `title` (TEXT)
- [ ] `ingredients` (JSONB or similar)
- [ ] `user_id` (UUID)

**grocery_list**:
- [ ] `user_id` (UUID)
- [ ] `item_name` (TEXT)
- [ ] `quantity` (INTEGER/NUMERIC)
- [ ] `unit` (TEXT)
- [ ] `recipe_name` (TEXT, nullable)
- [ ] `is_checked` (BOOLEAN)

### **✅ Relationships to Verify**:
- [ ] `meal_plans.recipe_id` → `[recipe_table].id` (foreign key or join works)
- [ ] `meal_plans.user_id` → `profiles.id`
- [ ] `grocery_list.user_id` → `profiles.id`

### **✅ RPC Functions to Verify**:
- [ ] `get_recipe_details(UUID, UUID)` exists
- [ ] Returns ingredients in expected format
- [ ] References correct recipe table internally

### **✅ Constraints to Verify**:
- [ ] `grocery_list` unique constraint on `(user_id, item_name, unit)`

### **✅ Permissions to Verify**:
- [ ] RLS policies allow authenticated users to:
  - Read from `meal_plans` (their own data)
  - Read from recipe table (public recipes + own recipes)
  - Insert/update `grocery_list` (their own data)

---

## 🚨 **MOST LIKELY ISSUES BASED ON ERROR**

### **Error**: `relation "recipe_uploads" does not exist`

### **Probable Causes**:
1. **Table Renamed**: Recipe table is actually called `recipes`, not `recipe_uploads`
2. **Table Deleted**: Recipe table was accidentally removed during cleaning
3. **RPC Function Issue**: `get_recipe_details` references wrong table name
4. **Frontend Code Issue**: Code expects `recipe_uploads` but database has `recipes`

### **Quick Diagnostic Queries for Backend**:
```sql
-- Check what recipe tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%recipe%';

-- Check meal_plans structure
\d meal_plans;

-- Check if get_recipe_details exists and what it references
\df get_recipe_details;

-- Test the problematic join
SELECT recipe_id, recipes(title) FROM meal_plans LIMIT 1;
-- OR
SELECT recipe_id, recipe_uploads(title) FROM meal_plans LIMIT 1;
```

---

## 🔧 **EXPECTED FIXES NEEDED**

Based on the error, backend will likely need to:

1. **If recipe table is called `recipes`**:
   - Update frontend code to use `recipes` instead of `recipe_uploads`
   - OR create a view/alias `recipe_uploads` pointing to `recipes`

2. **If recipe table was deleted**:
   - Restore from backup
   - OR recreate table structure

3. **If RPC function is broken**:
   - Update `get_recipe_details` to reference correct table name

4. **If permissions are broken**:
   - Restore RLS policies for recipe access

---

## 📞 **BACKEND ACTION ITEMS**

1. **Run diagnostic queries** to identify current table structure
2. **Compare with this documentation** to see what's missing/changed
3. **Provide specific findings** on what was affected during cleaning
4. **Recommend specific fixes** based on actual database state

This documentation provides the complete picture of what the grocery feature expects vs. what might be broken after database cleaning. 