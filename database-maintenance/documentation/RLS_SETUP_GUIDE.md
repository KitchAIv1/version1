# ROW LEVEL SECURITY (RLS) SETUP GUIDE

## 🎯 **OBJECTIVE**
Apply Row Level Security to all 11 active tables to secure your database for production deployment.

## 📊 **CURRENT STATUS**
- ✅ All 11 tables accessible and functional
- ✅ All tables have proper `user_id` columns
- ✅ Ready for RLS implementation

---

## 🔧 **PHASE 1: Enable RLS on All Tables**

**Go to Supabase Dashboard → SQL Editor** and execute these commands **one by one**:

```sql
-- 1. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on recipe_uploads  
ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;

-- 3. Enable RLS on user_interactions
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on saved_recipe_videos
ALTER TABLE saved_recipe_videos ENABLE ROW LEVEL SECURITY;

-- 5. Enable RLS on stock
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

-- 6. Enable RLS on recipe_comments
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

-- 7. Enable RLS on grocery_list
ALTER TABLE grocery_list ENABLE ROW LEVEL SECURITY;

-- 8. Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 9. Enable RLS on meal_plans
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- 10. Enable RLS on user_usage_limits
ALTER TABLE user_usage_limits ENABLE ROW LEVEL SECURITY;

-- 11. Enable RLS on user_activity_log
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
```

### ⚠️ **After Phase 1**: Test your app functionality!

---

## 🔧 **PHASE 2: Create RLS Policies**

**After confirming Phase 1 works**, execute these policy commands:

### **User Data Access Policies**
```sql
-- 1. Profiles policies
CREATE POLICY "profiles_user_own_data" ON profiles
FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "profiles_public_read" ON profiles
FOR SELECT USING (true);

-- 2. Recipe uploads policies
CREATE POLICY "recipe_uploads_user_own_data" ON recipe_uploads
FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "recipe_uploads_public_read" ON recipe_uploads
FOR SELECT USING (true);

-- 3. User interactions policies
CREATE POLICY "user_interactions_user_own_data" ON user_interactions
FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "user_interactions_public_read" ON user_interactions
FOR SELECT USING (true);

-- 4. Recipe comments policies
CREATE POLICY "recipe_comments_user_own_data" ON recipe_comments
FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "recipe_comments_public_read" ON recipe_comments
FOR SELECT USING (true);
```

### **Private Data Policies (User Own Data Only)**
```sql
-- 5. Saved recipe videos policy
CREATE POLICY "saved_recipe_videos_user_own_data" ON saved_recipe_videos
FOR ALL USING (auth.uid()::text = user_id);

-- 6. Stock/pantry policy
CREATE POLICY "stock_user_own_data" ON stock
FOR ALL USING (auth.uid()::text = user_id);

-- 7. Grocery list policy
CREATE POLICY "grocery_list_user_own_data" ON grocery_list
FOR ALL USING (auth.uid()::text = user_id);

-- 8. Notifications policy
CREATE POLICY "notifications_user_own_data" ON notifications
FOR ALL USING (auth.uid()::text = user_id);

-- 9. Meal plans policy
CREATE POLICY "meal_plans_user_own_data" ON meal_plans
FOR ALL USING (auth.uid()::text = user_id);

-- 10. Usage limits policy
CREATE POLICY "user_usage_limits_user_own_data" ON user_usage_limits
FOR ALL USING (auth.uid()::text = user_id);

-- 11. Activity log policy
CREATE POLICY "user_activity_log_user_own_data" ON user_activity_log
FOR ALL USING (auth.uid()::text = user_id);
```

### ⚠️ **After Phase 2**: Test your app functionality again!

---

## 🔒 **SECURITY CONFIGURATION SUMMARY**

### **Public Access (Shareable Content)**:
- ✅ `profiles` - Public read, user own data
- ✅ `recipe_uploads` - Public read, user own data  
- ✅ `user_interactions` - Public read, user own data
- ✅ `recipe_comments` - Public read, user own data

### **Private Access (User Data Only)**:
- ✅ `saved_recipe_videos` - User own data only
- ✅ `stock` - User own data only (pantry/inventory)
- ✅ `grocery_list` - User own data only
- ✅ `notifications` - User own data only
- ✅ `meal_plans` - User own data only
- ✅ `user_usage_limits` - User own data only
- ✅ `user_activity_log` - User own data only

---

## ⚠️ **SAFETY PROTOCOL**

1. **Execute Phase 1 first** (enable RLS)
2. **Test app functionality** after Phase 1
3. **Execute Phase 2** (create policies) 
4. **Test app functionality** after Phase 2
5. **Stop immediately** if any errors occur

---

## 🔍 **VERIFICATION**

After completing both phases, run:
```bash
node verify-rls-setup.js
```

This will confirm:
- ✅ RLS enabled successfully
- ✅ Policies working correctly
- ✅ App functionality preserved
- ✅ Database secure and production-ready

---

## 🎉 **EXPECTED OUTCOME**

**Security Features Applied**:
- ✅ Row Level Security enabled on all 11 tables
- ✅ User data isolation implemented
- ✅ Public content appropriately accessible
- ✅ Private content properly protected
- ✅ Production-ready security configuration

**Your KitchAI v2 database will be fully secured and ready for production deployment!** 🚀 