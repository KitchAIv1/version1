# 📦 KitchAI v2 - Production Migration Package

## 📋 **CONTENTS**

This package contains all database migration files needed to set up the production environment.

### **Migration Files** (apply in this order):
1. `20240320000000_create_recipe_uploads.sql`
2. `20240320000001_add_comments_functions.sql`
3. `20241225000001_fix_recipe_details_comments.sql`
4. `20241226000001_fix_get_profile_details_role.sql`
5. `20241226000002_creator_role_fix_complete.sql`
6. `20250125000002_restore_ai_generated_field.sql`
7. `20250125000003_complete_get_profile_details_fix.sql`
8. `20250125000004_create_user_follows_table.sql`
9. `20250126000001_create_followers_following_functions.sql`
10. `20250126000002_assess_backup_tables.sql`
11. `20250126000003_cleanup_backup_tables.sql`
12. `20250126000004_create_proper_backup_system.sql`
13. `20250126000005_fix_get_profile_details_new_user_issue.sql`

## 🛠️ **DEPLOYMENT INSTRUCTIONS**

1. **Access Production Supabase Project**
2. **Go to SQL Editor**
3. **Copy and paste each file content in chronological order**
4. **Wait for each to complete before running the next**
5. **Enable RLS on all tables after completion**

## 🔒 **SECURITY REQUIREMENTS**

After applying all migrations:

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
-- Continue for all tables
```

## 📦 **STORAGE BUCKETS**

Create these buckets in Storage section:
- `recipe-videos` (public)
- `recipe-thumbnails` (public)
- `user-avatars` (public)
- `pantry-scans` (private)

## ✅ **COMPLETION CHECKLIST**

- [ ] All migration files applied successfully
- [ ] RLS enabled on all tables
- [ ] Storage buckets created
- [ ] Storage policies applied
- [ ] Core functions tested
- [ ] Production API keys provided to client

---

**Questions? Reference the main migration instructions document.**
