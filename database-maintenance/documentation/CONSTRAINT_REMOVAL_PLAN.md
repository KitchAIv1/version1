# KITCHAI V2 - FOREIGN KEY CONSTRAINT REMOVAL PLAN

## 🎯 OBJECTIVE
Remove foreign key constraints that prevent cleanup of legacy tables (`users`, `recipes`, `recipe_likes`) while preserving app functionality.

## 📊 CURRENT STATE ANALYSIS
- **Active Tables**: `profiles` (23), `recipe_uploads` (48), `user_interactions` (19), `saved_recipe_videos` (30)
- **Legacy Tables**: `users` (3), `recipes` (21), `recipe_likes` (9), `saved_recipes` (2)
- **Critical Issue**: `profiles.user_id` → `users.id` FK constraint blocks legacy table cleanup

## 🚨 SAFETY PROTOCOL
1. **Test app after each step**
2. **Backup critical data before changes**
3. **Use IF EXISTS to prevent errors**
4. **Verify functionality before proceeding**

---

## 📋 STEP-BY-STEP EXECUTION PLAN

### STEP 1: Drop Foreign Key Constraints
**Goal**: Remove FK constraints that reference legacy tables

#### 1.1 Drop profiles → users constraint
```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
```
**Expected**: Removes FK constraint from profiles.user_id → users.id

#### 1.2 Drop recipe_uploads → users constraint  
```sql
ALTER TABLE recipe_uploads DROP CONSTRAINT IF EXISTS recipe_uploads_user_id_fkey;
```
**Expected**: Removes FK constraint from recipe_uploads.user_id → users.id

#### 1.3 Drop user_interactions → users constraint
```sql
ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_user_id_fkey;
```
**Expected**: Removes FK constraint from user_interactions.user_id → users.id

#### 1.4 Drop saved_recipe_videos → users constraint
```sql
ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_user_id_fkey;
```
**Expected**: Removes FK constraint from saved_recipe_videos.user_id → users.id

#### 1.5 Drop recipe-related constraints
```sql
ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_recipe_id_fkey;
ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_recipe_id_fkey;
ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_recipe_id_fkey;
ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_user_id_fkey;
```
**Expected**: Removes FK constraints that reference legacy recipe tables

---

### STEP 2: Verify App Functionality
**Critical**: Test all major app functions after constraint removal

#### 2.1 Test Core Functions
- [ ] Login/Authentication
- [ ] Recipe browsing (FeedScreen)
- [ ] Recipe details
- [ ] Pantry functionality
- [ ] Saved recipes
- [ ] User interactions (likes)

#### 2.2 Check Database Operations
- [ ] User profile loading
- [ ] Recipe data retrieval
- [ ] Pantry match calculations
- [ ] Save/unsave recipes
- [ ] Like/unlike functionality

---

### STEP 3: Clean Up Legacy Tables (ONLY AFTER VERIFICATION)
**Warning**: Only proceed if Step 2 verification passes completely

#### 3.1 Drop legacy tables
```sql
DROP TABLE IF EXISTS saved_recipes;
DROP TABLE IF EXISTS recipe_likes;  
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS users;
```

#### 3.2 Final verification
- [ ] App loads without errors
- [ ] All functionality works
- [ ] No broken references

---

## 🔧 EXECUTION COMMANDS

### Manual Execution (Supabase Dashboard)
1. Go to Supabase Dashboard → SQL Editor
2. Execute each SQL command individually
3. Test app functionality after each step
4. Only proceed if no errors occur

### Automated Script (Use with caution)
```javascript
// constraint-removal.js - Execute step by step
const commands = [
  "ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;",
  "ALTER TABLE recipe_uploads DROP CONSTRAINT IF EXISTS recipe_uploads_user_id_fkey;",
  "ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_user_id_fkey;",
  "ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_user_id_fkey;",
  "ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_recipe_id_fkey;",
  "ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_recipe_id_fkey;",
  "ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_recipe_id_fkey;",
  "ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_user_id_fkey;"
];
```

---

## ⚠️ ROLLBACK PLAN
If issues occur, constraints can be recreated:

```sql
-- Recreate critical constraints (adjust as needed)
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE recipe_uploads ADD CONSTRAINT recipe_uploads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(user_id);
```

---

## 📊 SUCCESS CRITERIA
- [ ] All FK constraints removed successfully
- [ ] App functionality preserved
- [ ] No database errors
- [ ] Legacy tables ready for cleanup
- [ ] Active tables (`profiles`, `recipe_uploads`) working normally

---

## 🚀 NEXT PHASE
After successful constraint removal:
1. Apply Row Level Security (RLS) to active tables
2. Update any remaining RPC functions
3. Final cleanup and optimization 