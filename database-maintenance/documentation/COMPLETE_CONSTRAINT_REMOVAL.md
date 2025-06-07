# COMPLETE FOREIGN KEY CONSTRAINT REMOVAL

## 🚨 **ISSUE DISCOVERED**
The initial constraint removal was incomplete. Additional foreign key constraints are blocking legacy table cleanup.

## 📊 **REMAINING CONSTRAINTS FOUND**

### **Blocking `recipes` table removal:**
- `notifications.fk_recipe_id` → `recipes`
- `grocery_items.grocery_items_recipe_id_fkey` → `recipes`

### **Blocking `users` table removal:**
- `recipes.recipes_user_id_fkey` → `users`
- `notifications.fk_user_id` → `users`
- `user_rewards.fk_user_id` → `users`

---

## 🎯 **PHASE 1: Remove ALL Remaining Constraints**

**Go to Supabase Dashboard → SQL Editor** and execute these commands **one by one**:

### **Step 1**: Drop notifications constraints
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_recipe_id;
```
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_user_id;
```

### **Step 2**: Drop grocery_items constraint
```sql
ALTER TABLE grocery_items DROP CONSTRAINT IF EXISTS grocery_items_recipe_id_fkey;
```

### **Step 3**: Drop user_rewards constraint
```sql
ALTER TABLE user_rewards DROP CONSTRAINT IF EXISTS fk_user_id;
```

### **Step 4**: Drop recipes constraint
```sql
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_user_id_fkey;
```

---

## 🎯 **PHASE 2: Drop Legacy Tables**

**After ALL constraints are removed**, execute these:

### **Step 5**: Drop recipes table
```sql
DROP TABLE IF EXISTS recipes;
```

### **Step 6**: Drop users table
```sql
DROP TABLE IF EXISTS users;
```

---

## ⚠️ **IMPORTANT NOTES**

### **Active Tables Preserved**:
- ✅ `notifications` - User notifications (3 records)
- ✅ `grocery_items` - Grocery list items (0 records)  
- ✅ `user_rewards` - User rewards system (0 records)

### **Safety Protocol**:
1. **Execute each command individually**
2. **Test app functionality** after constraint removal
3. **Only remove FK constraints** - NOT the active tables
4. **Stop if any unexpected errors occur**

### **What This Accomplishes**:
- Removes FK constraints from **active tables** that reference **legacy tables**
- Preserves all **active table data and functionality**
- Allows safe removal of **legacy tables** (`recipes`, `users`)
- Maintains app functionality while cleaning up database

---

## 🔍 **VERIFICATION**

After completing both phases, run:
```bash
node verify-final-cleanup.js
```

This will confirm:
- ✅ Legacy tables removed
- ✅ Active tables still working
- ✅ Database health verified

---

## 📊 **EXPECTED OUTCOME**

**Before**: 15 tables with complex FK dependencies
**After**: 13 clean active tables with no legacy dependencies

**Removed**:
- `saved_recipes` ✅ (already done)
- `recipe_likes` ✅ (already done)  
- `recipes` 🔄 (pending constraint removal)
- `users` 🔄 (pending constraint removal)

**Active Tables Preserved**:
- `profiles` (main user table)
- `recipe_uploads` (main recipe table)
- `user_interactions` (likes/interactions)
- `saved_recipe_videos` (saved recipes)
- `notifications` (user notifications)
- `grocery_items` (grocery lists)
- `user_rewards` (rewards system)
- Plus 6 other functional tables 