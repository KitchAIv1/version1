# MANUAL FOREIGN KEY CONSTRAINT REMOVAL

## 🎯 OBJECTIVE
Remove foreign key constraints that prevent cleanup of legacy tables while preserving app functionality.

## 📋 EXECUTION STEPS

### 🔧 How to Execute
1. **Go to Supabase Dashboard** → **SQL Editor**
2. **Execute each command individually** (copy-paste one at a time)
3. **Test app functionality** after each critical step
4. **Stop immediately** if any errors occur

---

## 🚨 CRITICAL CONSTRAINTS (Execute First)
**⚠️ Test app after each of these steps**

### Step 1: Drop profiles → users constraint
```sql
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
```
**Expected**: Removes FK constraint from `profiles.user_id` → `users.id`  
**Test**: Verify user profiles still load correctly

### Step 2: Drop recipe_uploads → users constraint
```sql
ALTER TABLE recipe_uploads DROP CONSTRAINT IF EXISTS recipe_uploads_user_id_fkey;
```
**Expected**: Removes FK constraint from `recipe_uploads.user_id` → `users.id`  
**Test**: Verify recipes still display correctly

### Step 3: Drop user_interactions → users constraint
```sql
ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_user_id_fkey;
```
**Expected**: Removes FK constraint from `user_interactions.user_id` → `users.id`  
**Test**: Verify likes/interactions still work

### Step 4: Drop saved_recipe_videos → users constraint
```sql
ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_user_id_fkey;
```
**Expected**: Removes FK constraint from `saved_recipe_videos.user_id` → `users.id`  
**Test**: Verify saved recipes still work

---

## 🔧 RECIPE CONSTRAINTS (Execute After Critical Steps Pass)

### Step 5: Drop user_interactions → recipes constraint
```sql
ALTER TABLE user_interactions DROP CONSTRAINT IF EXISTS user_interactions_recipe_id_fkey;
```

### Step 6: Drop saved_recipe_videos → recipes constraint
```sql
ALTER TABLE saved_recipe_videos DROP CONSTRAINT IF EXISTS saved_recipe_videos_recipe_id_fkey;
```

### Step 7: Drop recipe_likes → recipes constraint
```sql
ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_recipe_id_fkey;
```

### Step 8: Drop recipe_likes → users constraint
```sql
ALTER TABLE recipe_likes DROP CONSTRAINT IF EXISTS recipe_likes_user_id_fkey;
```

---

## ✅ VERIFICATION CHECKLIST

After executing all commands, verify:

### App Functionality
- [ ] Login/Authentication works
- [ ] Recipe browsing (FeedScreen) works
- [ ] Recipe details display correctly
- [ ] Pantry functionality works
- [ ] Saved recipes work
- [ ] User interactions (likes) work
- [ ] No app crashes or errors

### Database Access
- [ ] `profiles` table accessible
- [ ] `recipe_uploads` table accessible  
- [ ] `user_interactions` table accessible
- [ ] `saved_recipe_videos` table accessible

---

## 🚨 IF ERRORS OCCUR

### Rollback Commands (if needed)
```sql
-- Only if you need to restore critical constraints
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE recipe_uploads ADD CONSTRAINT recipe_uploads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(user_id);
```

### Troubleshooting
1. **Constraint doesn't exist**: Normal - command will succeed with "IF EXISTS"
2. **Permission denied**: Ensure you're using service role key
3. **App breaks**: Stop immediately and report the issue

---

## 🎉 SUCCESS CRITERIA

When all steps complete successfully:
- ✅ All 8 constraint removal commands executed
- ✅ App functionality verified and working
- ✅ No database errors
- ✅ Ready to proceed with legacy table cleanup

---

## 🔍 NEXT STEPS (After Success)

1. **Confirm app is working perfectly**
2. **Proceed with legacy table cleanup**:
   - Drop `saved_recipes` table
   - Drop `recipe_likes` table  
   - Drop `recipes` table
   - Drop `users` table
3. **Apply Row Level Security (RLS)**
4. **Final optimization**

---

## 📞 SUPPORT

If you encounter any issues:
1. **Stop execution immediately**
2. **Note the exact error message**
3. **Report which step failed**
4. **Do not proceed until resolved** 